import { prisma } from "@/lib/infrastructure/database/prisma";
import { embeddings, generateEmbedding } from "@/lib/infrastructure/ai/embedding";
import { chunkText } from "@/lib/text-processing";
import { randomUUID } from "crypto";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { User } from "@/lib/store/useAuthStore";

export class IndexingService {
  /**
   * Process an article: Chunk it, generate embeddings, and save to DB
   */
  static async processArticle(articleId: string, userId: string, user?: User | null) {

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { body: true }
    });

    if (!article || !article.body || !article.body.content) {
      console.warn(`[Indexing] Article ${articleId} not found or empty`);
      return;
    }

    const content = article.body.content;
    const chunks = chunkText(content);

    console.log(`[Indexing] Article ${articleId}: Generated ${chunks.length} chunks`);

    // 1. Delete existing chunks first (idempotency)
    await prisma.articleChunk.deleteMany({
      where: { articleId }
    });

    // 2. Process chunks in batches
    const BATCH_SIZE = 20;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      try {
        const sanitizedBatch = batch.map(t => t.replace(/\n/g, ' '));
        const vectors = await embeddings.embedDocuments(sanitizedBatch);

        await Promise.all(batch.map(async (chunkContent, idx) => {
          const embedding = vectors[idx];
          const chunkId = randomUUID();

          try {
            await prisma.$executeRaw`
              INSERT INTO "article_chunks" (
                "id", "user_id", "article_id", "order", "content", "embedding", "created_at"
              ) VALUES (
                ${chunkId}::uuid,
                ${userId}::uuid,
                ${articleId}::uuid,
                ${i + idx},
                ${chunkContent},
                ${JSON.stringify(embedding)}::vector,
                NOW()
              )
            `;
          } catch (insertError) {
            console.error(`[Indexing] Failed to insert chunk ${i + idx} for article ${articleId}`, insertError);
          }
        }));
      } catch (e) {
        console.error(`[Indexing] Failed to generate embeddings for batch starting at ${i} for article ${articleId}`, e);
      }
    }

    // 3. Update Article Metadata & Embedding (Fix for Imported Content)
    try {
      const totalBlocks = chunks.length;
      // Estimate: 400 chars per minute for reading speed
      const totalReadingTime = Math.ceil(content.length / 400);

      // --- NEW: Generate AI Summary ---
      console.log(`[Indexing] Article ${articleId}: Generating AI Summary...`);
     
     
      const aiSummary = await this.generateSummary(content, user);
      // --------------------------------
      console.log(`[Indexing] Article ${articleId}: AI Summary generated`, aiSummary);
 
      // Update stats
      await prisma.article.update({
        where: { id: articleId },
        data: {
          totalBlocks: totalBlocks,
          totalReadingTime: totalReadingTime,
          summary: aiSummary, // Save the generated summary
        }
      });

      // Update Article-level Embedding (Title + Summary + first 500 chars)
      const title = article.title || 'Untitled';
      const domain = article.domain || '';
      // Use summary in the embedding text for better retrieval matching
      const textToEmbed = `Title: ${title}\nDomain: ${domain}\nSummary: ${aiSummary}\nContent: ${content.slice(0, 500)}`;

      const articleEmbedding = await generateEmbedding(textToEmbed);

      await prisma.$executeRaw`
        UPDATE articles 
        SET 
          embedding = ${JSON.stringify(articleEmbedding)}::vector(1536),
          "searchVector" = to_tsvector('simple', ${title} || ' ' || ${aiSummary} || ' ' || ${content})
        WHERE id = ${articleId}::uuid
      `;

      console.log(`[Indexing] Article ${articleId}: Metadata & Embeddings updated`);

    } catch (e) {
      console.error(`[Indexing] Failed to update article metadata/embedding for ${articleId}`, e);
    }

    console.log(`[Indexing] Article ${articleId}: Indexing complete`);
  }

  /**
   * Generates a structured summary of the content using LLM.
   */
  private static async generateSummary(text: string, user?: User | null): Promise<string> {
    console.log(user);
 
    if (user?.subscriptionType === 'free') {
      return "";
    } else {
       try {
      const llm = new ChatOpenAI({
        modelName: process.env.AI_MODEL_NAME,
        temperature: 0.3,
        apiKey: process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.OPENAI_BASE_URL },
      });

      // Truncate text to avoid token limits (approx 50k chars is usually safe for 128k context models)
      // We focus on the implementation of a "Macro-Summary"
      const truncatedText = text.length > 50000 ? text.slice(0, 50000) + "...(truncated)" : text;

      const response = await llm.invoke([
        new SystemMessage(`You are an expert content summarizer. 
Your goal is to create a comprehensive yet concise summary of the provided text.
The summary will be used to understand the core topics and logic of the document without reading the whole text.

Output Format:
1. **Core Subject**: One sentence describing what this is about.
2. **Key Concepts**: A bullet list of 3-5 main concepts or entities defined in the text.
3. **Logical Outline**: A brief paragraph explaining the flow or argument of the text.

Keep the total length under 400 words. Language: Chinese (Simplified).`),
        new HumanMessage(`Create a structured summary for the following content:\n\n${truncatedText}`)
      ]);

      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } catch (error) {
      console.error("[Indexing] Summary generation failed:", error);
      // Fallback: return a simple slice
      return text.slice(0, 300) + "...";
    }
    }
    
   
  }
}
