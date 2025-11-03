import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Input validation schema
const searchSchema = z.object({
  query: z.string().min(1).max(200)
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Input validation
    const body = await req.json();
    const validationResult = searchSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.log("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input format.",
          details: validationResult.error.issues 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { query } = validationResult.data;
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const systemPrompt = `You are a nutrition database assistant. When a user searches for a food, return a JSON array of 3-5 food items matching their search with detailed nutrition information.

Each food item must have:
- name: Full descriptive name
- calories: Total calories per serving
- protein: Protein in grams
- carbs: Carbohydrates in grams
- fat: Fat in grams
- serving_size: Numeric serving size (e.g., 100, 1, 3)
- serving_unit: Unit of measurement (e.g., "g", "oz", "cup", "piece", "serving")

Return ONLY a JSON array with no additional text. Example format:
[
  {
    "name": "Chicken Breast (Grilled)",
    "calories": 165,
    "protein": 31,
    "carbs": 0,
    "fat": 3.6,
    "serving_size": "100",
    "serving_unit": "g"
  }
]

Provide accurate nutritional data based on common food databases like USDA.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Find nutrition information for: ${query}` }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      throw new Error("Failed to get nutrition data");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Extract JSON from response (handling potential markdown code blocks)
    let foodsArray = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        foodsArray = JSON.parse(jsonMatch[0]);
      } else {
        foodsArray = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse nutrition data");
    }

    return new Response(
      JSON.stringify({ foods: foodsArray }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Food search error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
