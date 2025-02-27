import OpenAI from "openai";
import { promises as fs } from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface VisionAnalysisResult {
  isMatch: boolean;
  confidence: number;
  reasoning: string;
  suggestedAddress?: string;
  matchingFeatures?: string[];
  mismatchedFeatures?: string[];
}

interface RoofDamageAnalysis {
  hasDamage: boolean;
  damageType: string[];
  confidence: number;
  details: string;
  severity: "none" | "minor" | "moderate" | "severe";
  recommendations: string[];
}

export async function analyzePropertyMatch(
  photoPath: string,
  propertyAddress: string,
  nearbyAddresses: string[]
): Promise<VisionAnalysisResult> {
  try {
    const imageBase64 = await fs.readFile(photoPath, { encoding: 'base64' });

    const prompt = `As a professional property identification expert, carefully evaluate if this drone photo matches the property at "${propertyAddress}".
    Nearby properties to consider: ${nearbyAddresses.join(', ')}.

    Focus your analysis on:
    1. Roof characteristics (shape, material, color, condition)
    2. Property layout and architectural features (e.g., chimneys, skylights, dormers)
    3. Property orientation and position relative to street
    4. Distinctive landscaping (trees, gardens, pools)
    5. Driveways and parking areas
    6. Solar panels or other roof installations
    7. Property boundaries and fencing
    8. Building dimensions and stories
    9. Windows and exterior features
    10. Any unique identifiers visible in the image
    11. House number visibility or confirmation
    12. Relation to neighboring properties
    13. Street layout and property positioning
    14. Any distinguishing architectural elements

    Provide extreme attention to detail and be very conservative in your assessment.
    If there is ANY doubt about the match, indicate no match. Consider:

    Disqualifying factors (automatic no match):
    - Different house numbers visible
    - Significantly different architectural style
    - Mismatched roof shapes or materials
    - Incorrect orientation relative to street
    - Major features present in one but missing in other (e.g., pool, large trees)
    - Distance from provided coordinates exceeds 25 meters
    - Photo appears to be from a neighboring property

    Additional considerations:
    - Lighting conditions and image clarity
    - Seasonal changes in vegetation
    - Recent property modifications
    - Similar architectural styles in the area
    - Potential for perspective confusion
    - Time of day and shadows
    - Weather conditions affecting visibility
    - Construction or renovation status
    - GPS accuracy and drift

    Respond with a JSON object:
    {
      "isMatch": boolean,
      "confidence": number (0-1, be extremely conservative in scoring),
      "reasoning": string (detailed explanation),
      "suggestedAddress": string (if you believe this is a different property),
      "matchingFeatures": string[] (list specific features that match),
      "mismatchedFeatures": string[] (list any features that don't match or raise doubts)
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}") as VisionAnalysisResult;

    // Implement stricter validation
    if (!result.confidence || result.confidence < 0.97) {
      result.isMatch = false;
      result.reasoning += "\nConfidence threshold not met (required: 0.97)";
    }

    // Additional validation based on feature matching
    if (result.mismatchedFeatures && result.mismatchedFeatures.length > 0) {
      result.isMatch = false;
      result.reasoning += "\nCritical features mismatch detected";
    }

    // Validate matching features requirement
    if (!result.matchingFeatures || result.matchingFeatures.length < 5) {
      result.isMatch = false;
      result.reasoning += "\nInsufficient matching features identified";
    }

    return result;
  } catch (error) {
    console.error('Vision analysis error:', error);
    throw new Error('Failed to analyze property match');
  }
}

export async function analyzeRoofDamage(
  photoPath: string
): Promise<RoofDamageAnalysis> {
  try {
    const imageBase64 = await fs.readFile(photoPath, { encoding: 'base64' });

    const prompt = `Analyze this drone photo of a roof for damage and provide a detailed assessment.
    Focus on:
    1. Wind damage (missing shingles, exposed underlayment)
    2. Hail damage (impact marks, broken tiles)
    3. Structural damage (sagging, debris)
    4. Overall condition
    
    Respond with a JSON object containing:
    {
      "hasDamage": boolean,
      "damageType": string[] (types of damage found),
      "confidence": number (0-1),
      "details": string (detailed description),
      "severity": "none" | "minor" | "moderate" | "severe",
      "recommendations": string[] (list of recommended actions)
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content) as RoofDamageAnalysis;
  } catch (error) {
    console.error('Roof damage analysis error:', error);
    throw new Error('Failed to analyze roof damage');
  }
}

export async function validatePhotoContent(
  photoPath: string,
  propertyAddress: string
): Promise<{ isValidRoofPhoto: boolean; details: string; confidence: number }> {
  try {
    const imageBase64 = await fs.readFile(photoPath, { encoding: 'base64' });

    const prompt = `Analyze if this is a valid drone photo of a residential property at "${propertyAddress}".

    Check for:
    1. Clear aerial perspective of property
    2. Photo quality and clarity
    3. Complete view of the property
    4. Proper lighting and exposure
    5. No obvious mismatches with expected property type
    
    Respond with a JSON object:
    {
      "isValidRoofPhoto": boolean,
      "details": string (explanation),
      "confidence": number (0-1)
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Photo validation error:', error);
    throw new Error('Failed to validate photo content');
  }
}