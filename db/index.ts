import * as schema from "@db/schema";
import { createDatabaseClient, getDatabaseConfig } from './config';
const config = getDatabaseConfig();
/**
 * Database client with proper error handling and connection management
 */
class DatabaseClient {
  private static instance: ReturnType<typeof createDatabaseClient>;
  public static getInstance() {
    if (!this.instance) {
      try {
        this.instance = createDatabaseClient(config);
        console.log("Database connection established successfully");
      } catch (error) {
        console.error("Failed to initialize database connection:", error);
        throw new Error("Database connection failed");
      }
    }
    return this.instance;
  }
}
// Export the database instance
export const db = DatabaseClient.getInstance();
/**
 * Utility function to handle database pagination
 */
export function getPaginationParams(page: number = 1, pageSize: number = 20) {
  const offset = (page - 1) * pageSize;
  return {
    offset,
    limit: pageSize,
  };
}
/**
 * Utility function to generate query filters
 */
export function generateQueryFilters<T extends Record<string, any>>(filters: T) {
  const validFilters: Partial<T> = {};
  // Remove undefined or null values
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      validFilters[key as keyof T] = value;
    }
  });
  return validFilters;
}
// Export type for use in other modules
export type Database = ReturnType<typeof DatabaseClient.getInstance>;