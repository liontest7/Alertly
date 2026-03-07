import { PrismaClient } from "@prisma/client";
import { requireEnv } from "@/lib/env";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

// Test connection on startup
if (process.env.NODE_ENV !== "production") {
  prisma.$connect()
    .then(() => console.log("Successfully connected to Database"))
    .catch((err) => {
      console.error("CRITICAL: Failed to connect to Database. Please check your DATABASE_URL secret.");
      console.error(err);
    });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
