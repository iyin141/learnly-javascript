import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { RootState } from "./index";
import { setCredentials, logoutAction } from "./authSlice";
import type {
  User,
  Course,
  Enrolment,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from "@learnly/shared";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
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
    const refreshResult = await rawBaseQuery(
      { url: "/auth/refresh", method: "POST" },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      const data = refreshResult.data as AuthResponse;
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
  tagTypes: ["User", "Courses", "Course", "MyCourses"],
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
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
  useGetCoursesQuery,
  useGetCourseQuery,
  useEnrollCourseMutation,
  useGetMyCoursesQuery,
} = apiSlice;
