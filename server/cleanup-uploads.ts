import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = "uploads";

async function cleanupUploads() {
  try {
    // Ensure directory exists
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      console.log('Created uploads directory');
      return;
    }

    // Recursively delete contents of upload directory
    async function removeContents(dirPath: string) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await removeContents(fullPath); // Recursively clean subdirectories
          await fs.rmdir(fullPath); // Remove empty directory
          console.log(`Removed directory: ${entry.name}`);
        } else {
          await fs.unlink(fullPath);
          console.log(`Deleted file: ${entry.name}`);
        }
      }
    }

    await removeContents(UPLOAD_DIR);
    console.log('Cleanup complete');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupUploads();