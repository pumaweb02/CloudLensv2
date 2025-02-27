import { format } from 'date-fns';
import { Photo } from '@db/schema';

interface PropertyReport {
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    parcelNumber?: string;
    yearBuilt?: string;
    propertyValue?: number;
    coordinates: {
      latitude: number;
      longitude: number;
    }
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
    inspectionId?: number;
    photos: Array<{
      photoId: number;
      editedImage: string;
      damageType: string;
      severity: string;
      notes: string;
    }>;
  };
}

export async function generateInspectionReport(propertyId: number, inspectionId: number | null, selectedPhotos: Photo[]): Promise<void> {
  try {
    if (!propertyId) {
      throw new Error('Property ID is required');
    }

    const response = await fetch(`/api/properties/${propertyId}/inspections/${inspectionId || 'draft'}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf'
      },
      body: JSON.stringify({ selectedPhotos })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    // Get the blob directly from response
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Received empty PDF data');
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CloudLens-Property-Inspection-${propertyId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading report:', error);
    throw error;
  }
}

export async function downloadInspectionReport(propertyId: number, inspectionId: number): Promise<void> {
  try {
    if (!propertyId || !inspectionId) {
      throw new Error('Both property ID and inspection ID are required');
    }

    const response = await fetch(`/api/properties/${propertyId}/inspections/${inspectionId}/report`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    // Get the blob directly from response
    const blob = await response.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Received empty PDF data');
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CloudLens-Property-Inspection-${propertyId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading report:', error);
    throw error;
  }
}