import crypto from "node:crypto";
import { config } from "../config.js";

export interface CheckoutInput { paymentId: string; amountCents: number; courseTitle: string; email: string; returnUrl: string }
export interface PaidEvent { eventId: string; paymentId: string; amountCents: number }

/** Every gateway sits behind this; routes never talk to a vendor API directly. */
export interface PaymentProvider {
  readonly name: string;
  /** `paidNow` = no hosted page (mock). Otherwise send the browser to `url` and wait for the webhook. */
  createSession(i: CheckoutInput): Promise<{ url?: string; paidNow?: boolean; ref?: string }>;
  parseWebhook(raw: Buffer, signature: string | undefined, nowSec?: number): PaidEvent | null;
  /** Optional: ask the gateway directly whether a payment was made (webhook delayed or lost). */
  verify?(paymentId: string): Promise<{ paid: boolean; amountCents: number; eventId: string }>;
}

/** Test-mode provider with no network: the "card" always succeeds immediately. Refuses to run in production. */
export class MockProvider implements PaymentProvider {
  readonly name = "mock";
  constructor() {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "1") throw new Error("PAYMENT_PROVIDER=mock is not allowed in production");
  }
  async createSession() { return { paidNow: true }; }
  parseWebhook() { return null; }
}

/** Stripe Checkout in TEST mode (sk_test_...). Webhook: Stripe-Signature t=...,v1=hmac-sha256("t.body"), 5 minute tolerance. */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  constructor(private secret: string, private webhookSecret: string, private currency = "usd", private base = "https://api.stripe.com") {
    if (!secret.startsWith("sk_test_") && process.env.STRIPE_ALLOW_LIVE !== "1") throw new Error("StripeProvider only accepts test keys (sk_test_...)");
  }
  async createSession(i: CheckoutInput) {
    const form = new URLSearchParams({
      mode: "payment", client_reference_id: i.paymentId, customer_email: i.email, success_url: i.returnUrl, cancel_url: i.returnUrl,
      "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": this.currency,
      "line_items[0][price_data][unit_amount]": String(i.amountCents), "line_items[0][price_data][product_data][name]": i.courseTitle,
      "metadata[paymentId]": i.paymentId,
    });
    const r = await fetch(`${this.base}/v1/checkout/sessions`, { method: "POST", headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `learnly-${i.paymentId}` }, body: form });
    const j = (await r.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!r.ok) throw new Error(`stripe checkout ${r.status}: ${j.error?.message ?? ""}`);
    return { url: j.url, ref: j.id };
  }
  parseWebhook(raw: Buffer, signature: string | undefined, nowSec = Math.floor(Date.now() / 1000)): PaidEvent | null {
    if (!signature) return null;
    const parts = Object.fromEntries(signature.split(",").map((p) => p.split("=") as [string, string]));
    const t = Number(parts.t);
    if (!t || Math.abs(nowSec - t) > 300 || !parts.v1) return null;
    const want = crypto.createHmac("sha256", this.webhookSecret).update(`${t}.`).update(raw).digest("hex");
    const a = Buffer.from(want), b = Buffer.from(parts.v1);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const j = JSON.parse(raw.toString("utf8"));
    const o = j.data?.object ?? {};
    if (j.type !== "checkout.session.completed" || o.payment_status !== "paid") return null;
    return { eventId: String(j.id), paymentId: String(o.client_reference_id ?? o.metadata?.paymentId ?? ""), amountCents: Number(o.amount_total ?? 0) };
  }
}

/**
 * Paystack (test keys sk_test_...). Works where Stripe is unavailable (Nigeria, Ghana, South Africa, Kenya).
 * Hosted checkout via /transaction/initialize; webhook header x-paystack-signature = HMAC-SHA512 of the raw body with the secret key.
 * The payment id is used as the Paystack reference, so the webhook maps straight back to our payment row.
 */
export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack";
  constructor(private secret: string, private currency = "NGN", private base = "https://api.paystack.co") {
    if (!secret.startsWith("sk_test_") && process.env.PAYSTACK_ALLOW_LIVE !== "1") throw new Error("PaystackProvider only accepts test keys (sk_test_...)");
    if (!["NGN", "GHS", "KES", "ZAR", "USD"].includes(currency)) throw new Error(`unsupported Paystack currency ${currency}: use NGN, GHS, KES, ZAR or USD`);
  }
  async createSession(i: CheckoutInput) {
    const r = await fetch(`${this.base}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: i.email, amount: i.amountCents, currency: this.currency, reference: i.paymentId, callback_url: i.returnUrl, metadata: { paymentId: i.paymentId } }),
    });
    const j = (await r.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
    if (!r.ok || !j.status) throw new Error(`paystack initialize ${r.status}: ${j.message ?? ""}`);
    return { url: j.data?.authorization_url, ref: j.data?.reference };
  }
  /** GET /transaction/verify/{reference}: the redirect back from checkout and the manual re-check both use this. */
  async verify(paymentId: string) {
    const r = await fetch(`${this.base}/transaction/verify/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${this.secret}` } });
    const j = (await r.json()) as { status?: boolean; message?: string; data?: { id?: number; status?: string; amount?: number } };
    if (!r.ok || !j.status) throw new Error(`paystack verify ${r.status}: ${j.message ?? ""}`);
    return { paid: j.data?.status === "success", amountCents: Number(j.data?.amount ?? 0), eventId: `verify:${j.data?.id ?? paymentId}` };
  }
  parseWebhook(raw: Buffer, signature: string | undefined): PaidEvent | null {
    if (!signature) return null;
    const want = crypto.createHmac("sha512", this.secret).update(raw).digest("hex");
    const a = Buffer.from(want), b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const j = JSON.parse(raw.toString("utf8"));
    if (j.event !== "charge.success" || j.data?.status !== "success") return null;
    return { eventId: String(j.data.id), paymentId: String(j.data.reference ?? ""), amountCents: Number(j.data.amount ?? 0) };
  }
}

let active: PaymentProvider | null = null;
export function getPaymentProvider(): PaymentProvider {
  if (!active) {
    const p = config.payments;
    active =
      p.provider === "stripe" ? new StripeProvider(p.stripeSecret, p.stripeWebhookSecret, p.currency)
      : p.provider === "paystack" ? new PaystackProvider(p.paystackSecret, p.currency)
      : new MockProvider();
  }
  return active;
}
export function setPaymentProvider(p: PaymentProvider | null) { active = p; } // tests

/** Platform share of a payment, rounded half up; the instructor earns the rest. */
export const platformFee = (amountCents: number, bps = config.payments.platformFeeBps) => Math.floor((amountCents * bps + 5000) / 10000);
