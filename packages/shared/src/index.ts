import { z } from "zod";

// --- Roles & Auth ---
export const UserRoleSchema = z.enum(["student", "instructor", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  email: z.string().email(),
  role: UserRoleSchema,
  avatarUrl: z.string().optional(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const RegisterRequestSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: UserRoleSchema.default("student"),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// --- Courses ---
export const SubjectColorSchema = z.enum(["blue", "coral", "slate", "purple", "teal", "amber"]);
export type SubjectColor = z.infer<typeof SubjectColorSchema>;

export const CourseStatusSchema = z.enum(["draft", "in_review", "published"]);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

export const LessonTypeSchema = z.enum(["video", "text", "file"]);
export type LessonType = z.infer<typeof LessonTypeSchema>;

export const VideoRenditionStatusSchema = z.enum(["uploaded", "transcoding", "ready", "failed"]);
export type VideoRenditionStatus = z.infer<typeof VideoRenditionStatusSchema>;

export interface VideoInfo {
  status: VideoRenditionStatus;
  durationSeconds?: number;
  renditions?: string[]; // e.g. ["360p", "720p"]
  masterPlaylistPath?: string;
  posterPath?: string;
  thumbnailPaths?: string[];
  errorReason?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  sectionId: string;
  title: string;
  type: LessonType;
  order: number;
  durationSeconds: number;
  video?: VideoInfo;
  textContent?: string;
  fileUrl?: string;
}

export interface Section {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  code: string;
  term: string;
  sectionName: string;
  description: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar?: string;
  status: CourseStatus;
  subjectColor: SubjectColor;
  estimatedHours: number;
  totalLessons: number;
  totalQuizzes: number;
  isLiveNow?: boolean;
  upcomingLiveTitle?: string;
  upcomingLiveDate?: string;
  sections?: Section[];
}

// --- Enrolment ---
export interface Enrolment {
  id: string;
  userId: string;
  courseId: string;
  status: "active" | "completed" | "archived";
  progressPercent: number;
  completedLessons: string[];
  lastLessonId?: string;
  lastPositionSeconds?: number;
  enrolledAt: string;
  course?: Course;
}

// --- Readiness / Standard Responses (inspired by F1 reference) ---
export interface ReadinessReport {
  status: "ok" | "degraded" | "down";
  components: {
    mongo: boolean;
    redis: boolean;
    s3: boolean;
    livekit: boolean;
  };
  details?: Record<string, string>;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryAfter?: number;
    requestId?: string;
  };
}
