import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel, CourseModel, SectionModel, LessonModel, EnrolmentModel } from "../apps/api/src/db.js";
import { QuizModel, QuestionModel, AttemptModel, CertificateModel, LiveSessionModel, PaymentModel } from "../apps/api/src/db-learning.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/learnly";

async function seed() {
  console.log("Connecting to MongoDB at:", MONGO_URI);
  await mongoose.connect(MONGO_URI);

  console.log("Clearing existing database collections...");
  await UserModel.deleteMany({});
  await CourseModel.deleteMany({});
  await SectionModel.deleteMany({});
  await LessonModel.deleteMany({});
  await EnrolmentModel.deleteMany({});
  for (const m of [QuizModel, QuestionModel, AttemptModel, CertificateModel, LiveSessionModel, PaymentModel]) await m.deleteMany({});

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);

  console.log("Creating default users...");
  // 1. Admin
  const admin = await UserModel.create({
    name: "System Admin",
    email: "admin@learnly.local",
    passwordHash,
    role: "admin",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuD40m8siZ1abSwcGwZFpPJDggoNopEPBjTNNldQxhS-1blQU7EM4FXPm2slSWw5iAepZ-EjRG0ERhTNuNk5Sjf4_uPUF1VONuZQQMxpdj_emX6lAXkDLPkjnGW8lqqX8C785DVTCGBQfjQiEO1L58v7adewcjXLGdeMcPILoGiVN9wB3jCnFsnzCcHxOepuuPpFzSF1i3YlUJVY7Gp8rTnbX1XB4wmw0gv2iAe-gDU",
  });

  // 2. Three Instructors
  const instructor1 = await UserModel.create({
    name: "Prof. Alan Vance",
    email: "instructor@learnly.local",
    passwordHash,
    role: "instructor",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDQoj2qmCuaTndBWjotVyZ2a7wsGIygwx2O63Ekc7Jb6kXKwI4QbaIAig7JNyZUX7AiKwltHmEb_k8snWpkvccUOw0qOxcvv9filMjTdSG_tvczu7cqHg6qUK8V1xpYeC_EGg8c4wpJQfAPog278y4Q4DoV76_X_M3BF-2NMeAvOSEsQWRwWG5LIbQOtnKXcK7C7NPRnXzbmXFyesari4b4pEm_tdYzWUHDLkbzmus",
  });

  const instructor2 = await UserModel.create({
    name: "Elena Rostova",
    email: "elena@learnly.local",
    passwordHash,
    role: "instructor",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBef8-L1RngA4tE3OWgiip0dHYwdJcZ_8QzsfBuuw5HLoFDWPAzIihwFjIUAnTIbLXOnEnS_GY5gxOxA5f-bOmcxuPBNEMFRNVFZZEruPacex7ZcCmOLQkUuNjXOVCPEm1-DfX5KR5z2EVkrznNPTgynIy0dHcv0WAPcMj11n6B90-3Svwfreu1n4PMrDLlr2eyb_dLbiQ8XM_5rYd2KhDRAqnSAVKjaDLGOuekYZQ",
  });

  const instructor3 = await UserModel.create({
    name: "Dr. Marcus Chen",
    email: "marcus@learnly.local",
    passwordHash,
    role: "instructor",
  });

  // 3. Students
  const primaryStudent = await UserModel.create({
    name: "Alex Johnson",
    email: "student@learnly.local",
    passwordHash,
    role: "student",
  });

  for (let i = 2; i <= 25; i++) {
    await UserModel.create({
      name: `Student ${i}`,
      email: `student${i}@learnly.local`,
      passwordHash,
      role: "student",
    });
  }

  console.log("Creating 6 courses...");
  const course1 = await CourseModel.create({
    title: "CS 101: Python & Algorithms",
    code: "CS 101",
    term: "Fall 2026",
    sectionName: "Section 02",
    description: "Introduction to Python programming, computational thinking, and algorithms.",
    instructorId: instructor1._id,
    status: "published",
    subjectColor: "blue",
    estimatedHours: 40,
    isLiveNow: true,
    upcomingLiveTitle: "Object-Oriented Python & Data Structures",
    upcomingLiveDate: new Date(Date.now() + 25 * 60 * 1000),
  });

  const course2 = await CourseModel.create({
    title: "UX 204: Interaction Design",
    code: "UX 204",
    term: "Fall 2026",
    sectionName: "Studio A",
    description: "Designing intuitive interfaces, interaction heuristics, and design systems.",
    instructorId: instructor2._id,
    status: "published",
    subjectColor: "coral",
    estimatedHours: 35,
  });

  const course3 = await CourseModel.create({
    title: "BIO 110: Genetics & Genomics",
    code: "BIO 110",
    term: "Fall 2026",
    sectionName: "Lab 04",
    description: "Molecular genetics, heredity, gene editing, and contemporary bioethics.",
    instructorId: instructor3._id,
    status: "published",
    subjectColor: "teal",
    estimatedHours: 45,
  });

  const course4 = await CourseModel.create({
    title: "DATA 301: Machine Learning Basics",
    code: "DATA 301",
    term: "Fall 2026",
    sectionName: "Cohort B",
    description: "Supervised and unsupervised learning, model validation, and metrics.",
    instructorId: instructor1._id,
    status: "published",
    subjectColor: "purple",
    estimatedHours: 50,
  });

  const course5 = await CourseModel.create({
    title: "HIST 210: Global Economic History",
    code: "HIST 210",
    term: "Fall 2026",
    sectionName: "Section 01",
    description: "Trade routes, monetary systems, and economic revolutions from 1500 to present.",
    instructorId: instructor2._id,
    status: "published",
    subjectColor: "amber",
    estimatedHours: 30,
  });

  const course6 = await CourseModel.create({
    title: "ENG 105: Technical Communication",
    code: "ENG 105",
    term: "Fall 2026",
    sectionName: "Section 03",
    description: "Clear writing, API documentation, research papers, and technical proposals.",
    instructorId: instructor3._id,
    status: "published",
    subjectColor: "slate",
    estimatedHours: 25,
  });

  console.log("Creating curriculum sections and lessons for CS 101...");
  const sec1 = await SectionModel.create({ courseId: course1._id, title: "Unit 1: Python Fundamentals", order: 1 });
  const sec2 = await SectionModel.create({ courseId: course1._id, title: "Unit 2: Control Flow & Functions", order: 2 });
  const sec3 = await SectionModel.create({ courseId: course1._id, title: "Unit 3: Data Structures", order: 3 });
  const sec4 = await SectionModel.create({ courseId: course1._id, title: "Unit 4: Recursion & Algorithms", order: 4 });

  const les1 = await LessonModel.create({
    courseId: course1._id,
    sectionId: sec1._id,
    title: "1.1 Setting up Python 3 and VSCode",
    type: "video",
    order: 1,
    durationSeconds: 720,
    video: { status: "ready", durationSeconds: 720 },
  });
  const les2 = await LessonModel.create({
    courseId: course1._id,
    sectionId: sec1._id,
    title: "1.2 Variables, Expressions & Types",
    type: "video",
    order: 2,
    durationSeconds: 900,
    video: { status: "ready", durationSeconds: 900 },
  });
  const les3 = await LessonModel.create({
    courseId: course1._id,
    sectionId: sec4._id,
    title: "4.1 Introduction to Call Stacks",
    type: "video",
    order: 1,
    durationSeconds: 840,
    video: { status: "ready", durationSeconds: 840 },
  });

  console.log("Enrolling primary student in courses with partial progress...");
  await EnrolmentModel.create({
    userId: primaryStudent._id,
    courseId: course1._id,
    status: "active",
    progressPercent: 68,
    completedLessons: [les1._id, les2._id],
    lastLessonId: les3._id,
    lastPositionSeconds: 120,
  });

  await EnrolmentModel.create({
    userId: primaryStudent._id,
    courseId: course2._id,
    status: "active",
    progressPercent: 42,
    completedLessons: [],
  });

  await EnrolmentModel.create({
    userId: primaryStudent._id,
    courseId: course3._id,
    status: "active",
    progressPercent: 85,
    completedLessons: [],
  });

  await EnrolmentModel.create({
    userId: primaryStudent._id,
    courseId: course4._id,
    status: "active",
    progressPercent: 20,
    completedLessons: [],
  });

  console.log("\n==================================================");
  console.log("SEEDING COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
  console.log("Demo logins (Password for all: password123):");
  console.log("  Student:    student@learnly.local");
  console.log("  Instructor: instructor@learnly.local");
  console.log("  Admin:      admin@learnly.local");
  console.log("==================================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
