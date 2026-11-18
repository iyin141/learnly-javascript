import { refreshSession } from "./refresh";
import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { RootState } from "./index";
import { BASE } from "./basePath";
import { setCredentials, logoutAction } from "./authSlice";
import type {
  User,
  Course,
  Enrolment,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  Playback,
  QuizSummary,
  AttemptStart,
  AttemptResult,
  CertificateInfo,
  LiveSessionInfo,
} from "@learnly/shared";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${BASE}/api`,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try refreshing the token using the HttpOnly cookie
    const data = await refreshSession();

    if (data) {
      api.dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
      // Retry original query
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logoutAction());
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["User", "Courses", "Course", "MyCourses", "Quizzes", "Certificates", "Live", "Admin", "Instructor"],
  endpoints: (builder) => ({
    // Auth
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
        } catch {}
      },
      invalidatesTags: ["User", "MyCourses"],
    }),
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
        } catch {}
      },
      invalidatesTags: ["User", "MyCourses"],
    }),
    logout: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(logoutAction());
        } catch {}
      },
      invalidatesTags: ["User", "MyCourses"],
    }),
    getMe: builder.query<{ user: User }, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),

    // Courses
    getCourses: builder.query<{ courses: Course[] }, void>({
      query: () => "/courses",
      providesTags: ["Courses"],
    }),
    getCourse: builder.query<{ course: Course; enrolment: Enrolment | null }, string>({
      query: (id) => `/courses/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Course", id }],
    }),
    enrollCourse: builder.mutation<{ message: string; enrolment: Enrolment }, string>({
      query: (courseId) => ({
        url: `/courses/${courseId}/enroll`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => ["MyCourses", { type: "Course", id }],
    }),
    checkoutCourse: builder.mutation<{ status: "paid" | "pending"; paymentId: string; checkoutUrl?: string; provider: string }, string>({
      query: (courseId) => ({ url: `/courses/${courseId}/checkout`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => ["MyCourses", { type: "Course", id }],
    }),
    getMyCourses: builder.query<
      {
        enrolments: {
          enrolmentId: string;
          status: string;
          progressPercent: number;
          completedCount: number;
          totalLessons: number;
          lastPositionSeconds?: number;
          course: Course;
        }[];
      },
      string | void
    >({
      query: (status) => (status ? `/my-courses?status=${status}` : "/my-courses"),
      providesTags: ["MyCourses"],
    }),
    // Lessons / playback
    getPlayback: builder.query<Playback, string>({
      query: (lessonId) => `/lessons/${lessonId}/playback`,
      keepUnusedDataFor: 0,
    }),
    saveProgress: builder.mutation<
      { progressPercent: number; completed: boolean },
      { lessonId: string; positionSeconds: number }
    >({
      query: ({ lessonId, positionSeconds }) => ({
        url: `/lessons/${lessonId}/progress`,
        method: "POST",
        body: { positionSeconds },
      }),
      invalidatesTags: (r) => (r?.completed ? ["MyCourses"] : []),
    }),
    markComplete: builder.mutation<{ progressPercent: number }, string>({
      query: (lessonId) => ({ url: `/lessons/${lessonId}/complete`, method: "POST" }),
      invalidatesTags: ["MyCourses", "Course"],
    }),

    // Quizzes
    getCourseQuizzes: builder.query<{ quizzes: QuizSummary[] }, string>({
      query: (courseId) => `/courses/${courseId}/quizzes`,
      providesTags: ["Quizzes"],
    }),
    getQuiz: builder.query<{ quiz: QuizSummary }, string>({
      query: (id) => `/quizzes/${id}`,
      providesTags: ["Quizzes"],
    }),
    startAttempt: builder.mutation<AttemptStart, string>({
      query: (quizId) => ({ url: `/quizzes/${quizId}/attempts`, method: "POST" }),
      invalidatesTags: ["Quizzes"],
    }),
    saveAnswer: builder.mutation<{ ok: boolean }, { attemptId: string; questionId: string; answer: unknown; flagged?: boolean }>({
      query: ({ attemptId, ...body }) => ({ url: `/attempts/${attemptId}/answers`, method: "PUT", body }),
    }),
    submitAttempt: builder.mutation<AttemptResult, string>({
      query: (attemptId) => ({ url: `/attempts/${attemptId}/submit`, method: "POST" }),
      invalidatesTags: ["Quizzes", "MyCourses", "Certificates"],
    }),

    // Certificates
    getCertificates: builder.query<{ certificates: CertificateInfo[] }, void>({
      query: () => "/certificates",
      providesTags: ["Certificates"],
    }),
    getCertificate: builder.query<{ certificate: CertificateInfo }, string>({
      query: (id) => `/certificates/${id}`,
      providesTags: ["Certificates"],
    }),
    getCertificateDownload: builder.query<{ url: string }, string>({
      query: (id) => `/certificates/${id}/download`,
      keepUnusedDataFor: 0,
    }),
    verifyCertificate: builder.query<{ valid: boolean; certificate?: CertificateInfo }, string>({
      query: (code) => `/verify/${code}`,
    }),

    // Instructor
    getInstructorCourses: builder.query<{ courses: { id: string; title: string; code: string; status: string; lessons: number; students: number }[] }, void>({
      query: () => "/instructor/courses",
      providesTags: ["Instructor"],
    }),
    createCourse: builder.mutation<{ course: { id: string; title: string; code: string; status: string } }, { title: string; code: string; term?: string; description?: string; subjectColor?: string; priceCents?: number }>({
      query: (body) => ({ url: "/instructor/courses", method: "POST", body }),
      invalidatesTags: ["Instructor"],
    }),
    submitForReview: builder.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/instructor/courses/${id}/submit`, method: "POST" }),
      invalidatesTags: ["Instructor"],
    }),
    getRevenue: builder.query<{ rows: { courseId: string; course: string; month: string; enrolments: number; earningsCents: number; grossCents: number }[]; totalEnrolments: number; totalEarningsCents: number; totalGrossCents: number }, void>({
      query: () => "/instructor/revenue",
    }),
    createQuiz: builder.mutation<{ quiz: QuizSummary }, { courseId: string; body: unknown }>({
      query: ({ courseId, body }) => ({ url: `/courses/${courseId}/quizzes`, method: "POST", body }),
      invalidatesTags: ["Quizzes"],
    }),
    getQuizAnalytics: builder.query<{ attempts: number; passRate: number | null; avgScorePercent: number | null; perQuestion: { questionId: string; prompt: string; answered: number; correctRate: number | null }[] }, string>({
      query: (id) => `/quizzes/${id}/analytics`,
    }),

    // Admin
    getAdminUsers: builder.query<{ users: { id: string; name: string; email: string; role: string }[] }, void>({
      query: () => "/admin/users",
      providesTags: ["Admin"],
    }),
    setUserRole: builder.mutation<unknown, { id: string; role: string }>({
      query: ({ id, role }) => ({ url: `/admin/users/${id}`, method: "PATCH", body: { role } }),
      invalidatesTags: ["Admin"],
    }),
    getAdminCourses: builder.query<{ courses: { id: string; title: string; code: string; status: string; instructorName: string }[] }, string>({
      query: (status) => `/admin/courses?status=${status}`,
      providesTags: ["Admin"],
    }),
    decideCourse: builder.mutation<unknown, { id: string; approve: boolean }>({
      query: ({ id, approve }) => ({ url: `/admin/courses/${id}/decision`, method: "POST", body: { approve } }),
      invalidatesTags: ["Admin", "Courses"],
    }),
    getAdminReports: builder.query<Record<string, number>, void>({
      query: () => "/admin/reports",
    }),

    // Live
    getLiveSessions: builder.query<{ sessions: LiveSessionInfo[] }, void>({
      query: () => "/live",
      providesTags: ["Live"],
    }),
    getLiveSession: builder.query<{ session: LiveSessionInfo }, string>({
      query: (id) => `/live/${id}`,
      providesTags: ["Live"],
    }),
    startLiveSession: builder.mutation<{ session: LiveSessionInfo }, string>({
      query: (id) => ({ url: `/live/${id}/start`, method: "POST" }),
      invalidatesTags: ["Live"],
    }),
    endLiveSession: builder.mutation<{ session: LiveSessionInfo }, string>({
      query: (id) => ({ url: `/live/${id}/end`, method: "POST" }),
      invalidatesTags: ["Live"],
    }),
    joinLiveByCode: builder.mutation<{ session: LiveSessionInfo }, string>({
      query: (code) => ({ url: `/live/join-by-code`, method: "POST", body: { code } }),
    }),
    getLiveMessages: builder.query<{ messages: { id: string; userName: string; role?: string; text: string }[] }, string>({
      query: (id) => `/live/${id}/messages`,
      keepUnusedDataFor: 0,
    }),
    postLiveMessage: builder.mutation<{ id: string }, { id: string; text: string }>({
      query: ({ id, text }) => ({ url: `/live/${id}/messages`, method: "POST", body: { text } }),
    }),
    grantMic: builder.mutation<{ ok: boolean }, { id: string; identity: string; allow: boolean }>({
      query: ({ id, ...body }) => ({ url: `/live/${id}/grant`, method: "POST", body }),
    }),
    leaveLive: builder.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/live/${id}/leave`, method: "POST" }),
    }),
    scheduleLive: builder.mutation<{ session: LiveSessionInfo }, { courseId: string; title: string; startsAt: string; durationMinutes: number }>({
      query: ({ courseId, ...body }) => ({ url: `/courses/${courseId}/live`, method: "POST", body }),
      invalidatesTags: ["Live"],
    }),
    getLiveToken: builder.mutation<{ token: string; url: string; canPublish: boolean }, string>({
      query: (id) => ({ url: `/live/${id}/token`, method: "POST" }),
    }),
  }),
});

export const {
  useCreateCourseMutation,
  useGetPlaybackQuery,
  useSaveProgressMutation,
  useMarkCompleteMutation,
  useGetCourseQuizzesQuery,
  useGetQuizQuery,
  useStartAttemptMutation,
  useSaveAnswerMutation,
  useSubmitAttemptMutation,
  useGetCertificatesQuery,
  useGetCertificateQuery,
  useLazyGetCertificateDownloadQuery,
  useVerifyCertificateQuery,
  useGetInstructorCoursesQuery,
  useSubmitForReviewMutation,
  useGetRevenueQuery,
  useCreateQuizMutation,
  useGetQuizAnalyticsQuery,
  useGetAdminUsersQuery,
  useSetUserRoleMutation,
  useGetAdminCoursesQuery,
  useDecideCourseMutation,
  useGetAdminReportsQuery,
  useGetLiveSessionsQuery,
  useGetLiveSessionQuery,
  useStartLiveSessionMutation,
  useEndLiveSessionMutation,
  useJoinLiveByCodeMutation,
  useGetLiveTokenMutation,
  useGetLiveMessagesQuery,
  usePostLiveMessageMutation,
  useGrantMicMutation,
  useLeaveLiveMutation,
  useScheduleLiveMutation,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
  useGetCoursesQuery,
  useGetCourseQuery,
  useEnrollCourseMutation,
  useCheckoutCourseMutation,
  useGetMyCoursesQuery,
} = apiSlice;
