/**
 * NIC Image Verification Service
 *
 * Uses Google Gemini Vision API to:
 * 1. Confirm uploaded images are genuine Sri Lanka NIC cards
 * 2. Extract the NIC number from the card via AI OCR
 * 3. Cross-validate the extracted number against what the user entered
 */

const GEMINI_API_KEY = (import.meta as unknown as { env: Record<string, string> }).env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface NicVerificationResult {
  isValidNic: boolean;
  extractedNicNumber: string | null;
  nicNumberMatch: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Strips the data URL prefix and returns the raw base64 data + MIME type.
 */
function parseDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image format. Please re-upload the NIC photo.');
  return { mimeType: match[1], data: match[2] };
}

/**
 * Verifies NIC images using Gemini Vision.
 *
 * @param enteredNicNumber - The NIC number typed by the user
 * @param frontImageDataUrl - Base64 data URL of the NIC front photo
 * @param backImageDataUrl  - Base64 data URL of the NIC back photo
 */
export async function verifyNicImages(
  enteredNicNumber: string,
  frontImageDataUrl: string,
  backImageDataUrl: string,
): Promise<NicVerificationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'NIC verification service is not configured. Contact the system administrator.',
    );
  }

  const front = parseDataUrl(frontImageDataUrl);
  const back = parseDataUrl(backImageDataUrl);
  const cleanNic = enteredNicNumber.trim().toUpperCase();

  const prompt = `You are a Sri Lanka National Identity Card (NIC) verification system for a government school management application.

You are given TWO images — the FRONT and BACK of a Sri Lanka NIC card submitted during teacher registration.

Your tasks:
1. Determine if BOTH images are genuine Sri Lanka National Identity Card images (either the old laminated format or the new smart card / chip card format). Random photos, selfies, screenshots, other country IDs, and any non-NIC documents must be rejected.
2. Extract the NIC number from the front of the card. Sri Lanka NIC numbers follow one of two formats:
   - Old format: exactly 9 digits followed by the letter V or X (e.g. 852345678V)
   - New format: exactly 12 digits (e.g. 199012345678)
3. Compare the extracted NIC number (case-insensitive) with the number the user entered: "${cleanNic}"

IMPORTANT: Return ONLY a raw JSON object. No markdown, no code fences, no extra text — just the JSON:
{
  "isValidNic": true or false,
  "extractedNicNumber": "the NIC number read from the card image, or null if unreadable",
  "nicNumberMatch": true or false,
  "confidence": "high" | "medium" | "low",
  "reason": "brief human-readable explanation, especially if isValidNic is false or nicNumberMatch is false"
}

Rules:
- Set isValidNic to false for ANY image that is not a Sri Lanka NIC card.
- nicNumberMatch: compare ignoring case (e.g. 'v' and 'V' are the same).
- If you can partially read the NIC number, include it and set confidence to "medium" or "low".
- Do not be lenient — this is a security verification for a government portal.`;

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: front.mimeType, data: front.data } },
              { inlineData: { mimeType: back.mimeType, data: back.data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 400,
        },
      }),
    });
  } catch (networkErr) {
    console.error('Gemini network error:', networkErr);
    throw new Error(
      'Cannot reach the NIC verification service. Please check your internet connection and try again.',
    );
  }

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Gemini API error response:', response.status, errBody);

    if (response.status === 400) {
      throw new Error(
        'NIC verification failed: the API key may be invalid or the image format is unsupported.',
      );
    }
    if (response.status === 429) {
      throw new Error('NIC verification service is temporarily busy. Please wait a moment and try again.');
    }
    throw new Error(
      `NIC verification service error (HTTP ${response.status}). Please try again or contact support.`,
    );
  }

  const responseData = await response.json();
  const rawText: string =
    responseData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip any accidental markdown fences Gemini might add despite instructions
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let result: NicVerificationResult;
  try {
    result = JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse Gemini NIC verification response:', rawText);
    throw new Error(
      'NIC verification returned an unexpected response. Please try again.',
    );
  }

  // Sanity-check the parsed object
  if (typeof result.isValidNic !== 'boolean') {
    throw new Error('NIC verification returned an invalid result. Please try again.');
  }

  return result;
}
