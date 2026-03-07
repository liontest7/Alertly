import { PrismaClient } from "@prisma/client";
import { requireEnv } from "@/lib/env";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
    ...(process.env.DATABASE_URL ? {} : {
      datasourceUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres"
    })
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
