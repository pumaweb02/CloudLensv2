import express from 'express';
import { db } from '@db';
import { report_templates } from '@db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Get all templates
router.get('/api/report-templates', async (req, res) => {
  try {
    const templates = await db
      .select()
      .from(report_templates)
      .where(eq(report_templates.isDeleted, false));

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get template by ID
router.get('/api/report-templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const [template] = await db
      .select()
      .from(report_templates)
      .where(eq(report_templates.id, templateId))
      .where(eq(report_templates.isDeleted, false))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      error: 'Failed to fetch template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new template
router.post('/api/report-templates', async (req, res) => {
  try {
    const [template] = await db
      .insert(report_templates)
      .values({
        name: req.body.name,
        description: req.body.description,
        theme: req.body.theme,
        layout: req.body.layout,
        isDefault: req.body.isDefault,
        createdBy: req.user?.id,
      })
      .returning();

    res.json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update template
router.patch('/api/report-templates/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const [template] = await db
      .update(report_templates)
      .set({
        name: req.body.name,
        description: req.body.description,
        theme: req.body.theme,
        layout: req.body.layout,
        isDefault: req.body.isDefault,
        updatedAt: new Date(),
      })
      .where(eq(report_templates.id, templateId))
      .returning();

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
