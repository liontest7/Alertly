import { PrismaClient } from "@prisma/client";

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

    // Strip whitespace and validate
    const cleanConnectionString = connectionString.trim();
    if (!cleanConnectionString) {
      throw new Error("DATABASE_URL is empty after trimming");
    }

    // Validate URL format for Render/external databases
    if (!cleanConnectionString.startsWith('postgres://') && !cleanConnectionString.startsWith('postgresql://')) {
      throw new Error("Invalid DATABASE_URL format - must start with postgres:// or postgresql://");
    }

    const client = new PrismaClient({
      datasources: {
        db: {
          url: cleanConnectionString
        }
      }
    });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }

    return client;
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error instanceof Error ? error.message : error);
    throw error;
  }
})();
