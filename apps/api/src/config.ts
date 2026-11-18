import path from "node:path";

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || "7d",
  s3: {
    endpoint: process.env.S3_ENDPOINT || "http://127.0.0.1:9010",
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || "http://localhost:9010",
    region: process.env.S3_REGION || "us-east-1",
    accessKey: process.env.S3_ACCESS_KEY || "learnly",
    secretKey: process.env.S3_SECRET_KEY || "learnly-dev-secret-change-me",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || true,
    buckets: {
      uploads: process.env.S3_BUCKET_UPLOADS || "learnly-uploads",
      media: process.env.S3_BUCKET_MEDIA || "learnly-media",
      private: process.env.S3_BUCKET_PRIVATE || "learnly-private",
    },
  },
  cdn: {
    signer: process.env.CDN_SIGNER || "nginx",
    secret: process.env.CDN_SECRET || "cdn-dev-secret-change-me",
    publicPath: process.env.CDN_PUBLIC_PATH || "/cdn",
    urlTtlSeconds: parseInt(process.env.CDN_URL_TTL_SECONDS || "900", 10),
    cloudfront: {
      domain: process.env.CDN_CF_DOMAIN || "",
      keyPairId: process.env.CDN_CF_KEY_PAIR_ID || "",
      privateKey: process.env.CDN_CF_PRIVATE_KEY || "",
      cookieDomain: process.env.CDN_COOKIE_DOMAIN || undefined,
    },
  },
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:3000",
  payments: {
    provider: (process.env.PAYMENT_PROVIDER || "mock") as "mock" | "stripe" | "paystack",
    paystackSecret: process.env.PAYSTACK_SECRET_KEY || "",
    stripeSecret: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    currency: process.env.PAYMENT_CURRENCY || "usd",
    platformFeeBps: parseInt(process.env.PLATFORM_FEE_BPS || "1000", 10),
  },
  livekit: {
    url: process.env.LIVEKIT_URL || "ws://127.0.0.1:7880",
    publicUrl: process.env.LIVEKIT_PUBLIC_URL || "ws://localhost:7880",
    apiKey: process.env.LIVEKIT_API_KEY || "devkey",
    apiSecret: process.env.LIVEKIT_API_SECRET || "devsecret-devsecret-devsecret-0123456789",
  },
};
