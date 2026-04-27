// utils/gemini.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as FileSystem from "expo-file-system";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description:
            "A short, clear title summarizing the problem (max 10 words)",
        },
        description: {
          type: SchemaType.STRING,
          description:
            "A detailed, professional problem description for a service worker. Include what the issue is, possible causes, and what needs to be done. Write 2-4 sentences.",
        },
      },
      required: ["title", "description"],
    },
  },
});

export interface GeneratedDescription {
  title: string;
  description: string;
}

/**
 * Generate a professional problem description using Gemini AI.
 * Sends the user's rough text, selected category, and optional image.
 */
export async function generateProblemDescription(
  userText: string,
  categoryName: string,
  imageUri?: string | null
): Promise<GeneratedDescription> {
  if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("Gemini API key is not configured. Please add it to your .env file.");
  }

  const prompt = `You are helping a customer write a clear problem description for a service order in the "${categoryName}" category.

The customer wrote: "${userText}"

Based on this input${imageUri ? " and the attached image of the problem" : ""}, generate:
1. A short title summarizing the issue
2. A detailed, professional description that a ${categoryName} worker would understand. Include what the problem is, any likely causes, and what work might be needed.

Keep it practical and helpful. Write from the customer's perspective.`;

  const parts: any[] = [{ text: prompt }];

  // If an image is provided, convert to base64 and attach
  if (imageUri) {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      // Determine mime type from URI
      const ext = imageUri.split(".").pop()?.toLowerCase() || "jpeg";
      const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

      parts.push({
        inlineData: {
          mimeType,
          data: base64,
        },
      });
    } catch (err) {
      console.warn("Could not read image for AI generation:", err);
      // Continue without image
    }
  }

  const result = await model.generateContent(parts);
  const responseText = result.response.text();

  try {
    const parsed: GeneratedDescription = JSON.parse(responseText);
    return parsed;
  } catch {
    throw new Error("Failed to parse AI response. Please try again.");
  }
}
