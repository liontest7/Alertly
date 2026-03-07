import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { requireEnv } from "@/lib/env";

const connectionString = requireEnv("DATABASE_URL", {
  allowInDev: true,
  devFallback: "postgresql://postgres:postgres@localhost:5432/alertly",
});

const pool = new Pool({ 
  connectionString: typeof connectionString === 'string' ? connectionString : undefined,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
