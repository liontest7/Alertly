import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL not set");
  }

  try {
    const connectionString = process.env.DATABASE_URL || "postgresql://alertly_postgres_user:sNJ9TdJe29bZSYccrdRZebvnUik3rNNt@dpg-d6llhc15pdvs7381e920-a.oregon-postgres.render.com/alertly_postgres?sslmode=require";
    
    const adapter = new PrismaPg({ 
      connectionString: connectionString
    });
    
    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }

    return client;
  } catch (error) {
    console.error("Prisma init error:", error);
    throw error;
  }
})();
