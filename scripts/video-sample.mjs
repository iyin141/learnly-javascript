import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const API_URL = process.env.API_URL || "http://localhost:4000";
const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://127.0.0.1:9000";

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "learnly",
    secretAccessKey: process.env.S3_SECRET_KEY || "learnly-dev-secret-change-me",
  },
  forcePathStyle: true,
});

async function main() {
  console.log("=== Phase 2 Acceptance: Video Upload & BullMQ + FFmpeg Pipeline ===");

  // 1. Ensure sample video exists
  const tmpDir = path.resolve("./tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const sampleVideoPath = path.join(tmpDir, "sample_test.mp4");

  if (!fs.existsSync(sampleVideoPath)) {
    console.log("Generating sample synthetic MP4 using FFmpeg...");
    execSync(
      `ffmpeg -y -f lavfi -i testsrc=duration=4:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=4 -c:v libx264 -c:a aac -pix_fmt yuv420p "${sampleVideoPath}"`,
      { stdio: "inherit" }
    );
  }

  const fileStats = fs.statSync(sampleVideoPath);
  const fileBuffer = fs.readFileSync(sampleVideoPath);
  console.log(`Sample video ready: ${sampleVideoPath} (${fileStats.size} bytes)`);

  // 2. Login as instructor
  console.log("Logging in as instructor@learnly.local...");
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "instructor@learnly.local", password: "password123" }),
  });
  if (!loginRes.ok) throw new Error(`Login failed with status ${loginRes.status}`);
  const loginData = await loginRes.json();
  const token = loginData.accessToken || loginData.token;
  const user = loginData.user;
  console.log(`Logged in as: ${user.name} (${user.role}), token: ${token.slice(0, 10)}...`);

  // 3. Get CS 101 course and find/create section and lesson
  console.log("Fetching courses catalog...");
  const coursesRes = await fetch(`${API_URL}/api/courses`);
  const { courses } = await coursesRes.json();
  const cs101 = courses.find((c) => c.code === "CS 101") || courses[0];
  if (!cs101) throw new Error("No course found");

  const courseId = cs101.id || cs101._id;

  const courseDetailsRes = await fetch(`${API_URL}/api/courses/${courseId}`);
  const courseDetails = await courseDetailsRes.json();
  const sections = courseDetails.course?.sections || courseDetails.sections || [];
  let targetSection = sections[0];
  let sectionId = targetSection?.id || targetSection?._id;

  if (!targetSection || !sectionId) {
    const secRes = await fetch(`${API_URL}/api/courses/${courseId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: "Pipeline Test Section" }),
    });
    const secData = await secRes.json();
    targetSection = secData.section;
    sectionId = targetSection.id || targetSection._id;
  }

  // Create a new test lesson
  console.log(`Creating test lesson in section: ${targetSection.title}...`);
  const lessonRes = await fetch(
    `${API_URL}/api/courses/${courseId}/sections/${sectionId}/lessons`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: `FFmpeg Pipeline Test ${Date.now()}`,
        type: "video",
        durationSeconds: 0,
      }),
    }
  );
  if (!lessonRes.ok) throw new Error("Failed to create lesson");
  const { lesson } = await lessonRes.json();
  const lessonId = lesson.id || lesson._id;
  console.log(`Created lesson: ${lessonId} (${lesson.title})`);

  // 4. Initialize S3 Multipart upload
  console.log("Initializing multipart upload via API...");
  const initRes = await fetch(`${API_URL}/api/uploads/video/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      courseId,
      lessonId,
      fileName: "sample_test.mp4",
      contentType: "video/mp4",
      fileSizeBytes: fileStats.size,
    }),
  });
  if (!initRes.ok) {
    const err = await initRes.json();
    throw new Error(`Init upload failed: ${JSON.stringify(err)}`);
  }
  const { uploadId, key, partSize } = await initRes.json();
  console.log(`Upload initialized: uploadId=${uploadId}, key=${key}, partSize=${partSize}`);

  // 5. Get presigned part URLs
  const partUrlsRes = await fetch(`${API_URL}/api/uploads/video/part-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      uploadId,
      key,
      partNumbers: [1],
    }),
  });
  if (!partUrlsRes.ok) throw new Error("Failed to get presigned part URLs");
  const { parts } = await partUrlsRes.json();
  const part1 = parts[0];
  console.log(`Got presigned URL for Part 1`);

  // 6. Upload part directly to MinIO
  console.log("Uploading Part 1 directly to MinIO...");
  const putRes = await fetch(part1.url, {
    method: "PUT",
    body: fileBuffer,
  });
  if (!putRes.ok) throw new Error(`Part upload failed with status ${putRes.status}`);
  const etag = putRes.headers.get("etag") || '"part1-etag"';
  console.log(`Part 1 uploaded successfully (ETag: ${etag})`);

  // 7. Complete multipart upload
  console.log("Completing multipart upload and enqueuing BullMQ job...");
  const compRes = await fetch(`${API_URL}/api/uploads/video/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      courseId,
      lessonId,
      uploadId,
      key,
      parts: [{ PartNumber: 1, ETag: etag }],
    }),
  });
  if (!compRes.ok) throw new Error("Failed to complete multipart upload");
  const compData = await compRes.json();
  console.log(`Upload completed, BullMQ Job ID: ${compData.jobId}`);

  // 8. Poll lesson status until ready (max 60 seconds)
  console.log("Waiting for worker transcoding to finish (polling lesson status)...");
  let attempts = 0;
  let finalLesson = null;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
    const pollRes = await fetch(`${API_URL}/api/courses/${courseId}`);
    const pollData = await pollRes.json();
    const curSections = pollData.course?.sections || pollData.sections || [];
    for (const sec of curSections) {
      const found = (sec.lessons || []).find((l) => (l.id || l._id) === lessonId);
      if (found) {
        finalLesson = found;
        break;
      }
    }

    const curStatus = finalLesson?.video?.status;
    process.stdout.write(`Attempt ${attempts}: status = ${curStatus}\r`);

    if (curStatus === "ready") {
      console.log(`\nLesson video status is READY! Duration: ${finalLesson.video.durationSeconds}s`);
      break;
    } else if (curStatus === "failed") {
      throw new Error(`Transcoding failed: ${finalLesson.video.errorReason}`);
    }
  }

  if (finalLesson?.video?.status !== "ready") {
    throw new Error("Transcoding timed out before reaching ready status");
  }

  // 9. Verify artifacts in MinIO bucket learnly-media
  console.log("\nVerifying HLS ladders and thumbnails in MinIO bucket 'learnly-media'...");
  const requiredKeys = [
    `hls/${courseId}/${lessonId}/master.m3u8`,
    `hls/${courseId}/${lessonId}/360p/index.m3u8`,
    `hls/${courseId}/${lessonId}/720p/index.m3u8`,
    `hls/${courseId}/${lessonId}/poster.jpg`,
    `hls/${courseId}/${lessonId}/thumbnails/thumb_01.jpg`,
    `hls/${courseId}/${lessonId}/thumbnails/thumb_02.jpg`,
    `hls/${courseId}/${lessonId}/thumbnails/thumb_03.jpg`,
  ];

  for (const mediaKey of requiredKeys) {
    try {
      const headRes = await s3.send(
        new HeadObjectCommand({ Bucket: "learnly-media", Key: mediaKey })
      );
      console.log(`  ✓ Found: ${mediaKey} (${headRes.ContentLength} bytes, ${headRes.ContentType})`);
    } catch (err) {
      throw new Error(`Missing expected artifact in MinIO: ${mediaKey} (${err.message})`);
    }
  }

  console.log("\n ALL PHASE 2 ACCEPTANCE CRITERIA SATISFIED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("\n❌ Phase 2 Acceptance Check Failed:", err);
  process.exit(1);
});
