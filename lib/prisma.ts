import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }

    // Always use simple pg.Pool for Replit/Helium environment to avoid pg-protocol errors
    const pool = new pg.Pool({ 
      connectionString,
      ssl: false
    });
    
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }

    return client;
  } catch (error) {
    console.error("Prisma init error:", error);
    throw error;
  }
})();
