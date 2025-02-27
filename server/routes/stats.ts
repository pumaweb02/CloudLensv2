import express from 'express';
import { db } from '@db';
import { photos, properties } from '@db/schema';
import { sql } from 'drizzle-orm';

const router = express.Router();

router.get('/api/stats', async (req, res) => {
  try {
    // Get total active properties
    const [{ count: totalProperties }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(sql`is_deleted = false`);

    // Get total active photos
    const [{ count: totalPhotos }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(sql`is_deleted = false AND processing_status = 'processed'`);

    // Calculate average photos per property
    const avgPhotosPerProperty = totalProperties > 0 
      ? Number((totalPhotos / totalProperties).toFixed(1))
      : 0;

    // Get total inspections (properties with status 'inspected')
    const [{ count: totalInspections }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(sql`status = 'inspected' AND is_deleted = false`);

    // Get properties by status (only active properties)
    const propertiesByStatus = await db
      .select({
        status: properties.status,
        count: sql<number>`count(*)`
      })
      .from(properties)
      .where(sql`is_deleted = false`)
      .groupBy(properties.status);

    // Get recent activity (recently updated non-deleted properties)
    const recentActivity = await db
      .select({
        id: properties.id,
        address: properties.address,
        status: properties.status,
        updatedAt: properties.updatedAt
      })
      .from(properties)
      .where(sql`is_deleted = false`)
      .orderBy(sql`updated_at desc`)
      .limit(5);

    res.json({
      totalProperties,
      totalPhotos,
      avgPhotosPerProperty,
      totalInspections,
      propertiesByStatus,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;