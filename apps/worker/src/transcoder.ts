import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import pino from "pino";

const execAsync = promisify(exec);
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export interface TranscodeJobData {
  courseId: string;
  lessonId: string;
  rawKey: string;
  bucket: string;
}

export interface TranscodeResult {
  durationSeconds: number;
  renditions: string[];
  masterPlaylistPath: string;
  posterPath: string;
  thumbnailPaths: string[];
}

export class VideoTranscoder {
  private s3: S3Client;
  private mediaBucket: string;

  constructor() {
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT || "http://127.0.0.1:9000",
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "learnly",
        secretAccessKey: process.env.S3_SECRET_KEY || "learnly-dev-secret-change-me",
      },
      forcePathStyle: true,
    });
    this.mediaBucket = process.env.S3_BUCKET_MEDIA || "learnly-media";
  }

  async process(
    data: TranscodeJobData,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<TranscodeResult> {
    const { courseId, lessonId, rawKey, bucket } = data;
    const workDir = path.resolve("./tmp", `transcode-${lessonId}-${Date.now()}`);
    await fs.mkdir(workDir, { recursive: true });

    try {
      logger.info({ courseId, lessonId, rawKey }, "Starting video transcoding pipeline");
      if (onProgress) await onProgress(5);

      // 1. Download raw file from S3
      const ext = path.extname(rawKey) || ".mp4";
      const rawLocalPath = path.join(workDir, `input${ext}`);

      const getCmd = new GetObjectCommand({ Bucket: bucket, Key: rawKey });
      const s3Obj = await this.s3.send(getCmd);
      if (!s3Obj.Body) {
        throw new Error(`S3 object body is empty for key: ${rawKey}`);
      }

      await pipeline(s3Obj.Body as any, createWriteStream(rawLocalPath));
      logger.info("Raw video downloaded to %s", rawLocalPath);
      if (onProgress) await onProgress(15);

      // 2. Probe with ffprobe
      const probeData = await this.probeVideo(rawLocalPath);
      const duration = Math.max(1, Math.round(probeData.duration));
      logger.info({ duration, width: probeData.width, height: probeData.height }, "Probed video metadata");
      if (onProgress) await onProgress(25);

      // 3. Prepare output directories
      const outDir = path.join(workDir, "output");
      const dir360 = path.join(outDir, "360p");
      const dir720 = path.join(outDir, "720p");
      const dirThumbs = path.join(outDir, "thumbnails");
      await fs.mkdir(dir360, { recursive: true });
      await fs.mkdir(dir720, { recursive: true });
      await fs.mkdir(dirThumbs, { recursive: true });

      // 4. Generate 360p HLS ladder
      logger.info("Generating 360p HLS ladder...");
      const cmd360 = `ffmpeg -y -i "${rawLocalPath}" -vf "scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" -c:a aac -ar 48000 -c:v libx264 -profile:v main -crf 20 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 6 -hls_playlist_type vod -b:v 800k -maxrate 856k -bufsize 1200k -b:a 96k -hls_segment_filename "${dir360}/segment_%03d.ts" "${dir360}/index.m3u8"`;
      await execAsync(cmd360);
      if (onProgress) await onProgress(50);

      // 5. Generate 720p HLS ladder
      logger.info("Generating 720p HLS ladder...");
      const cmd720 = `ffmpeg -y -i "${rawLocalPath}" -vf "scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -c:a aac -ar 48000 -c:v libx264 -profile:v main -crf 20 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 6 -hls_playlist_type vod -b:v 2500k -maxrate 2675k -bufsize 3750k -b:a 128k -hls_segment_filename "${dir720}/segment_%03d.ts" "${dir720}/index.m3u8"`;
      await execAsync(cmd720);
      if (onProgress) await onProgress(75);

      // 6. Generate master playlist
      const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360
360p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720
720p/index.m3u8
`;
      await fs.writeFile(path.join(outDir, "master.m3u8"), masterContent, "utf8");

      // 7. Generate poster & 3 timeline thumbnails
      logger.info("Generating poster and timeline thumbnails...");
      const halfTime = Math.max(0.1, duration / 2).toFixed(1);
      await execAsync(`ffmpeg -y -ss ${halfTime} -i "${rawLocalPath}" -vframes 1 -q:v 2 "${outDir}/poster.jpg"`);

      const t1 = Math.max(0.1, duration * 0.25).toFixed(1);
      const t2 = Math.max(0.1, duration * 0.5).toFixed(1);
      const t3 = Math.max(0.1, duration * 0.75).toFixed(1);

      await execAsync(`ffmpeg -y -ss ${t1} -i "${rawLocalPath}" -vframes 1 -vf "scale=320:180" "${dirThumbs}/thumb_01.jpg"`);
      await execAsync(`ffmpeg -y -ss ${t2} -i "${rawLocalPath}" -vframes 1 -vf "scale=320:180" "${dirThumbs}/thumb_02.jpg"`);
      await execAsync(`ffmpeg -y -ss ${t3} -i "${rawLocalPath}" -vframes 1 -vf "scale=320:180" "${dirThumbs}/thumb_03.jpg"`);
      if (onProgress) await onProgress(85);

      // 8. Upload everything in outDir to S3 learnly-media/hls/{courseId}/{lessonId}/
      const s3Prefix = `hls/${courseId}/${lessonId}`;
      logger.info("Uploading HLS assets to S3 at %s...", s3Prefix);
      await this.uploadDirectory(outDir, s3Prefix);
      if (onProgress) await onProgress(98);

      logger.info("Transcoding and upload complete for lesson %s", lessonId);

      return {
        durationSeconds: duration,
        renditions: ["360p", "720p"],
        masterPlaylistPath: `${s3Prefix}/master.m3u8`,
        posterPath: `${s3Prefix}/poster.jpg`,
        thumbnailPaths: [
          `${s3Prefix}/thumbnails/thumb_01.jpg`,
          `${s3Prefix}/thumbnails/thumb_02.jpg`,
          `${s3Prefix}/thumbnails/thumb_03.jpg`,
        ],
      };
    } finally {
      // Cleanup work directory
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn({ err }, "Could not remove temp work directory");
      }
    }
  }

  private async probeVideo(filePath: string): Promise<{ duration: number; width: number; height: number }> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );
      const parsed = JSON.parse(stdout);
      const duration = parseFloat(parsed.format?.duration || "10");
      const videoStream = (parsed.streams || []).find((s: any) => s.codec_type === "video");
      const width = videoStream?.width || 1280;
      const height = videoStream?.height || 720;
      return { duration: isNaN(duration) ? 10 : duration, width, height };
    } catch (err) {
      logger.warn({ err }, "ffprobe failed, falling back to 10s default duration");
      return { duration: 10, width: 1280, height: 720 };
    }
  }

  private async uploadDirectory(localDir: string, s3Prefix: string): Promise<void> {
    const entries = await fs.readdir(localDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(localDir, entry.name);
      if (entry.isDirectory()) {
        await this.uploadDirectory(fullPath, `${s3Prefix}/${entry.name}`);
      } else {
        const fileKey = `${s3Prefix}/${entry.name}`;
        const fileBuffer = await fs.readFile(fullPath);
        let contentType = "application/octet-stream";
        if (entry.name.endsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
        else if (entry.name.endsWith(".ts")) contentType = "video/mp2t";
        else if (entry.name.endsWith(".jpg") || entry.name.endsWith(".jpeg")) contentType = "image/jpeg";

        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.mediaBucket,
            Key: fileKey,
            Body: fileBuffer,
            ContentType: contentType,
            CacheControl: entry.name.endsWith(".m3u8") ? "max-age=10" : "max-age=86400",
          })
        );
      }
    }
  }
}
