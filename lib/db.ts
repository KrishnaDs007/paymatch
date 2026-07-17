import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  if (!databaseUrl.includes("pooler.supabase.com") || databaseUrl.includes("pgbouncer=true")) {
    return databaseUrl;
  }

  const separator = databaseUrl.includes("?") ? "&" : "?";

  return `${databaseUrl}${separator}pgbouncer=true`;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
