import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface SautiResponse {
  crop: string;
  recommendation: "SELL" | "HOLD" | "HEALTHY" | "URGENT ACTION";
  responseSwahili: string;
  responseEnglish: string;
  profitEstimate?: number;
  intent: string;
  transcription: string;
}

export async function processVoiceNote(audioBase64: string, mimeType: string, location: string): Promise<SautiResponse> {
  // Step 1: Transcribe the audio
  const transcriptionResult = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType,
            },
          },
          {
            text: "Transcribe this audio accurately. If it's in Swahili or Sheng, keep it in that language. If it's English, keep it in English. Return ONLY the transcription text.",
          },
        ],
      },
    ],
  });

  const transcription = transcriptionResult.text || "";

  // Step 2: Generate advice based on transcription using Search
  const adviceResult = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `You are Sauti-Shamba, a friendly AI voice advisor for Kenyan smallholder farmers.
            The user is in ${location}.
            
            Transcription of user's voice note: "${transcription}"
            
            1. Detect intent: market price, crop disease, weather, or multiple.
            2. Extract crop name and quantity (if mentioned).
            3. Provide advice using the latest Kenyan context (use Google Search for real-time prices/weather).
            
            Rules:
            - Always reply in BOTH Swahili (first) and English.
            - Swahili response MUST start with: "Mazao yako: [crop] — [SELL/HOLD/HEALTHY/URGENT]"
            - For disease: give 1-2 easy local remedies.
            - If quantity in kg is mentioned, calculate profit estimate based on current market prices (approximate: Maize 40/kg, Tomatoes 80/kg, Cabbages 30/kg, Potatoes 50/kg, Beans 120/kg).
            
            Return the result in JSON format.`,
          },
        ],
      },
    ],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          crop: { type: Type.STRING },
          recommendation: { type: Type.STRING, enum: ["SELL", "HOLD", "HEALTHY", "URGENT ACTION"] },
          responseSwahili: { type: Type.STRING },
          responseEnglish: { type: Type.STRING },
          profitEstimate: { type: Type.NUMBER },
        },
        required: ["intent", "crop", "recommendation", "responseSwahili", "responseEnglish"],
      },
    },
  });

  const advice = JSON.parse(adviceResult.text || "{}");
  
  return {
    ...advice,
    transcription,
  };
}

export async function processChat(message: string, imageBase64?: string, imageMimeType?: string, location?: string): Promise<string> {
  const parts: any[] = [
    {
      text: `You are Sauti-Shamba, a friendly AI farm advisor for smallholder farmers in Kenya. 
      The user is currently in ${location || 'Kenya'}.
      
      Your goal is to provide specific, practical, and actionable farm advice. 
      ${imageBase64 ? "The user has uploaded an image. Please analyze it carefully. Identify the crop if possible, and check for any signs of pests, diseases, or nutrient deficiencies. Provide a diagnosis and suggest 1-2 local, affordable remedies." : ""}
      
      Always respond in a helpful, encouraging tone.
      Respond in Swahili first, then English.
      
      User message: ${message || (imageBase64 ? "Please analyze this image of my farm/crop." : "")}`,
    },
  ];

  if (imageBase64) {
    parts.push({
      inlineData: {
        data: imageBase64,
        mimeType: imageMimeType || "image/jpeg",
      },
    });
  }

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts }],
  });

  return result.text || "Samahani, sikuweza kuelewa. (Sorry, I couldn't understand.)";
}

export async function getMarketPrices() {
  // Simulating the KenyaMarketChecker agent
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Scrape current 2026 Kenyan agricultural prices for maize, tomatoes, cabbages, potatoes, beans in major counties (Nakuru, Nairobi, Eldoret, Kisumu, Mombasa). Return clean structured JSON.",
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text || "[]");
}

export async function getWeatherForecast(location: string) {
  // Simulating the KenyaWeatherChecker agent
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Scrape 3-day weather forecast (rain, temperature) for ${location} county, Kenya. Include short farming impact notes. Return clean structured JSON.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(response.text || "{}");
}
