import { OpenAI } from "openai";
import { NextResponse } from "next/server";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, 
});

export async function POST(req: Request) {
  try {
    const { selection } = await req.json();

    if (!selection) {
      return NextResponse.json({ error: "No selection provided" }, { status: 400 });
    }

    // Construct the prompt
    const systemPrompt = `You are a professional Chinese education assistant.

Your task is to analyze text and provide comprehensive explanations of concepts.

Return a JSON object with the following structure:

{
"term": "Standardized term (e.g., capitalized first letter)",

"definition": "Concise and clear definition (maximum 30 characters)",

"example": "Short and specific usage example",

"related": ["Related concept 1", "Related concept 2"]

} If the text is not a clear concept, try to infer the most likely concept, or return the selected content itself as the term and its general definition.`;

    const userPrompt = `Explain this concept: "${selection}"`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = completion.choices[0].message.content;
    let result;
    try {
        result = JSON.parse(content || "{}");
    } catch (e) {
        console.error("Failed to parse JSON from AI:", content);
        // Fallback
        result = { 
            term: selection,
            definition: "Could not generate definition.",
            example: "",
            related: []
        };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI API Error:", error);
    
    return NextResponse.json({ 
        term: (error as any).selection || "Unknown Term",
        definition: "AI service unavailable. Please define manually.",
        example: "",
        related: [],
        error: error.message || "Unknown error"
    }, { status: 500 });
  }
}
