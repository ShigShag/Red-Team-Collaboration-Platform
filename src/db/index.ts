import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Configure connection pool based on environment
const poolConfig = {
  max: process.env.NODE_ENV === "production" ? 20 : 5, // More in prod, fewer in dev
  idle_timeout: 20, // Close idle connections after 20s
  max_lifetime: 60 * 30, // Rotate connections every 30 minutes
  connect_timeout: 10, // Fail fast on connection issues
};

// Singleton pattern to prevent hot-reload leaks in development
function createClient() {
  if (process.env.NODE_ENV === "development") {
    // In development, reuse existing client across hot-reloads
    if (!(globalThis as any).__dbClient) {
      (globalThis as any).__dbClient = postgres(connectionString, poolConfig);
    }
    return (globalThis as any).__dbClient as postgres.Sql;
  }
  // In production, create client normally
  return postgres(connectionString, poolConfig);
}

export const client = createClient();
export const db = drizzle(client, { schema });

// Graceful shutdown — only in production (Next.js dev handles its own lifecycle)
if (process.env.NODE_ENV === "production") {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[DB] Received ${signal}, closing database connections...`);
    try {
      await client.end({ timeout: 5 });
      console.log("[DB] Database connections closed gracefully");
    } catch (error) {
      console.error("[DB] Error closing database connections:", error);
    }
    process.exit(0);
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
