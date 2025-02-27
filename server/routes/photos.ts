import { Router, Request, Response, NextFunction } from "express";
import { PhotoProcessingService } from "../services/photo-processing";
import { db } from "@db";
import { photos } from "@db/schema";
import { eq } from "drizzle-orm";

// Add proper authentication middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: "admin" | "user";
  };
}

// Middleware to check if user is authenticated
const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized", message: "Not logged in" });
};

const router = Router();
const photoProcessingService = new PhotoProcessingService();

// Process a single photo
router.post(
  "/photos/:id/process",
  isAuthenticated,
  async (req: AuthenticatedRequest, res) => {
    try {
      const photoId = parseInt(req.params.id);
      await photoProcessingService.processPhoto(photoId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error processing photo:", error);
      res.status(500).json({ error: "Failed to process photo" });
    }
  }
);

// Process all pending photos
router.post(
  "/photos/process-pending",
  isAuthenticated,
  async (req: AuthenticatedRequest, res) => {
    try {
      await photoProcessingService.processPendingPhotos();
      res.json({ success: true });
    } catch (error) {
      console.error("Error processing pending photos:", error);
      res.status(500).json({ error: "Failed to process pending photos" });
    }
  }
);

// Get photo processing status
router.get(
  "/photos/:id/status",
  isAuthenticated,
  async (req: AuthenticatedRequest, res) => {
    try {
      const photoId = parseInt(req.params.id);
      const photo = await db.query.photos.findFirst({
        where: eq(photos.id, photoId),
        columns: {
          processing_status: true,
          property_match_confidence: true,
          property_id: true,
          metadata: true,
        },
      });

      if (!photo) {
        return res.status(404).json({ error: "Photo not found" });
      }

      res.json(photo);
    } catch (error) {
      console.error("Error getting photo status:", error);
      res.status(500).json({ error: "Failed to get photo status" });
    }
  }
);

export default router;