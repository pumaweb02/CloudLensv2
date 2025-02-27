import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type DatabaseConfig = {
  connectionString: string;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
  query: {
    connectTimeout: number;
  };
};

// Default configuration for development
const developmentConfig: DatabaseConfig = {
  connectionString: process.env.DATABASE_URL || "postgresql://phaedrasolutions:1234@localhost:5432/postgres",
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  query: {
    connectTimeout: 10000,
  },
};

// Production configuration with optimized settings
const productionConfig: DatabaseConfig = {
  connectionString: process.env.DATABASE_URL!,
  pool: {
    min: 5,
    max: 20,
    idleTimeoutMillis: 60000,
  },
  query: {
    connectTimeout: 15000,
  },
};

// Get configuration based on environment
export const getDatabaseConfig = (): DatabaseConfig => {
  return process.env.NODE_ENV === "production" ? productionConfig : developmentConfig;
};

// Create and configure database client
export const createDatabaseClient = (config: DatabaseConfig) => {
  const client = postgres(config.connectionString, {
    max: config.pool.max,
    idle_timeout: config.pool.idleTimeoutMillis,
    connect_timeout: config.query.connectTimeout,
    prepare: true,
  });

  return drizzle(client);
};