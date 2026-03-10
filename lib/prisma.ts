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

    const pool = new pg.Pool({ 
      connectionString: 'postgresql://postgres:password@helium:5432/heliumdb',
      ssl: false,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
