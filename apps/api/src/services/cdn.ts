import crypto from "node:crypto";
import { config } from "../config.js";
import { logger } from "../logger.js";

export interface SignedPlaybackResult {
  url: string;
  token: string;
  expires: number;
  cookie: {
    name: string;
    value: string;
    path: string;
    expires: Date;
  };
  /** CloudFront needs three cookies; set each with the CDN cookie domain. */
  cookies?: { name: string; value: string }[];
}

export interface ICdnSigner {
  signPlayback(uriPath: string, ttlSeconds?: number): SignedPlaybackResult;
}

/**
 * Nginx Secure Link Signer (local Docker environment)
 * Generates HMAC signature matching nginx secure_link:
 * md5 = base64url(md5("<expires><uri> <secret>"))
 */
export class NginxSecureLinkSigner implements ICdnSigner {
  private secret: string;
  private defaultTtl: number;

  constructor(secret: string = config.cdn.secret, defaultTtl: number = config.cdn.urlTtlSeconds) {
    this.secret = secret;
    this.defaultTtl = defaultTtl;
  }

  signPlayback(uriPath: string, ttlSeconds: number = this.defaultTtl): SignedPlaybackResult {
    // Ensure path starts with /cdn/
    const normalizedPath = uriPath.startsWith("/cdn/")
      ? uriPath
      : `/cdn/${uriPath.replace(/^\/+/, "")}`;

    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = crypto
      .createHash("md5")
      .update(`${expires}${normalizedPath} ${this.secret}`)
      .digest("base64url");

    const signedUrl = `${normalizedPath}?md5=${token}&expires=${expires}`;

    return {
      url: signedUrl,
      token,
      expires,
      cookie: {
        name: "cdn_token",
        value: `md5=${token}&expires=${expires}`,
        path: "/cdn/hls/",
        expires: new Date(expires * 1000),
      },
    };
  }
}

/** CloudFront URL-safe base64: + / = become - ~ _ */
const cfB64 = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/=/g, "_").replace(/\//g, "~");

/**
 * AWS CloudFront signer (CDN_SIGNER=cloudfront). Custom policy with a wildcard resource covering the whole lesson folder,
 * so the signed master playlist URL also authorises every segment; the same policy and signature are returned as the
 * three CloudFront cookies for players that fetch segments by relative URL. Signing is RSA-SHA1 over the policy, as
 * CloudFront requires, using node:crypto (no extra dependency). Needs CDN_CF_DOMAIN, CDN_CF_KEY_PAIR_ID, CDN_CF_PRIVATE_KEY (PEM).
 */
export class CloudFrontSigner implements ICdnSigner {
  signPlayback(uriPath: string, ttlSeconds: number = config.cdn.urlTtlSeconds): SignedPlaybackResult {
    const { domain, keyPairId, privateKey } = config.cdn.cloudfront;
    if (!domain || !keyPairId || !privateKey) throw new Error("CDN_SIGNER=cloudfront needs CDN_CF_DOMAIN, CDN_CF_KEY_PAIR_ID and CDN_CF_PRIVATE_KEY");
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const path = uriPath.startsWith("/") ? uriPath : `/${uriPath}`;
    const folder = path.slice(0, path.lastIndexOf("/") + 1);
    const policy = JSON.stringify({ Statement: [{ Resource: `https://${domain}${folder}*`, Condition: { DateLessThan: { "AWS:EpochTime": expires } } }] });
    const signature = cfB64(crypto.createSign("RSA-SHA1").update(policy).sign(privateKey.replace(/\\n/g, "\n")));
    const encPolicy = cfB64(Buffer.from(policy));
    logger.debug({ path }, "signed CloudFront URL");
    return {
      url: `https://${domain}${path}?Policy=${encPolicy}&Signature=${signature}&Key-Pair-Id=${keyPairId}`,
      token: signature,
      expires,
      cookie: { name: "CloudFront-Signature", value: signature, path: "/", expires: new Date(expires * 1000) },
      cookies: [
        { name: "CloudFront-Policy", value: encPolicy },
        { name: "CloudFront-Signature", value: signature },
        { name: "CloudFront-Key-Pair-Id", value: keyPairId },
      ],
    };
  }
}

let activeSigner: ICdnSigner | null = null;

export function getCdnSigner(): ICdnSigner {
  if (!activeSigner) {
    if (config.cdn.signer === "cloudfront") {
      activeSigner = new CloudFrontSigner();
    } else {
      activeSigner = new NginxSecureLinkSigner();
    }
  }
  return activeSigner;
}
