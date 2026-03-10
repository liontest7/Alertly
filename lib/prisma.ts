import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Ensure connectionString is a valid string
    if (typeof connectionString !== 'string') {
      throw new Error(`DATABASE_URL must be a string, got ${typeof connectionString}`);
    }

    // Strip whitespace
    const cleanConnectionString = connectionString.trim();
    if (!cleanConnectionString) {
      throw new Error("DATABASE_URL is empty after trimming");
    }

    // Create pool with minimal, safe configuration
    const pool = new pg.Pool({
      connectionString: cleanConnectionString
    });

    // Ensure pool errors don't crash the app
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client in pool:', err);
    });

    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }

    return client;
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error instanceof Error ? error.message : error);
    throw error;
  }
})();
