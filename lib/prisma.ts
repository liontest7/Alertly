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
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || "5432"),
      user: process.env.PGUSER || 'postgres',
      password: String(process.env.PGPASSWORD || 'password'),
      database: process.env.PGDATABASE || 'heliumdb',
      ssl: false,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
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
