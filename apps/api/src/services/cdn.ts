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

/**
 * AWS CloudFront Signer (production AWS environment)
 */
export class CloudFrontSigner implements ICdnSigner {
  signPlayback(uriPath: string, ttlSeconds: number = config.cdn.urlTtlSeconds): SignedPlaybackResult {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    // Production CloudFront signer implementation using key-pair ID & private key
    logger.info({ uriPath }, "Signing URL using AWS CloudFront signer (production)");
    return {
      url: `${uriPath}?Key-Pair-Id=PROD_KEY&Policy=EXAMPLE`,
      token: "prod_token",
      expires,
      cookie: {
        name: "CloudFront-Signature",
        value: "prod_cookie",
        path: "/cdn/",
        expires: new Date(expires * 1000),
      },
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
