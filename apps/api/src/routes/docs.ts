import { Router } from "express";

export const docsRouter = Router();

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Learnly API",
    version: "1.0.0",
    description: "REST API for Learnly Calm EdTech Platform with Live Classes",
  },
  paths: {
    "/api/auth/register": {
      post: {
        summary: "Register new user",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string" },
                  role: { type: "string", enum: ["student", "instructor", "admin"] },
                },
                required: ["name", "email", "password"],
              },
            },
          },
        },
        responses: { 201: { description: "User registered" } },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login and obtain JWT + refresh token cookie",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: { 200: { description: "Logged in" } },
      },
    },
    "/api/auth/refresh": {
      post: {
        summary: "Rotate refresh token cookie and issue new access token",
        responses: { 200: { description: "Token rotated" } },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Get current authenticated user profile",
        responses: { 200: { description: "User profile" } },
      },
    },
    "/api/courses": {
      get: {
        summary: "List published courses",
        responses: { 200: { description: "Courses list" } },
      },
    },
    "/api/courses/{id}": {
      get: {
        summary: "Get course curriculum and overview",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Course details" } },
      },
    },
    "/api/healthz": {
      get: {
        summary: "Liveness probe",
        responses: { 200: { description: "Server is alive" } },
      },
    },
    "/api/readyz": {
      get: {
        summary: "Readiness probe for Mongo, Redis, S3, LiveKit",
        responses: { 200: { description: "Server is ready" }, 503: { description: "Unhealthy components" } },
      },
    },
  },
};

docsRouter.get("/schema", (_req, res) => {
  res.json(openApiSpec);
});

docsRouter.get("/", (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Learnly API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin: 0;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/schema',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>
  `);
});
