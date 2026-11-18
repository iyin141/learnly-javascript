#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY"

UP="${S3_BUCKET_UPLOADS:-learnly-uploads}"; MEDIA="${S3_BUCKET_MEDIA:-learnly-media}"; PRIV="${S3_BUCKET_PRIVATE:-learnly-private}"

for b in "$UP" "$MEDIA" "$PRIV"; do
  mc mb --ignore-existing "local/$b"
done

# Raw uploads and private stay private. Media is read through the CDN (see ASSUMPTIONS A6).
mc anonymous set none "local/$UP"
mc anonymous set none "local/$PRIV"
mc anonymous set download "local/$MEDIA"

# CORS for browser multipart uploads is applied by MinIO's default (allow all origins) in dev.

# Lifecycle: expire raw uploads after 7 days. Incomplete multipart uploads are
# cleaned up by the api AbortMultipartUpload job (added in Phase 2).
mc ilm rule add --expire-days 7 "local/$UP" || true

echo "minio-init: buckets ready"
mc ls local
