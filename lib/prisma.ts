export const prisma = new Proxy({} as any, {
  get() {
    throw new Error("Database has been removed. All data is now stored in browser cookies/localStorage.");
  },
});
