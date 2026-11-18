import { PrismaClient, Prisma } from "@prisma/client";

/**
 * One client per process. Neon: DATABASE_URL is the pooled (-pooler) connection string used at runtime,
 * DIRECT_URL is the direct connection string used only by `prisma migrate` (see schema.prisma).
 */
const g = globalThis as unknown as { __learnlyPrisma?: PrismaClient };
export const prisma = g.__learnlyPrisma ?? new PrismaClient({ log: [{ level: "warn", emit: "stdout" }, { level: "error", emit: "stdout" }] });
g.__learnlyPrisma = prisma;

export { Prisma };
export * from "@prisma/client";
