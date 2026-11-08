import mongoose, { Schema, model } from "mongoose";

// --- Quiz / Question / Attempt (Phase 4) ---
const QuizSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    unitLabel: String,
    timeLimitMinutes: { type: Number, default: 20 },
    passMarkPercent: { type: Number, default: 70 },
    maxAttempts: { type: Number, default: 3 },
    required: { type: Boolean, default: true },
    shuffle: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const QuizModel = model("Quiz", QuizSchema);

const QuestionSchema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    type: { type: String, enum: ["single", "multiple", "true_false", "short"], default: "single" },
    prompt: { type: String, required: true },
    topic: String,
    points: { type: Number, default: 1 },
    options: [{ id: String, text: String }],
    correct: [String], // option ids, or accepted short answers (lowercase)
    explanation: String,
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const QuestionModel = model("Question", QuestionSchema);

const AttemptSchema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    submittedAt: Date,
    questionOrder: [Schema.Types.ObjectId],
    answers: { type: Schema.Types.Mixed, default: {} },
    flagged: [String],
    scorePoints: Number,
    maxPoints: Number,
    scorePercent: Number,
    passed: Boolean,
    timedOut: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const AttemptModel = model("Attempt", AttemptSchema);

// --- Certificates ---
const CertificateSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    issuedAt: { type: Date, default: Date.now },
    pdfKey: String,
  },
  { timestamps: true }
);
CertificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });
export const CertificateModel = model("Certificate", CertificateSchema);

// --- Live classes (Phase 5) ---
const LiveSessionSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    instructorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    startsAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60 },
    status: { type: String, enum: ["scheduled", "live", "ended"], default: "scheduled", index: true },
    startedAt: Date,
    endedAt: Date,
    recording: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const LiveSessionModel = model("LiveSession", LiveSessionSchema);

const AttendanceSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
});
export const AttendanceModel = model("Attendance", AttendanceSchema);

const MessageSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: String,
    role: String,
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);
export const MessageModel = model("Message", MessageSchema);

// --- Payments (mock provider, Phase 6 revenue) ---
const PaymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    amountCents: { type: Number, required: true },
    provider: { type: String, default: "mock" },
  },
  { timestamps: true }
);
export const PaymentModel = model("Payment", PaymentSchema);

export { mongoose };
