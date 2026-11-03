// s3:smoke - verifies buckets, presigned URLs, multipart, and CDN secure_link + caching.
import crypto from "node:crypto";
import fs from "node:fs";
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand,
  CreateMultipartUploadCommand, AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Load .env, falling back to .env.example (dev defaults)
function loadEnv() {
  const f = fs.existsSync(".env") ? ".env" : ".env.example";
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=([^#]*?)\s*(#.*)?$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();
const e = process.env;
const publicEndpoint = e.S3_PUBLIC_ENDPOINT;
const gateway = `http://localhost:${e.GATEWAY_PORT || 80}`;
const creds = { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY };
const mk = (endpoint) => new S3Client({ endpoint, region: e.S3_REGION, forcePathStyle: true, credentials: creds });
const s3 = mk(publicEndpoint);        // host-side script reaches MinIO via the public endpoint
const signer = mk(publicEndpoint);    // signs URLs for the browser

let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (err) { failed++; console.error(`FAIL  ${name}: ${err.message}`); }
};
const assert = (c, msg) => { if (!c) throw new Error(msg); };

const buckets = [e.S3_BUCKET_UPLOADS, e.S3_BUCKET_MEDIA, e.S3_BUCKET_PRIVATE];
for (const b of buckets) await check(`bucket exists: ${b}`, () => s3.send(new HeadBucketCommand({ Bucket: b })));

await check("presigned PUT then GET round-trip (uploads)", async () => {
  const Key = `smoke/${Date.now()}.txt`;
  const url = await getSignedUrl(signer, new PutObjectCommand({ Bucket: e.S3_BUCKET_UPLOADS, Key }), { expiresIn: 60 });
  const put = await fetch(url, { method: "PUT", body: "hello learnly" });
  assert(put.ok, `PUT ${put.status}`);
  const getUrl = await getSignedUrl(signer, new GetObjectCommand({ Bucket: e.S3_BUCKET_UPLOADS, Key }), { expiresIn: 60 });
  assert((await (await fetch(getUrl)).text()) === "hello learnly", "body mismatch");
});

await check("private bucket rejects anonymous read", async () => {
  const r = await fetch(`${publicEndpoint}/${e.S3_BUCKET_PRIVATE}/anything`);
  assert(r.status === 403 || r.status === 404, `expected 403/404 got ${r.status}`);
});

await check("multipart create + abort", async () => {
  const Key = `smoke/mp-${Date.now()}.bin`;
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket: e.S3_BUCKET_UPLOADS, Key }));
  assert(UploadId, "no UploadId");
  await s3.send(new AbortMultipartUploadCommand({ Bucket: e.S3_BUCKET_UPLOADS, Key, UploadId }));
});

// CDN: signed path like the api will issue in Phase 3
const sign = (path, ttl = 60) => {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const md5 = crypto.createHash("md5").update(`${expires}${path} ${e.CDN_SECRET}`).digest("base64url");
  return `${gateway}${path}?md5=${md5}&expires=${expires}`;
};
const mediaKey = `hls/smoke/test/seg-${Date.now()}.ts`;
await s3.send(new PutObjectCommand({ Bucket: e.S3_BUCKET_MEDIA, Key: mediaKey, Body: "segment-bytes", ContentType: "video/mp2t" }));

await check("cdn: unsigned request -> 403", async () => {
  const r = await fetch(`${gateway}/cdn/${mediaKey}`);
  assert(r.status === 403, `got ${r.status}`);
});
await check("cdn: expired signature -> 410", async () => {
  const r = await fetch(sign(`/cdn/${mediaKey}`, -10));
  assert(r.status === 410, `got ${r.status}`);
});
await check("cdn: MISS then HIT", async () => {
  const url = sign(`/cdn/${mediaKey}`);
  const a = await fetch(url);
  assert(a.ok, `first ${a.status}`);
  const b = await fetch(sign(`/cdn/${mediaKey}`));
  const xa = a.headers.get("x-cache"), xb = b.headers.get("x-cache");
  assert(xa === "MISS" && xb === "HIT", `X-Cache ${xa} then ${xb}`);
});

console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
process.exit(failed ? 1 : 0);
