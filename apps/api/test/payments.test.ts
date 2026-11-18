import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { StripeProvider, MockProvider, platformFee } from "../src/services/payments.js";
import { CloudFrontSigner } from "../src/services/cdn.js";
import { config } from "../src/config.js";

describe("platform fee", () => {
  it("is 10% rounded half up; the instructor keeps the rest", () => {
    expect(platformFee(4900, 1000)).toBe(490);
    expect(platformFee(4995, 1000)).toBe(500); // 499.5 -> 500
    expect(4900 - platformFee(4900, 1000)).toBe(4410);
  });
});

describe("stripe webhook (test mode)", () => {
  const sp = new StripeProvider("sk_test_x", "whsec_x");
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { client_reference_id: "pay-1", amount_total: 4900, payment_status: "paid" } } }));
  const t = 1_700_000_000;
  const sig = (b: Buffer, ts = t) => `t=${ts},v1=${crypto.createHmac("sha256", "whsec_x").update(`${ts}.`).update(b).digest("hex")}`;
  it("accepts a valid signature", () => {
    expect(sp.parseWebhook(body, sig(body), t + 5)).toEqual({ eventId: "evt_1", paymentId: "pay-1", amountCents: 4900 });
  });
  it("rejects tampered body, stale timestamp and missing signature", () => {
    expect(sp.parseWebhook(Buffer.from(body.toString().replace("4900", "1")), sig(body), t)).toBeNull();
    expect(sp.parseWebhook(body, sig(body), t + 301)).toBeNull();
    expect(sp.parseWebhook(body, undefined, t)).toBeNull();
  });
  it("refuses live keys; mock never produces webhooks", () => {
    expect(() => new StripeProvider("sk_live_x", "w")).toThrow(/test keys/);
    expect(new MockProvider().parseWebhook()).toBeNull();
  });
});

describe("CloudFront signer", () => {
  it("signs a wildcard policy that verifies with the public key", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    Object.assign(config.cdn.cloudfront, { domain: "d111.cloudfront.net", keyPairId: "K123", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
    const s = new CloudFrontSigner().signPlayback("/cdn/hls/c1/l1/master.m3u8", 600);
    const u = new URL(s.url);
    expect(u.host).toBe("d111.cloudfront.net");
    expect(u.searchParams.get("Key-Pair-Id")).toBe("K123");
    const unb64 = (x: string) => Buffer.from(x.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64");
    const policy = unb64(u.searchParams.get("Policy")!);
    expect(JSON.parse(policy.toString()).Statement[0].Resource).toBe("https://d111.cloudfront.net/cdn/hls/c1/l1/*");
    const ok = crypto.createVerify("RSA-SHA1").update(policy).verify(publicKey, unb64(u.searchParams.get("Signature")!));
    expect(ok).toBe(true);
    expect(s.cookies?.map((c) => c.name)).toEqual(["CloudFront-Policy", "CloudFront-Signature", "CloudFront-Key-Pair-Id"]);
  });
});
