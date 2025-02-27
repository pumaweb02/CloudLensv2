import { promises as fs } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import handlebars from "handlebars";
import { format } from 'date-fns';

// Interface definitions remain unchanged
export interface ReportData {
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    parcelNumber?: string;
    yearBuilt?: string;
    propertyValue?: number;
    streetViewUrl?: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  owners: {
    primary?: {
      name?: string;
      company?: string;
      phone?: string;
      email?: string;
    };
  };
  inspectionData: {
    propertyId: number;
    summary?: string;
    overallSeverity?: 'low' | 'medium' | 'high';
    recommendations?: string[];
    photos: Array<{
      photoId: number;
      editedImage: string;
      damageType: string;
      severity: string;
      notes: string;
      annotations?: Array<{
        type: string;
        coordinates: any;
        description: string;
      }>;
    }>;
  };
  qrCode?: string;
  callToAction?: {
    title: string;
    message: string;
    phone: string;
  };
}

export async function generateInspectionReport(data: ReportData): Promise<Buffer> {
  try {
    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    await fs.mkdir(uploadDir, { recursive: true });

    // Create a new PDF document with professional settings
    const doc = new PDFDocument({
      margin: 50,
      size: 'LETTER',
      info: {
        Title: `Property Inspection Report - ${data.property.address}`,
        Author: 'CloudLens Professional Services',
        Subject: 'Property Damage Assessment Report',
        Keywords: 'inspection, property, damage assessment, professional report',
        CreationDate: new Date(),
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Define consistent typography
    const typography = {
      title: { size: 24, font: 'Heading', color: '#1a365d' },
      subtitle: { size: 18, font: 'Heading', color: '#2d3748' },
      sectionTitle: { size: 16, font: 'Heading', color: '#1a365d' },
      heading: { size: 14, font: 'Heading', color: '#2d3748' },
      body: { size: 12, font: 'Body', color: '#4a5568' },
      caption: { size: 10, font: 'Body', color: '#718096' }
    };

    // Register fonts
    doc.registerFont('Heading', 'Helvetica-Bold');
    doc.registerFont('Body', 'Helvetica');

    // Add header with logo
    doc.fontSize(typography.title.size)
      .font(typography.title.font)
      .fillColor(typography.title.color)
      .text('CloudLens™', { align: 'left' });

    doc.fontSize(typography.subtitle.size)
      .fillColor(typography.subtitle.color)
      .text('Professional Assessment Report', { align: 'left' });

    doc.moveDown(2);

    // Add QR code and urgent call-to-action if provided
    if (data.qrCode) {
      const qrBuffer = Buffer.from(data.qrCode.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      doc.image(qrBuffer, doc.page.width - 180, doc.y, { width: 130 });
    }

    if (data.callToAction) {
      const boxHeight = 120;
      doc.rect(50, doc.y, doc.page.width - 100, boxHeight)
        .fillColor('#fef2f2')
        .fill();

      doc.fillColor('#dc2626')
        .fontSize(typography.sectionTitle.size)
        .font(typography.sectionTitle.font)
        .text(data.callToAction.title, 70, doc.y - boxHeight + 20);

      doc.fontSize(typography.body.size)
        .font(typography.body.font)
        .fillColor('#7f1d1d')
        .text(data.callToAction.message, 70, null, { 
          width: doc.page.width - 240,
          align: 'left',
          lineGap: 2
        });

      doc.fontSize(typography.heading.size)
        .font(typography.heading.font)
        .fillColor('#dc2626')
        .text(data.callToAction.phone, { align: 'right' });

      doc.moveDown(2);
    }

    // Add summary section with street view
    doc.rect(50, doc.y, doc.page.width - 100, 350)
      .fillColor('#f0f9ff')
      .fill();

    // Add street view if available
    if (data.property.streetViewUrl) {
      try {
        const imgBuffer = Buffer.from(
          data.property.streetViewUrl.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        );

        doc.image(imgBuffer, 70, doc.y + 20, {
          fit: [doc.page.width - 140, 200],
          align: 'center'
        });

      } catch (error) {
        console.error('Error adding street view image:', error);
      }
    }

    // Add summary information
    doc.fontSize(typography.sectionTitle.size)
      .font(typography.sectionTitle.font)
      .fillColor(typography.sectionTitle.color)
      .text('INSPECTION SUMMARY', 70, doc.y + 20);

    doc.fontSize(typography.body.size)
      .font(typography.body.font)
      .fillColor(typography.body.color);

    if (data.inspectionData.overallSeverity) {
      doc.text(`Overall Severity: ${data.inspectionData.overallSeverity.toUpperCase()}`, {
        continued: true
      });

      // Add colored severity indicator
      const severityColors = {
        high: '#dc2626',
        medium: '#d97706',
        low: '#059669'
      };
      doc.fillColor(severityColors[data.inspectionData.overallSeverity] || severityColors.low)
        .text(` ● `, { align: 'left' })
        .fillColor(typography.body.color);
    }

    if (data.inspectionData.summary) {
      doc.moveDown()
        .text(data.inspectionData.summary, {
          width: doc.page.width - 140,
          align: 'left',
          lineGap: 2
        });
    }

    doc.moveDown(2);

    // Add property details section
    doc.rect(50, doc.y, doc.page.width - 100, 130)
      .fillColor('#f8fafc')
      .fill();

    doc.fontSize(typography.sectionTitle.size)
      .font(typography.sectionTitle.font)
      .fillColor(typography.sectionTitle.color)
      .text('PROPERTY INFORMATION', 70, doc.y - 120);

    // Create two columns for property details
    const col1X = 70;
    const col2X = doc.page.width / 2 + 20;

    doc.fontSize(typography.body.size)
      .font(typography.body.font)
      .fillColor(typography.body.color)
      .text(`Address:`, col1X, doc.y + 10, { continued: true })
      .font('Body')
      .text(` ${data.property.address}`);

    doc.text(`City:`, col1X, null, { continued: true })
      .font('Body')
      .text(` ${data.property.city}, ${data.property.state} ${data.property.zipCode}`);

    if (data.property.parcelNumber) {
      doc.text(`Parcel:`, col2X, doc.y - doc.currentLineHeight(), { continued: true })
        .font('Body')
        .text(` ${data.property.parcelNumber}`);
    }

    if (data.property.yearBuilt) {
      doc.text(`Built:`, col1X, null, { continued: true })
        .font('Body')
        .text(` ${data.property.yearBuilt}`);
    }

    if (data.property.propertyValue) {
      doc.text(`Value:`, col2X, doc.y - doc.currentLineHeight(), { continued: true })
        .font('Body')
        .text(` $${data.property.propertyValue.toLocaleString()}`);
    }

    doc.moveDown(2);

    // Add owner information if available
    if (data.owners.primary) {
      doc.fontSize(typography.sectionTitle.size)
        .font(typography.sectionTitle.font)
        .fillColor(typography.sectionTitle.color)
        .text('OWNER INFORMATION');

      const ownerInfo = [];
      if (data.owners.primary.name) ownerInfo.push(`Name: ${data.owners.primary.name}`);
      if (data.owners.primary.company) ownerInfo.push(`Company: ${data.owners.primary.company}`);
      if (data.owners.primary.phone) ownerInfo.push(`Phone: ${data.owners.primary.phone}`);
      if (data.owners.primary.email) ownerInfo.push(`Email: ${data.owners.primary.email}`);

      // Display owner info in two columns
      const mid = Math.ceil(ownerInfo.length / 2);
      doc.fontSize(typography.body.size)
        .font(typography.body.font)
        .fillColor(typography.body.color);

      ownerInfo.slice(0, mid).forEach((info, i) => {
        doc.text(info, col1X);
      });

      ownerInfo.slice(mid).forEach((info, i) => {
        doc.text(info, col2X, doc.y - (doc.currentLineHeight() * (i + 1)));
      });

      doc.moveDown(2);
    }

    // Add recommendations if available
    if (data.inspectionData.recommendations?.length) {
      doc.fontSize(typography.sectionTitle.size)
        .font(typography.sectionTitle.font)
        .fillColor(typography.sectionTitle.color)
        .text('RECOMMENDATIONS');

      doc.fontSize(typography.body.size)
        .font(typography.body.font)
        .fillColor(typography.body.color);

      data.inspectionData.recommendations.forEach((rec, index) => {
        doc.text(`${index + 1}. ${rec}`, {
          width: doc.page.width - 140,
          align: 'left',
          lineGap: 2
        });
      });

      doc.moveDown(2);
    }

    // Add inspection details section
    doc.fontSize(typography.sectionTitle.size)
      .font(typography.sectionTitle.font)
      .fillColor(typography.sectionTitle.color)
      .text('DETAILED INSPECTION FINDINGS');

    doc.moveDown();

    // Add photos and analysis with larger images
    for (const photo of data.inspectionData.photos) {
      // Add the image if it exists
      if (photo.editedImage) {
        try {
          const imgBuffer = Buffer.from(
            photo.editedImage.replace(/^data:image\/\w+;base64,/, ''),
            'base64'
          );

          // Use larger dimensions for photos
          const maxWidth = doc.page.width - 100;
          const maxHeight = 400;

          doc.image(imgBuffer, {
            fit: [maxWidth, maxHeight],
            align: 'center'
          });

          doc.moveDown();

        } catch (error) {
          console.error('Error adding image to report:', error);
        }
      }

      // Add damage assessment box
      doc.rect(50, doc.y, doc.page.width - 100, 120)
        .fillColor('#f1f5f9')
        .fill();

      doc.fontSize(typography.heading.size)
        .font(typography.heading.font)
        .fillColor(typography.heading.color)
        .text('Damage Assessment:', 70, doc.y - 110);

      // Create two columns for damage details
      doc.fontSize(typography.body.size)
        .font(typography.body.font)
        .fillColor(typography.body.color);

      doc.text(`Type: ${photo.damageType}`, col1X)
        .text(`Severity: ${photo.severity}`, col2X, doc.y - doc.currentLineHeight());

      doc.moveDown()
        .text('Notes:', col1X)
        .font('Body')
        .text(photo.notes, {
          width: doc.page.width - 140,
          align: 'left',
          lineGap: 2
        });

      // Add annotations if available
      if (photo.annotations?.length) {
        doc.moveDown()
          .font(typography.heading.font)
          .text('Annotations:', col1X);

        photo.annotations.forEach(annotation => {
          doc.font(typography.body.font)
            .text(`• ${annotation.description}`, col1X + 20, null, {
              width: doc.page.width - 160,
              align: 'left',
              lineGap: 2
            });
        });
      }

      doc.moveDown(2);
    }

    // Add footer
    const footerY = doc.page.height - 50;
    doc.fontSize(typography.caption.size)
      .font(typography.caption.font)
      .fillColor(typography.caption.color)
      .text(
        'CloudLens™ Professional Assessment Services | 24/7 Support: 1-800-855-2562',
        50,
        footerY,
        { align: 'center' }
      );

    // Add page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.text(
        `Page ${i + 1} of ${totalPages}`,
        50,
        footerY + 15,
        { align: 'right' }
      );
    }

    // Finalize the PDF
    doc.end();

    // Return a promise that resolves with the complete PDF data
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}