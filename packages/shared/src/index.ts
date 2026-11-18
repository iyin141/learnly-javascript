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
  // admin accounts are never self-service
  role: z.enum(["student", "instructor"]).default("student"),
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
  /** 0 = free. Paid courses are bought through POST /courses/:id/checkout. */
  priceCents?: number;
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
    postgres: boolean;
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

// --- Playback ---
export interface Playback {
  playbackUrl: string;
  expiresAt: number;
  lastPositionSeconds: number;
  isCompleted: boolean;
  durationSeconds: number;
  renditions: string[];
  /** WebVTT caption files, when the API provides any */
  captions?: { src: string; label: string; lang?: string }[];
}

// --- Quizzes ---
export type QuestionType = "single" | "multiple" | "true_false" | "short";

export interface QuizSummary {
  id: string;
  courseId: string;
  title: string;
  description: string;
  unitLabel?: string;
  timeLimitMinutes: number;
  passMarkPercent: number;
  maxAttempts: number;
  questionCount: number;
  totalPoints: number;
  attemptsUsed: number;
  bestScorePercent?: number;
  passed?: boolean;
  required: boolean;
}

export interface QuizQuestionPublic {
  id: string;
  type: QuestionType;
  prompt: string;
  topic?: string;
  points: number;
  options: { id: string; text: string }[];
}

export interface AttemptStart {
  attemptId: string;
  quizId: string;
  startedAt: string;
  endsAt: string;
  serverNow: string;
  questions: QuizQuestionPublic[];
  answers: Record<string, unknown>;
  flagged: string[];
}

export interface AttemptResult {
  attemptId: string;
  scorePoints: number;
  maxPoints: number;
  scorePercent: number;
  passed: boolean;
  timedOut: boolean;
  certificateIssued?: boolean;
  review: {
    questionId: string;
    prompt: string;
    correct: boolean;
    earned: number;
    points: number;
    explanation?: string;
    correctOptionIds: string[];
    given: unknown;
  }[];
}

// --- Certificates ---
export interface CertificateInfo {
  id: string;
  code: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  instructorName: string;
  issuedAt: string;
  hours: number;
}

// --- Live ---
export type LiveStatus = "scheduled" | "live" | "ended";
export interface LiveSessionInfo {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  code: string;
  instructorId: string;
  instructorName: string;
  startsAt: string;
  durationMinutes: number;
  status: LiveStatus;
  recording?: boolean;
  isHost?: boolean;
}

// --- Pure rules (unit tested in apps/api) ---
export interface ScorableQuestion {
  id: string;
  type: QuestionType;
  points: number;
  correct: string[]; // option ids, or accepted short answers (lowercase)
}

export function scoreAnswer(q: ScorableQuestion, given: unknown): number {
  if (given == null) return 0;
  if (q.type === "short") {
    return q.correct.includes(String(given).trim().toLowerCase()) ? q.points : 0;
  }
  const g = (Array.isArray(given) ? given : [given]).map(String).sort();
  const c = [...q.correct].sort();
  return g.length === c.length && g.every((v, i) => v === c[i]) ? q.points : 0;
}

export function courseComplete(
  lessonIds: string[],
  completed: string[],
  requiredQuizzes: { id: string; passed: boolean }[]
): boolean {
  const done = new Set(completed);
  return lessonIds.length > 0 && lessonIds.every((l) => done.has(l)) && requiredQuizzes.every((q) => q.passed);
}
