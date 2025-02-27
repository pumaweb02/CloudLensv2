import { compressImage, calculateCompressionQuality } from "./image-utils";

export interface DamageAnalysis {
  damageType: "wind" | "hail" | "other" | "none";
  severity: "low" | "medium" | "high";
  confidence: number;
  description: string;
  annotations: {
    type: "circle" | "text";
    x: number;
    y: number;
    radius?: number;
    text?: string;
    color: string;
  }[];
}

export interface AnalyzedPhoto {
  id: number;
  filename: string;
  analysis: DamageAnalysis;
  editedImageUrl?: string;
}

// Provide a mock implementation that doesn't rely on OpenAI
export async function analyzeDamage(imageUrl: string): Promise<DamageAnalysis> {
  // Return a basic analysis structure without AI
  return {
    damageType: "other",
    severity: "low",
    confidence: 0.8,
    description: "Manual inspection required. AI analysis is currently disabled.",
    annotations: []
  };
}

// Generate inspection report with manual analysis only
export async function generateReport(
  propertyDetails: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  },
  photos: AnalyzedPhoto[],
  inspectionNotes: string
): Promise<{
  summary: string;
  recommendations: string[];
}> {
  return {
    summary: "Manual inspection report generated based on user annotations and notes.",
    recommendations: [
      "Please review all annotations and notes carefully",
      "Consult with a professional inspector for detailed assessment",
      "Document any changes or repairs made"
    ]
  };
}

function validateDamageType(type: string): DamageAnalysis['damageType'] {
  const validTypes: DamageAnalysis['damageType'][] = ["wind", "hail", "other", "none"];
  const normalized = type?.toLowerCase() as DamageAnalysis['damageType'];
  return validTypes.includes(normalized) ? normalized : "other";
}

function validateSeverity(severity: string): DamageAnalysis['severity'] {
  const validSeverities: DamageAnalysis['severity'][] = ["low", "medium", "high"];
  const normalized = severity?.toLowerCase() as DamageAnalysis['severity'];
  return validSeverities.includes(normalized) ? normalized : "low";
}

function getColorForSeverity(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'high':
      return '#ff0000'; // Red
    case 'medium':
      return '#ffa500'; // Orange
    case 'low':
      return '#ffff00'; // Yellow
    default:
      return '#00ff00'; // Green
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}