import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return undefined;
  }

  return new PrismaPg(new pg.Pool({ 
    connectionString: 'postgresql://postgres:password@helium:5432/heliumdb',
    ssl: false,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }));
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
