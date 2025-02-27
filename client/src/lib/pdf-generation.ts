import { format } from 'date-fns';
import QRCode from 'qrcode';

export interface InspectionData {
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
}

export interface PropertyReport {
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
}

export async function generateInspectionReport(reportData: PropertyReport): Promise<Blob> {
  try {
    console.log('Generating inspection report...', reportData);

    // Validate required data
    if (!reportData.inspectionData?.propertyId) {
      throw new Error('Property ID is required');
    }

    if (!reportData.inspectionData?.photos?.length) {
      throw new Error('No photos provided for report generation');
    }

    // Generate QR code for the property link
    const propertyUrl = `${window.location.origin}/properties/${reportData.inspectionData.propertyId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(propertyUrl);

    // Enhance report data with QR code and urgent messaging
    const enhancedReportData = {
      ...reportData,
      qrCode: qrCodeDataUrl,
      callToAction: {
        title: "URGENT: Time-Sensitive Insurance Coverage Notice",
        message: "Your property has been identified for potential storm damage coverage. Immediate action is recommended to ensure your insurance benefits are maximized. Scan the QR code or call now to initiate your claim process.",
        phone: "1-800-XXX-XXXX",
      }
    };

    // Calculate overall severity if not provided
    if (!enhancedReportData.inspectionData.overallSeverity) {
      const severityScores = reportData.inspectionData.photos.map(photo => {
        switch (photo.severity.toLowerCase()) {
          case 'high': return 3;
          case 'medium': return 2;
          case 'low': return 1;
          default: return 0;
        }
      });
      const avgScore = severityScores.reduce((a, b) => a + b, 0) / severityScores.length;
      enhancedReportData.inspectionData.overallSeverity = 
        avgScore >= 2.5 ? 'high' : avgScore >= 1.5 ? 'medium' : 'low';
    }

    // Generate recommendations if not provided
    if (!enhancedReportData.inspectionData.recommendations) {
      enhancedReportData.inspectionData.recommendations = [
        "Schedule an immediate inspection to prevent further damage",
        "Document all visible damage with additional photos",
        "Contact your insurance provider with this report",
        "Consider temporary protective measures if needed"
      ];
    }

    const response = await fetch(`/api/properties/${reportData.inspectionData.propertyId}/inspections/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf'
      },
      body: JSON.stringify(enhancedReportData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Report generation failed:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Failed to generate report');
      } catch (e) {
        throw new Error(`Failed to generate report: ${errorText}`);
      }
    }

    // Ensure we received a PDF
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/pdf')) {
      throw new Error(`Invalid response type: ${contentType}`);
    }

    // Get the PDF blob directly from the response
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('No PDF data received from server');
    }

    return blob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error instanceof Error ? error : new Error('Failed to generate PDF report');
  }
}