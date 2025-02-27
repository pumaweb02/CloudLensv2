import { db } from "@db";
import { properties, photos, inspections, scan_batches } from "@db/schema";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = "uploads";
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, "thumbnails");
const CHUNK_DIR = path.join(UPLOAD_DIR, "chunks");

async function clearDirectory(dir: string) {
  try {
    await fs.access(dir);
    const files = await fs.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await clearDirectory(filePath);
        await fs.rmdir(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
    console.log(`Cleared directory: ${dir}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function cleanupDatabase() {
  try {
    // Use direct SQL for more reliable cleanup
    await db.execute(
      `UPDATE properties SET is_deleted = true;
       UPDATE photos SET is_deleted = true;
       UPDATE scan_batches SET is_deleted = true;`
    );

    console.log("Database cleanup completed successfully");
  } catch (error) {
    console.error("Database cleanup failed:", error);
    throw error;
  }
}

async function cleanup() {
  try {
    console.log("Starting system cleanup...");

    // Clear uploads directory
    await clearDirectory(UPLOAD_DIR);

    // Clear thumbnails directory
    await clearDirectory(THUMBNAIL_DIR);

    // Clear chunks directory
    await clearDirectory(CHUNK_DIR);

    // Clean up database
    await cleanupDatabase();

    // Recreate necessary directories
    await Promise.all([
      fs.mkdir(UPLOAD_DIR, { recursive: true }),
      fs.mkdir(THUMBNAIL_DIR, { recursive: true }),
      fs.mkdir(CHUNK_DIR, { recursive: true })
    ]);

    console.log("System cleanup completed successfully");
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
}

// Run cleanup
cleanup();