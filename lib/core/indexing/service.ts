import { prisma } from "@/lib/infrastructure/database/prisma";
import { embeddings, generateEmbedding } from "@/lib/infrastructure/ai/embedding";
import { chunkText } from "@/lib/text-processing";
import { randomUUID } from "crypto";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export class IndexingService {
  /**
   * Process an article: Chunk it, generate embeddings, and save to DB
   * 优化：添加幂等性检查，避免重复索引
   */
  static async processArticle(articleId: string, userId: string) {

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { body: true }
    });

    if (!article || !article.body || !article.body.content) {
      console.warn(`[Indexing] Article ${articleId} not found or empty`);
      return;
    }

    // 幂等性检查：如果已经有 embedding，跳过
    const existingChunks = await prisma.articleChunk.count({
      where: { articleId }
    });

    if (existingChunks > 0) {
      console.log(`[Indexing] Article ${articleId} already indexed, skipping`);
      return;
    }

    const content = article.body.content;
    const chunks = chunkText(content);

    console.log(`[Indexing] Article ${articleId}: Generated ${chunks.length} chunks`);

    // 1. Delete existing chunks first (for re-indexing)
    if (existingChunks > 0) {
      await prisma.articleChunk.deleteMany({
        where: { articleId }
      });
      console.log(`[Indexing] Deleted ${existingChunks} existing chunks`);
    }

    // 2. Process chunks in batches with retry
    const BATCH_SIZE = 20;
    const MAX_RETRIES = 3;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
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
              throw insertError; // 重新抛出以触发批次重试
            }
          }));

          success = true;
          console.log(`[Indexing] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} completed`);
        } catch (e) {
          retries++;
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.error(
            `[Indexing] Failed to process batch starting at ${i} for article ${articleId} ` +
            `(attempt ${retries}/${MAX_RETRIES}): ${errorMsg}`
          );
          
          if (retries < MAX_RETRIES) {
            // 指数退避
            const delay = Math.min(1000 * Math.pow(2, retries - 1), 10000);
            console.log(`[Indexing] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error(`[Indexing] Batch failed after ${MAX_RETRIES} retries, skipping`);
          }
        }
      }
    }

    // 3. Update Article Metadata & Embedding (Fix for Imported Content)
    try {
      const totalBlocks = chunks.length;
      // Estimate: 400 chars per minute for reading speed
      const totalReadingTime = Math.ceil(content.length / 400);

      // --- Generate AI Summary ---
      console.log(`[Indexing] Article ${articleId}: Generating AI Summary...`);
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionType: true }
      });

      let aiSummary = '';
      if (user?.subscriptionType !== 'free') {
        try {
          aiSummary = await this.generateSummary(content, user);
        } catch (err) {
          console.warn(`[Indexing] Summary generation failed, using fallback:`, err);
          aiSummary = content.slice(0, 500).replace(/\n+/g, ' ').trim();
        }
      } else {
        // Free users get simple truncated summary
        aiSummary = content.slice(0, 500).replace(/\n+/g, ' ').trim();
      }

      // Update stats and summary
      await prisma.article.update({
        where: { id: articleId },
        data: {
          totalBlocks: totalBlocks,
          totalReadingTime: totalReadingTime,
          summary: aiSummary,
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
  private static async generateSummary(text: string, user?: { subscriptionType: string } | null): Promise<string> {
 
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
