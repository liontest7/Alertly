import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createAdapter() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.warn("[Prisma] No DATABASE_URL found, Prisma will use default behavior");
    return undefined;
  }

  try {
    return new PrismaPg(new pg.Pool({ 
      connectionString,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    }));
  } catch (error) {
    console.error("[Prisma] Failed to create adapter:", error);
    return undefined;
  }
}

export const createPrismaClient = () => {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
};
