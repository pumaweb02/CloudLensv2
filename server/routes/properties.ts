import express from "express";
import { db } from "@db";
import { properties, inspections, photos, reports } from "@db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";
import path from "path";
import QRCode from "qrcode";
import fs from "fs";
import { format } from "date-fns";
import { Request, Response } from "express";
import crypto from "crypto";

const router = express.Router();

// POST inspection report generation
router.post(
  "/api/properties/:id/inspections/:inspectionId/report",
  async (req, res) => {
    let doc: PDFKit.PDFDocument | null = null;

    try {
      const propertyId = parseInt(req.params.id);
      const inspectionId = parseInt(req.params.inspectionId);

      // Validate input parameters
      if (isNaN(propertyId) || isNaN(inspectionId)) {
        return res
          .status(400)
          .json({ error: "Invalid property or inspection ID" });
      }

      // Get the inspection data
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, inspectionId))
        .limit(1);

      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }

      // Get the property data
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Get all photos associated with this property that have metadata
      const inspectionPhotos = await db
        .select()
        .from(photos)
        .where(
          and(eq(photos.propertyId, propertyId), eq(photos.isDeleted, false))
        );

      const reportDetails = await db
        .select()
        .from(reports)
        .where(
          and(
            eq(reports.propertyId, propertyId),
            eq(reports.inspectionId, inspectionId)
          )
        );

      // Filter photos that have inspection metadata
      const photosWithMetadata = inspectionPhotos.filter(
        (photo) =>
          photo.metadata?.damageType &&
          photo.metadata?.severity &&
          photo.metadata?.notes
      );

      if (!photosWithMetadata || photosWithMetadata.length === 0) {
        return res
          .status(400)
          .json({ error: "No photos found for this inspection" });
      }

      // Create PDF document
      doc = new PDFDocument({
        size: "LETTER",
        margin: 50,
        bufferPages: true,
        info: {
          Title: `Property Inspection Report - ${property.address}`,
          Author: "CloudLens Professional Services",
          Subject: "Property Damage Assessment Report",
          Keywords: "inspection, property, damage assessment",
        },
      });

      // Create temporary file path for the PDF
      const tempDir = path.join(process.cwd(), "tmp");
      await fs.promises.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `report-${Date.now()}.pdf`);

      // Create write stream to temporary file
      const writeStream = fs.createWriteStream(tempFilePath);
      doc.pipe(writeStream);

      // Generate report content
      const reportData = {
        property,
        inspectionData: inspection,
        inspectionPhotos: photosWithMetadata,
        reportData: reportDetails,
      };
      await generateReport(doc, reportData);

      // End the document
      doc.end();

      // Wait for write stream to finish
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Send file as download
      const filename = `CloudLens-Assessment-${propertyId}-${format(
        new Date(),
        "yyyy-MM-dd"
      )}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Stream the file to response and clean up
      const readStream = fs.createReadStream(tempFilePath);
      readStream.pipe(res);

      readStream.on("end", () => {
        // Clean up temp file after streaming
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error("Error cleaning up temp PDF file:", err);
        });
      });
    } catch (error) {
      console.error("Error generating report:", error);

      // Clean up the document if it exists
      if (doc) {
        try {
          doc.end();
        } catch (cleanupError) {
          console.error("Error cleaning up PDF document:", cleanupError);
        }
      }

      // Only send error response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to generate report",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }
);

router.post("/api/properties/:id/inspection/photo", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: "Invalid property ID" });
    }

    const { photoIds, inspectionData } = req.body;
    if (!photoIds?.length || !inspectionData) {
      return res.status(400).json({ error: "Missing required data" });
    }

    const photoId = photoIds[0]; // We're processing one photo at a time

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // Handle edited image if present
    let editedImagePath = null;
    if (
      inspectionData.editedImage &&
      inspectionData.editedImage.includes("base64")
    ) {
      try {
        // Extract base64 data
        const matches = inspectionData.editedImage.match(
          /^data:([A-Za-z-+\/]+);base64,(.+)$/
        );
        if (matches && matches.length === 3) {
          const imageData = matches[2];
          const filename = `edited-${photoId}-${Date.now()}.png`;
          editedImagePath = path.join("uploads", filename);

          await fs.promises.writeFile(
            path.join(process.cwd(), editedImagePath),
            Buffer.from(imageData, "base64")
          );
        }
      } catch (imageError) {
        console.error(
          `Error saving edited image for photo ${photoId}:`,
          imageError
        );
        return res.status(500).json({
          error: "Failed to save edited image",
          details:
            imageError instanceof Error ? imageError.message : "Unknown error",
        });
      }
    }

    // Get existing photo data
    const [existingPhoto] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    if (!existingPhoto) {
      return res.status(404).json({ error: `Photo ${photoId} not found` });
    }

    // Update photo record with metadata
    const [updatedPhoto] = await db
      .update(photos)
      .set({
        storageLocation: editedImagePath || existingPhoto.storageLocation,
        metadata: {
          damageType: inspectionData.damageType,
          severity: inspectionData.severity,
          notes: inspectionData.notes,
          annotations: inspectionData.annotations || [],
          lines: inspectionData.lines || [],
        },
      })
      .where(eq(photos.id, photoId))
      .returning();

    if (!updatedPhoto) {
      throw new Error(`Failed to update photo record ${photoId}`);
    }

    res.json({
      success: true,
      photo: updatedPhoto,
    });
  } catch (error) {
    console.error("Error saving inspection photo:", error);
    res.status(500).json({
      error: "Failed to save inspection photo",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Helper functions for PDF generation
async function generateReport(
  doc: PDFKit.PDFDocument,
  reportData: { property: any; inspectionData: any; inspectionPhotos: any[] }
): Promise<void> {
  // Set document metadata
  doc.info.Title = `Property Inspection Report - ${reportData.property.address}`;
  doc.info.Author = "CloudLens Professional Services";
  doc.info.Subject = "Property Damage Assessment";
  doc.info.Keywords = "inspection, damage assessment, property report";

  // Set margins
  doc.page.margins = { top: 72, bottom: 72, left: 72, right: 72 };

  let firstPage = true;

  let shareReportUrl = reportData?.reportData[0]?.shareUrl || null;

  // Extract required data
  const reportId = reportData.inspectionData.id;
  let assessmentDate = "N/A";

  if (reportData.inspectionData.createdAt) {
    try {
      const parsedDate = new Date(reportData.inspectionData.createdAt);
      if (!isNaN(parsedDate.getTime())) {
        assessmentDate = format(parsedDate, "MMMM d, yyyy");
      }
    } catch (error) {
      console.error(
        "Invalid date format:",
        reportData.inspectionData.createdAt
      );
    }
  }

  // Add Header
  await addHeader(doc, shareReportUrl, reportId, assessmentDate);
  doc.moveDown(2);

  // Add urgent note only on the first page
  if (firstPage) {
    addUrgentNote(doc);
    doc.moveDown(2);
    firstPage = false; // Set flag to false after adding the urgent note
  }
  // Property Information
  addPropertyInformation(doc, reportData);
  doc.moveDown(2);

  addAssessmentDetails(doc, reportData);
  doc.moveDown(2);

  // // Damage Assessment Analysis
  // doc
  //   .fontSize(16)
  //   .font("Helvetica-Bold")
  //   .fillColor("#1a365d")
  //   .text("Damage Assessment Analysis", { align: "left" });

  // doc.moveDown(2);

  addDynamicDamageKeyPoints(doc, reportData.inspectionPhotos);
  doc.moveDown(2);
  // Process Photos in Grid Layout
  for (let i = 0; i < reportData.inspectionPhotos.length; i++) {
    const photo = reportData.inspectionPhotos[i];

    // Only add a new page if there's another photo to process
    if (
      doc.y > doc.page.height - 300 &&
      i < reportData.inspectionPhotos.length - 1
    ) {
      doc.addPage();
      await addHeader(
        doc,
        shareReportUrl,
        reportData.inspectionData.id,
        assessmentDate
      );
      doc.moveDown(2);
    }

    await addPhotoDetails(doc, photo, shareReportUrl);
    // addFooter(doc, 1, 1);
    doc.moveDown(2);
  }

  // Recommendations Section
  // if (reportData.inspectionData.metadata?.recommendations?.length) {
  //   addRecommendations(doc, reportData.inspectionData.metadata.recommendations);
  // }

  // Add Footer
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, range.count);
  }
}
function addAssessmentDetails(doc: PDFKit.PDFDocument, reportData: any) {
  // Overall Assessment Box
  const assessmentBoxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const assessmentPadding = 15;
  const assessmentHeight = 110;

  doc.save()
   .lineWidth(1) // Adjust thickness
   .roundedRect(doc.page.margins.left, doc.y, assessmentBoxWidth, assessmentHeight, 10)
   .fillAndStroke('#fff6f5', '#868686'); 

  doc.fillColor('#1a365d').fontSize(13);
  // font('Helvetica-Bold');
  doc.text('Overall Assessment', doc.page.margins.left + assessmentPadding, doc.y + assessmentPadding, {
    width: assessmentBoxWidth - (assessmentPadding * 2),
    align: 'center'
  });

  // doc.moveDown(0.5);
  doc.fillColor('#333333').fontSize(12).font('Helvetica');

  doc.text(
    `Assessment Classification: ${reportData.inspectionData.severity.charAt(0).toUpperCase()+reportData.inspectionData.severity.slice(1).toLowerCase()} - Immediate Attention Required\n` +
    `Pattern Type: ${reportData.inspectionData.damageType.charAt(0).toUpperCase()+ reportData.inspectionData.damageType.slice(1).toLowerCase()}-related damage patterns identified through aerial assessment.`,
    doc.page.margins.left + assessmentPadding, doc.y,
    { width: assessmentBoxWidth - (assessmentPadding * 2), align: 'left' }
  );

  doc.restore();
  doc.moveDown(6);

  // **Assessment Explanation Paragraph**
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#374151")
    .text(
      "During an aerial damage assessment conducted in your area, we identified signs of potential roof damage that require immediate attention. Below, you'll find images of the visible damage we detected on your property. " +
        "We strongly urge you to contact us right away for a comprehensive inspection and to initiate necessary repairs before the situation worsens.\n\n" +
        "Because this damage was caused by recent weather events, the majority of repairs may cost little to no money to you when addressed in a timely manner. " +
        "However, if left untreated, water damage can start accumulating in your roof, leading to costly structural issues that may no longer be covered by your insurance in the future.",
      { align: "left" }
    );

  doc.moveDown(2);

  // **Call to Action**s
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#044ad4")
    .text("Call NOW (800) 856-5632", { align: "center" });

  doc.moveDown(1);

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#374151")
    .text(
      "This assessment serves as a preliminary report to kickstart the repair process, ensuring your\n" +
      "home remains protected. Don't wait until it's too late! Call us now or scan the QR code above\n" +
      "to schedule an in-person appointment.",
      { align: "center" }
    );

  doc.moveDown(2);
}

function addPropertyInformation(doc: PDFKit.PDFDocument, reportData: any) {
  console.log("reportData--->>", reportData);

  // Header
  doc
    .fontSize(11)
    // .font("Helvetica-Bold")
    .fillColor("#1a365d")
    .text("Property Information:", doc.x - 45, doc.y);

  // Extract lender name (only show if available)
  const lenderName = reportData.property?.mortgageCompany?.trim();
  const showLender = lenderName && lenderName !== "No";

  // Define property details
  const ownerName = `${reportData.property?.owner1FirstName || "No"} ${reportData.property?.owner1LastName || ""}`.trim();
  const xLeft = doc.page.margins.left;
  const xRight = doc.page.width - doc.page.margins.right; // Right boundary
  let y = doc.y;

  // Set font and measure text width
  doc.fontSize(11).font("Helvetica-Bold");
  const ownerWidth = doc.widthOfString(ownerName);
  const lenderText = showLender ? `Lender: ${lenderName}` : "";
  const lenderWidth = showLender ? doc.widthOfString(lenderText) : 0;

  const paddingBetween = 20; // Space between owner and lender
  const paddingRight = 60; // Extra space after lender text
  const maxWidth = xRight - xLeft - paddingRight; // Ensure space at the end

  if (ownerWidth + lenderWidth + paddingBetween > maxWidth) {
    // If they don't fit in one line, move lender to the next line
    doc.fillColor("#1a365d").text(ownerName, xLeft, y);
    y += 13; // Move to next line
    if (showLender) {
      doc.fillColor("#374151").font("Helvetica").text(lenderText, xLeft, y);
    }
  } else {
    // If they fit, print in one line with padding
    doc.fillColor("#1a365d").text(ownerName, xLeft, y, { continued: true });

    // Set lender position with padding between and right padding
    const lenderX = xRight - lenderWidth - paddingRight;
    doc.fillColor("#374151").font("Helvetica").text(lenderText, lenderX, y);
  }

  y += 13; // Move down for property details

  // Display property details (left-aligned)
  doc.fillColor("#374151").font("Helvetica");
  const propertyValues = [
    `${reportData.property?.address || "No"},`,
    `${reportData.property?.city || "No"}, ${reportData.property?.state || "No"} ${reportData.property?.zipCode || "No"}`
  ];
  
  propertyValues.forEach((value) => {
    doc.text(value, xLeft, y, { width: maxWidth });
    y += 13; // Add spacing
  });
}



function addDynamicDamageKeyPoints(
  doc: PDFKit.PDFDocument,
  inspectionPhotos: any[]
) {
  const keyPoints: { [key: string]: number } = {};

  inspectionPhotos.forEach((photo) => {
    const damageType = photo.metadata?.damageType || "Unknown";
    keyPoints[damageType] = (keyPoints[damageType] || 0) + 1;
  });

  const colWidth =
    (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;
  let y = doc.y;

  Object.entries(keyPoints).forEach(([damageType, count], i) => {
    const x =
      i % 2 === 0 ? doc.page.margins.left : doc.page.margins.left + colWidth;
    if (i % 2 === 0 && i !== 0) y += 25;

    doc.y = y;
    doc.x = x;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#1a365d")
      .text(`${damageType}:`, { continued: true })
      .font("Helvetica")
      .fillColor("#374151")
      .text(` ${count} occurrences`);
  });

  doc.moveDown(1);
}

function addReportSummary(doc: PDFKit.PDFDocument, reportData: any) {
  const summaryBox = {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    padding: 20,
    border: "1px solid gray",
    borderRadius: "10px",
    // background: '#f8fafc'
  };

  // Draw summary box
  doc
    .save()
    .rect(doc.page.margins.left, doc.y, summaryBox.width, 100)
    .fill("#f8fafc");

  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .fillColor("#1a365d")
    .text(
      "INSPECTION SUMMARY",
      doc.page.margins.left + summaryBox.padding,
      doc.y + summaryBox.padding
    );

  doc
    .moveDown(0.5)
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#374151")
    .text(
      reportData.inspectionData.notes ||
        "Comprehensive property inspection completed.",
      {
        width: summaryBox.width - summaryBox.padding * 2,
        align: "left",
      }
    );

  doc.restore();
  doc.moveDown(2);
}

async function addPhotoDetails(
  doc: PDFKit.PDFDocument,
  photo: any,
  shareReportUrl: string
) {
  const imageWidth = 450;
  const imageHeight = 350;
  const margin = 20;
  // Check if a new page is needed before adding photo
  if (doc.y + imageHeight + 150 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    await addHeader(
      doc,
      shareReportUrl || "",
      photo.inspectionId || "",
      format(new Date(), "MMMM d, yyyy")
    );
    doc.moveDown(2);
  }

  // Store current y-position
  const imageStartY = doc.y;

  // Draw image first
  if (photo.storageLocation) {
    try {
      const imagePath = path.resolve(process.cwd(), photo.storageLocation);
      if (fs.existsSync(imagePath)) {
        doc.image(imagePath, doc.page.margins.left + margin, imageStartY, {
          fit: [imageWidth, imageHeight],
          align: "center",
        });

        // Move cursor below the image
        doc.y = imageStartY + imageHeight + 20;
      }
    } catch (error) {
      console.error(`Error processing photo:`, error);
      doc
        .font("Helvetica")
        .fillColor("#ef4444")
        .text("Error: Unable to load image", doc.page.margins.left, doc.y);
      doc.moveDown(1);
    }
  }

  // Extract metadata
  const damageType = photo.metadata?.damageType || "Unknown";
  const severity = photo.metadata?.severity || "Unknown";
  const notes = photo.metadata?.notes || "No additional details provided.";

  // Dynamic description
  let description = `This image shows signs of ${damageType.toLowerCase()}, with a severity level of ${severity.toLowerCase()}. `;

  if (
    damageType.toLowerCase().includes("shingles") ||
    damageType.toLowerCase().includes("roof")
  ) {
    description += `The affected area may need repairs to prevent leaks and further deterioration. `;
  }

  if (
    notes.toLowerCase().includes("moisture") ||
    notes.toLowerCase().includes("wear")
  ) {
    description += `There are indications of moisture retention or wear that could lead to long-term damage. `;
  }

  description += `Based on the assessment, further inspection or repairs might be necessary.`;

  // Full-width, left-aligned text
  const fullWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#374151")
    .text(description, doc.page.margins.left, doc.y, {
      width: fullWidth,
      align: "left",
    });

  doc.moveDown(1);
}

function addRecommendations(
  doc: PDFKit.PDFDocument,
  recommendations: string[]
) {
  if (doc.y + 200 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    addHeader(doc);
    doc.moveDown(2);
  }

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#1a365d")
    .text("Recommendations");
  doc.moveDown(1);

  recommendations.forEach((rec, index) => {
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#374151")
      .text(`${index + 1}. ${rec}`);
    doc.moveDown(0.5);
  });
}

async function addHeader(
  doc: PDFKit.PDFDocument,
  qrCodeUrl: string | null | undefined,
  reportId: string,
  assessmentDate: string
): Promise<void> {
  // Get the full page width
  const pageWidth = doc.page.width;
  const margin = 40; // Minimal margin for balancing
  const qrCodeSize = 60; // QR Code size

  doc.save();

  let baseY = doc.y + 10;

  // Left-aligned: Company Information
  const companyX = margin;

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#000000")
    .text("CloudLens Inc ®", companyX+30, baseY-3);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#333333")
    .text("Advanced Aerial Weather Damage Assessment", companyX, baseY + 14);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#000000")
    .text("Tel: (800) 855-0000", companyX, baseY + 24);

  
  const centerX = pageWidth / 2;
  const centerWidth = 200;

  doc
    .font("Helvetica")
    .fontSize(6)
    .fillColor("#666666")
    .text("Assessment Date:", (centerX - centerWidth / 3)+30, baseY, {
      continued: true,
    })
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text(` ${assessmentDate}`);

  doc
    .font("Helvetica")
    .fontSize(6)
    .fillColor("#666666")
    .text("Report ID:", (centerX - centerWidth / 3)+30, baseY + 14, {
      continued: true,
    })
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text(` ${reportId}`);

  // QR Code section - Moved even higher
  const qrCodeX = pageWidth - qrCodeSize - margin;
  const qrCodeY = baseY-35; // Moved up further
  
  // Add orange rectangle around QR code
  const padding = 5; // Padding around QR code
  doc.save()
     .strokeColor('#FFA500') // Orange color
     .lineWidth(1)
     .rect(
       qrCodeX - padding, 
       qrCodeY - padding, 
       qrCodeSize + (padding * 2), 
       qrCodeSize + (padding * 2)
     )
     .stroke();

  try {
    let qrCodeDataUrl: string;

    if (qrCodeUrl && qrCodeUrl.trim()) {
      qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);
    } else {
      console.warn("No QR Code URL provided, generating a default QR code.");
      qrCodeDataUrl = await QRCode.toDataURL(
        "https://cloudlens.com/default-report"
      );
    }

    // Scan me image - Also moved higher
    const scanMeImagePath = path.join(process.cwd(), 'assets', 'scan-me.png');
    const scanMeImageWidth = 80; 
    const scanMeImageHeight = 60; 
    const scanMeX = qrCodeX - 100;
    const scanMeY = qrCodeY - 5; // Moved up to better align with higher QR code

    doc.image(scanMeImagePath, scanMeX, scanMeY, {
      width: scanMeImageWidth,
      height: scanMeImageHeight
    });

    // Draw QR code
    doc.image(qrCodeDataUrl, qrCodeX, qrCodeY, {
      width: qrCodeSize,
      height: qrCodeSize,
    });

    doc.font("Helvetica").fontSize(6).fillColor("#000000");
  } catch (error) {
    console.error("Error generating QR Code:", error);
  }

  // Draw the underline at the bottom
  const lineWidth = pageWidth * 0.8;
  doc
    .moveTo(10, baseY + 45)  // Keeping the line position the same
    .lineTo(10 + lineWidth, baseY + 45)
    .lineWidth(1)
    .stroke("#868686");

  doc.restore();
  doc.moveDown(6);
}


function addUrgentNote(doc: PDFKit.PDFDocument): void {
  const noteWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const padding = 15;
  const noteHeight = 100;
  const borderRadius = 10;

  const x = doc.page.margins.left;
  const y = doc.y;

  // Draw a rounded rectangle manually
  doc
    .save()
    .fillColor("#f4cccc")
    .roundedRect(x, y, noteWidth, noteHeight, borderRadius)
    .fill();

  // Add urgent text
  doc.fillColor("#9c0006").fontSize(12).font("Helvetica-Bold");
  doc.text(
    "URGENT: Professional In-Person Inspection Recommended",
    x + padding,
    y + padding,
    {
      width: noteWidth - padding * 2,
      align: "left",
    }
  );

  doc.moveDown(0.5);
  doc.fillColor("#333333").fontSize(10).font("Helvetica");

  const noteText = `Based on our aerial assessment findings, we strongly recommend scheduling an immediate on-site inspection to assess potential damage before it worsens.

Protect your property from escalating issues—contact CloudLens Inc. today at 1-800-855-2562 to schedule your inspection and ensure timely repairs.`;

  doc.text(noteText, x + padding, doc.y, {
    width: noteWidth - padding * 2,
    align: "left",
  });

  doc.restore();
  doc.moveDown(2);
}


function addFooter(
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  totalPages: number
) {
  // Define the desired footer height
  const footerHeight = 30;
  // Calculate a Y coordinate inside the bottom margin
  const footerY = doc.page.height - footerHeight - doc.page.margins.bottom;
  const footerWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Add footer text at the bottom of the page
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#64748b")
    .text(
      "This aerial assessment report is based on Aerial imaging technology and serves as a preliminary evaluation. CloudLens Inc. recommends a thorough in-person inspection for complete damage assessment and repair planning. CloudLens Inc. | Advanced Weather Damage Assessment Solutions | 1-800-855-2562",
      doc.page.margins.left,
      footerY,
      { width: footerWidth, align: "center" }
    );

  // Uncomment below if you also wish to include page numbers:
  /*
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    doc.page.margins.left,
    footerY + 20,
    { width: footerWidth, align: "center" }
  );
  */
}

router.post("/api/properties/:id/inspections/complete", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: "Invalid property ID" });
    }

    const { inspectionData } = req.body;
    if (!inspectionData) {
      return res.status(400).json({ error: "Missing inspection data" });
    }

    // Validate property exists
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }

    // Create inspection record
    const [inspection] = await db
      .insert(inspections)
      .values({
        propertyId,
        status: "completed",
        damageType: inspectionData.damageType || "other",
        severity: inspectionData.severity || "low",
        notes: inspectionData.notes || "",
        metadata: {
          recommendations: inspectionData.recommendations || [],
        },
      })
      .returning();

    if (!inspection) {
      return res
        .status(500)
        .json({ error: "Failed to create inspection record" });
    }

    // Process photos
    const photoUpdatePromises =
      inspectionData.photos?.map(async (photo: any) => {
        try {
          // Get existing photo record
          const [existingPhoto] = await db
            .select()
            .from(photos)
            .where(eq(photos.id, photo.photoId))
            .limit(1);

          if (!existingPhoto) {
            throw new Error(`Photo ${photo.photoId} not found`);
          }

          // Update photo with inspection data
          const [updatedPhoto] = await db
            .update(photos)
            .set({
              inspectionId: inspection.id,
              metadata: {
                damageType: photo.damageType,
                severity: photo.severity,
                notes: photo.notes,
              },
            })
            .where(eq(photos.id, photo.photoId))
            .returning();

          return { success: true, photoId: photo.photoId, data: updatedPhoto };
        } catch (error) {
          console.error(`Error processing photo ${photo.photoId}:`, error);
          return {
            success: false,
            photoId: photo.photoId,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }) || [];

    // Wait for all photo updates to complete
    const photoResults = await Promise.all(photoUpdatePromises);

    // Update property inspection timestamp
    await db
      .update(properties)
      .set({
        lastInspectionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    // Generate share token automatically
    const shareToken = crypto.randomBytes(32).toString("hex");
    const baseUrl = `${process.env.APP_URL || req.protocol}://${req.get(
      "host"
    )}`;
    const shareUrl = `${baseUrl}/reports/share/${shareToken}`;

    // Create report with share token
    const [report] = await db
      .insert(reports)
      .values({
        inspectionId: inspection.id,
        propertyId: propertyId,
        reportPath: `reports/${propertyId}/${inspection.id}`,
        reportType: "inspection",
        status: "completed",
        shareToken: shareToken,
        shareUrl: shareUrl,
        metadata: {
          propertyId,
          inspectionId,
          propertyAddress: property.address,
          createdAt: new Date().toISOString(),
        },
      })
      .returning();

    if (!report) {
      console.error("Failed to create report with share token");
    }

    // Return success response with inspection details and share URL
    res.json({
      success: true,
      inspection,
      photoResults,
      property: {
        id: propertyId,
        lastInspectionAt: new Date(),
      },
      shareUrl: report?.shareUrl, // Include the share URL in the response
    });
  } catch (error) {
    console.error("Error completing inspection:", error);
    res.status(500).json({
      error: "Failed to complete inspection",
      message: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Modify the share token creation endpoint
router.post(
  "/api/properties/:id/inspections/:inspectionId/share",
  async (req, res) => {
    try {
      const propertyId = parseInt(req.params.id);
      const inspectionId = parseInt(req.params.inspectionId);

      if (isNaN(propertyId) || isNaN(inspectionId)) {
        return res.status(400).json({
          error: "Invalid property or inspection ID",
          message: "The provided IDs must be valid numbers",
        });
      }

      // Verify inspection exists and belongs to property
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(
          and(
            eq(inspections.id, inspectionId),
            eq(inspections.propertyId, propertyId)
          )
        )
        .limit(1);

      if (!inspection) {
        return res.status(404).json({
          error: "Inspection not found",
          message:
            "The requested inspection does not exist or does not belong to this property",
        });
      }

      // Generate a secure random token
      const shareToken = crypto.randomBytes(32).toString("hex");

      // Get the property details for the metadata
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return res.status(404).json({
          error: "Property not found",
          message:
            "The property associated with this inspection could not be found",
        });
      }

      // Generate the shareable URL
      const baseUrl = `${process.env.APP_URL || req.protocol}://${req.get(
        "host"
      )}`;
      const shareUrl = `${baseUrl}/reports/share/${shareToken}`;

      // Store the share token in the database with the inspection
      const [report] = await db
        .insert(reports)
        .values({
          inspectionId: inspectionId,
          propertyId: propertyId,
          reportPath: `reports/${propertyId}/${inspectionId}`,
          reportType: "inspection",
          status: "completed",
          shareToken: shareToken,
          shareUrl: shareUrl,
          shareExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          metadata: {
            propertyId,
            inspectionId,
            propertyAddress: property.address,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        })
        .returning();

      if (!report) {
        throw new Error("Failed to create share token");
      }

      // Return the share token and URL
      res.json({
        success: true,
        shareToken: report.shareToken,
        shareUrl,
        expiresAt: report.shareExpiresAt,
      });
    } catch (error) {
      console.error("Error creating share token:", error);
      res.status(500).json({
        error: "Internal server error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create share token",
      });
    }
  }
);

router.get("/api/reports/share/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Get report by share token
    const [report] = await db
      .select({
        id: reports.id,
        propertyId: reports.propertyId,
        inspectionId: reports.inspectionId,
        shareToken: reports.shareToken,
        shareExpiresAt: reports.shareExpiresAt,
      })
      .from(reports)
      .where(eq(reports.shareToken, token))
      .limit(1);

    if (!report) {
      return res.status(404).json({
        error: "Report not found",
        message: "The requested report does not exist",
      });
    }

    // Get property details
    const [property] = await db
      .select({
        id: properties.id,
        address: properties.address,
        city: properties.city,
        state: properties.state,
        zipCode: properties.zipCode,
        latitude: properties.latitude,
        longitude: properties.longitude,
      })
      .from(properties)
      .where(eq(properties.id, report.propertyId))
      .limit(1);

    if (!property) {
      return res.status(404).json({
        error: "Property not found",
        message: "The property associated with this report could not be found",
      });
    }

    // Get inspection details
    const [inspection] = await db
      .select({
        id: inspections.id,
        createdAt: inspections.createdAt,
        notes: inspections.notes,
        severity: inspections.severity,
      })
      .from(inspections)
      .where(eq(inspections.id, report.inspectionId))
      .limit(1);

    if (!inspection) {
      return res.status(404).json({
        error: "Inspection not found",
        message: "The inspection data is missing",
      });
    }

    // Get photos
    const inspectionPhotos = await db
      .select({
        id: photos.id,
        url: photos.storageLocation,
        metadata: photos.metadata,
        propertyId: photos.propertyId,
      })
      .from(photos)
      .where(
        and(
          eq(photos.propertyId, report.propertyId),
          eq(photos.propertyId, property.id)
        )
      );

    // Format response
    const response = {
      property: {
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        latitude: property.latitude
          ? parseFloat(property.latitude.toString())
          : null,
        longitude: property.longitude
          ? parseFloat(property.longitude.toString())
          : null,
      },
      inspection: {
        id: inspection.id,
        date: inspection.createdAt,
        summary: inspection.notes,
        overallSeverity: inspection.severity,
        photos: inspectionPhotos.map((photo) => ({
          id: photo.id,
          url: `/api/photos/${photo.id}/view`,
          metadata: {
            damageType: photo.metadata?.damageType || "Unknown",
            severity: photo.metadata?.severity || "low",
            notes: photo.metadata?.notes || "",
          },
        })),
      },
      shareExpires: report.shareExpiresAt,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching shared report:", error);
    res.status(500).json({
      error: "Internal server error",
      message:
        error instanceof Error ? error.message : "Failed to fetch report",
    });
  }
});

export default router;
