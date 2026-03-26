import { GoogleGenAI, Type } from "@google/genai";

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

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
  const ai = getAI();
  
  // Single multimodal call for faster processing
  const result = await ai.models.generateContent({
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
            text: `You are Sauti-Shamba, a friendly AI voice advisor for Kenyan smallholder farmers.
            The user is in ${location}.
            
            Listen to this audio and:
            1. Transcribe it accurately (keep Swahili/Sheng as is).
            2. Detect intent: market price, crop disease, weather, or multiple.
            3. Extract crop name and quantity (if mentioned).
            4. Provide advice using the latest Kenyan context (use Google Search for real-time prices/weather).
            
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
          transcription: { type: Type.STRING },
          intent: { type: Type.STRING },
          crop: { type: Type.STRING },
          recommendation: { type: Type.STRING, enum: ["SELL", "HOLD", "HEALTHY", "URGENT ACTION"] },
          responseSwahili: { type: Type.STRING },
          responseEnglish: { type: Type.STRING },
          profitEstimate: { type: Type.NUMBER },
        },
        required: ["transcription", "intent", "crop", "recommendation", "responseSwahili", "responseEnglish"],
      },
    },
  });

  return JSON.parse(result.text || "{}");
}

export async function processChat(message: string, imageBase64?: string, imageMimeType?: string, location?: string): Promise<string> {
  const ai = getAI();
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

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
    });

    return result.text || "Samahani, sikuweza kuelewa. (Sorry, I couldn't understand.)";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Samahani, kulikuwa na hitilafu katika kuelewa picha yako. Tafadhali jaribu tena. (Sorry, there was an error understanding your image. Please try again.)";
  }
}

export async function getMarketPrices() {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Scrape current 2026 Kenyan agricultural prices for maize, tomatoes, cabbages, potatoes, beans in major markets (Muthurwa, Nakuru, Eldoret, Kisumu, Mombasa). Return clean structured JSON as an array of objects with keys: crop, price, trend (UP/DOWN/STABLE), market, change.",
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            crop: { type: Type.STRING },
            price: { type: Type.STRING },
            trend: { type: Type.STRING, enum: ["UP", "DOWN", "STABLE"] },
            market: { type: Type.STRING },
            change: { type: Type.STRING },
          },
          required: ["crop", "price", "trend", "market"],
        },
      },
    }
  });
  return JSON.parse(response.text || "[]");
}

export async function getWeatherForecast(location: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Scrape 3-day weather forecast (rain, temperature) for ${location} county, Kenya. Include short farming impact notes. Return clean structured JSON with 'summary' (string) and 'forecast' (array of objects with day, temp, condition, impact).`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          forecast: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                temp: { type: Type.STRING },
                condition: { type: Type.STRING },
                impact: { type: Type.STRING },
              },
              required: ["day", "temp", "condition", "impact"],
            },
          },
        },
        required: ["summary", "forecast"],
      },
    }
  });
  return JSON.parse(response.text || "{}");
}
