#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY"

for b in learnly-uploads learnly-media learnly-private; do
  mc mb --ignore-existing "local/$b"
done

# Raw uploads and private stay private. Media is read through the CDN (see ASSUMPTIONS A6).
mc anonymous set none local/learnly-uploads
mc anonymous set none local/learnly-private
mc anonymous set download local/learnly-media

# CORS for browser multipart uploads is applied by MinIO's default (allow all origins) in dev.

# Lifecycle: expire raw uploads after 7 days. Incomplete multipart uploads are
# cleaned up by the api AbortMultipartUpload job (added in Phase 2).
mc ilm rule add --expire-days 7 local/learnly-uploads || true

echo "minio-init: buckets ready"
mc ls local
