import mongoose, { Schema, Document, model } from "mongoose";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { UserRole, CourseStatus, SubjectColor, LessonType, VideoRenditionStatus } from "@learnly/shared";

// --- User Schema ---
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "instructor", "admin"], default: "student", required: true },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

export const UserModel = model<IUser>("User", UserSchema);

// --- RefreshToken Schema (for rotation) ---
export interface IRefreshToken extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RefreshTokenModel = model<IRefreshToken>("RefreshToken", RefreshTokenSchema);

// --- Course Schema ---
export interface ICourse extends Document {
  title: string;
  code: string;
  term: string;
  sectionName: string;
  description: string;
  instructorId: mongoose.Types.ObjectId;
  status: CourseStatus;
  subjectColor: SubjectColor;
  estimatedHours: number;
  isLiveNow: boolean;
  upcomingLiveTitle?: string;
  upcomingLiveDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true },
    code: { type: String, required: true, index: true },
    term: { type: String, required: true, default: "Fall 2026" },
    sectionName: { type: String, required: true, default: "Section 01" },
    description: { type: String, required: true },
    instructorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["draft", "in_review", "published"], default: "published", index: true },
    subjectColor: { type: String, enum: ["blue", "coral", "slate", "purple", "teal", "amber"], default: "blue" },
    estimatedHours: { type: Number, default: 20 },
    isLiveNow: { type: Boolean, default: false },
    upcomingLiveTitle: { type: String },
    upcomingLiveDate: { type: Date },
  },
  { timestamps: true }
);

export const CourseModel = model<ICourse>("Course", CourseSchema);

// --- Section Schema ---
export interface ISection extends Document {
  courseId: mongoose.Types.ObjectId;
  title: string;
  order: number;
}

const SectionSchema = new Schema<ISection>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const SectionModel = model<ISection>("Section", SectionSchema);

// --- Lesson Schema ---
export interface ILesson extends Document {
  courseId: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  title: string;
  type: LessonType;
  order: number;
  durationSeconds: number;
  video?: {
    status: VideoRenditionStatus;
    durationSeconds?: number;
    renditions?: string[];
    masterPlaylistPath?: string;
    posterPath?: string;
    thumbnailPaths?: string[];
    errorReason?: string;
    rawUploadKey?: string;
  };
  textContent?: string;
  fileUrl?: string;
}

const LessonSchema = new Schema<ILesson>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ["video", "text", "file"], default: "video", required: true },
    order: { type: Number, required: true, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    video: {
      status: { type: String, enum: ["uploaded", "transcoding", "ready", "failed"], default: "ready" },
      durationSeconds: { type: Number },
      renditions: [{ type: String }],
      masterPlaylistPath: { type: String },
      posterPath: { type: String },
      thumbnailPaths: [{ type: String }],
      errorReason: { type: String },
      rawUploadKey: { type: String },
    },
    textContent: { type: String },
    fileUrl: { type: String },
  },
  { timestamps: true }
);

export const LessonModel = model<ILesson>("Lesson", LessonSchema);

// --- Enrolment Schema ---
export interface IEnrolment extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  status: "active" | "completed" | "archived";
  progressPercent: number;
  completedLessons: mongoose.Types.ObjectId[];
  lastLessonId?: mongoose.Types.ObjectId;
  lastPositionSeconds?: number;
  createdAt: Date;
  updatedAt: Date;
}

const EnrolmentSchema = new Schema<IEnrolment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    status: { type: String, enum: ["active", "completed", "archived"], default: "active", index: true },
    progressPercent: { type: Number, default: 0 },
    completedLessons: [{ type: Schema.Types.ObjectId, ref: "Lesson" }],
    lastLessonId: { type: Schema.Types.ObjectId, ref: "Lesson" },
    lastPositionSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);
EnrolmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const EnrolmentModel = model<IEnrolment>("Enrolment", EnrolmentSchema);

// --- Connection helper ---
export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info("Connected to MongoDB successfully");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    throw err;
  }
}
