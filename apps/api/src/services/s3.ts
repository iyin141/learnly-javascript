import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";
import { logger } from "../logger.js";

// Internal client for server-to-MinIO communication
export const s3Internal = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true,
});

// Public client for browser presigned URLs
export const s3Public = new S3Client({
  endpoint: config.s3.publicEndpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true,
});

export const BUCKETS = config.s3.buckets;

export interface InitMultipartResult {
  uploadId: string;
  key: string;
  partSize: number;
}

export async function initMultipartUpload(
  key: string,
  contentType: string,
  bucket: string = BUCKETS.uploads
): Promise<InitMultipartResult> {
  const cmd = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const res = await s3Internal.send(cmd);
  if (!res.UploadId) {
    throw new Error("Failed to initialize multipart upload: no uploadId returned");
  }

  // 5MB part size for multipart uploads
  const partSize = 5 * 1024 * 1024;
  logger.info({ key, uploadId: res.UploadId, bucket }, "Initialized multipart upload");

  return {
    uploadId: res.UploadId,
    key,
    partSize,
  };
}

export async function getPartPresignedUrls(
  key: string,
  uploadId: string,
  partNumbers: number[],
  bucket: string = BUCKETS.uploads
): Promise<Array<{ partNumber: number; url: string }>> {
  const results = await Promise.all(
    partNumbers.map(async (partNumber) => {
      const cmd = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      // Browser uploads directly via public endpoint presigned URL
      const url = await getSignedUrl(s3Public, cmd, { expiresIn: 3600 });
      return { partNumber, url };
    })
  );

  return results;
}

export interface CompletedPartInput {
  PartNumber: number;
  ETag: string;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPartInput[],
  bucket: string = BUCKETS.uploads
): Promise<string | undefined> {
  // Parts must be sorted by PartNumber ascending
  const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

  const cmd = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  const res = await s3Internal.send(cmd);
  logger.info({ key, uploadId, location: res.Location }, "Completed multipart upload");
  return res.Location;
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string,
  bucket: string = BUCKETS.uploads
): Promise<void> {
  const cmd = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });

  await s3Internal.send(cmd);
  logger.info({ key, uploadId }, "Aborted multipart upload");
}
