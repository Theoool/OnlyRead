import { prisma } from '@/lib/infrastructure/database/prisma';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { kmeans } from 'ml-kmeans';

// 辅助函数：计算欧几里得距离
function euclideanDistance(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// Schema for Concept Extraction
const ConceptExtractionSchema = z.object({
  concepts: z.array(z.object({
    term: z.string().describe("概念名称"),
    definition: z.string().describe("基于原文的简明定义"),
    category: z.string().describe("概念类别 (例如: 核心原理, 技术术语, 历史背景)"),
    importance: z.number().min(1).max(5).describe("重要性 1-5"),
    prerequisites: z.array(z.string()).optional().describe("前置知识点")
  })),
  overview: z.string().describe("书籍/集合的高层级中文摘要"),
  learningPath: z.array(z.object({
    phase: z.string(),
    concepts: z.array(z.string()),
    description: z.string()
  })).describe("建议的学习阶段")
});

export class ConceptExtractionService {
  private static llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  /**
   * Analyze a Collection (Book) to extract key concepts and build a syllabus.
   * Uses a hybrid strategy:
   * 1. If vectors exist, use K-means clustering to find representative chunks.
   * 2. Fallback to Article Summaries if vectors are sparse.
   */
  static async analyzeCollection(collectionId: string, userId: string) {
    console.log(`[ConceptExtraction] Starting analysis for collection: ${collectionId}`);

    // Try Vector Clustering First
    let contextText = await this.generateSyllabusFromVectors(collectionId, userId);

    // Fallback: If vector clustering returned empty or failed, use article summaries
    if (!contextText) {
        console.log(`[ConceptExtraction] Vector clustering insufficient, falling back to summaries.`);
        const articles = await prisma.article.findMany({
          where: { collectionId, userId, deletedAt: null },
          orderBy: { order: 'asc' },
          select: { id: true, title: true, summary: true }
        });

        if (articles.length === 0) {
          throw new Error("Collection has no articles to analyze.");
        }

        contextText = articles.map(a => 
          `章节: ${a.title}\n摘要: ${a.summary || "无摘要"}`
        ).join("\n\n");
    }

    // 3. Extract Concepts via LLM
    const structuredData = await this.extractConceptsFromText(contextText);

    // 4. Save to Database
    const createdConcepts = [];

    for (const item of structuredData.concepts) {
      // Check if concept exists
      const existing = await prisma.concept.findFirst({
        where: { userId, term: item.term }
      });

      if (existing) {
        createdConcepts.push(existing);
        continue;
      }

      // Create new concept
      const concept = await prisma.concept.create({
        data: {
          userId,
          term: item.term,
          aiDefinition: item.definition,
          myDefinition: "", 
          myExample: "",
          confidence: 0,
          isAiCollected: true,
          aiRelatedConcepts: item.prerequisites || [],
          // We don't link to a specific article easily with clustering, leaving null is fine
          sourceArticleId: null 
        }
      });
      createdConcepts.push(concept);
    }

    console.log(`[ConceptExtraction] Extracted ${createdConcepts.length} concepts.`);

    return {
      overview: structuredData.overview,
      learningPath: structuredData.learningPath,
      concepts: createdConcepts
    };
  }

  /**
   * Generate context from vector clustering
   */
  private static async generateSyllabusFromVectors(collectionId: string, userId: string): Promise<string | null> {
      try {
          // 1. Fetch chunks with embeddings
          const chunks = await prisma.$queryRaw<Array<{ content: string; embedding: string }>>`
            SELECT c.content, c.embedding::text 
            FROM article_chunks c
            JOIN articles a ON c.article_id = a.id
            WHERE a.collection_id = ${collectionId}::uuid
            AND c.user_id = ${userId}::uuid
            AND c.embedding IS NOT NULL
            LIMIT 2000; 
          `;
          // Limit 2000 to prevent OOM on massive books

          if (chunks.length < 10) return null; // Too few chunks for clustering

          // 2. Parse Vectors
          const data = chunks.map(c => JSON.parse(c.embedding) as number[]);
          
          // 3. K-means Clustering
          // Dynamic K: sqrt(N/2) usually works well for document topics, capped at 15
          const k = Math.min(Math.floor(Math.sqrt(chunks.length / 2)), 15);
          console.log(`[ConceptExtraction] Clustering ${chunks.length} chunks into ${k} topics.`);
          
          const result = kmeans(data, k, { initialization: 'kmeans++' });

          // 4. Find Representative Chunks (closest to centroid)
          const representativeContents: string[] = [];
          
          result.centroids.forEach((centroid, clusterIndex) => {
            let minDist = Infinity;
            let closestChunkIndex = -1;
        
            data.forEach((vec, i) => {
              if (result.clusters[i] === clusterIndex) {
                const dist = euclideanDistance(centroid, vec);
                if (dist < minDist) {
                  minDist = dist;
                  closestChunkIndex = i;
                }
              }
            });
        
            if (closestChunkIndex !== -1) {
                // Prepend a "Topic" marker to help LLM distinguish context switching
                representativeContents.push(`[主题片段 ${clusterIndex + 1}]: ${chunks[closestChunkIndex].content}`);
            }
          });

          return representativeContents.join("\n\n");

      } catch (e) {
          console.error("[ConceptExtraction] Vector clustering failed:", e);
          return null;
      }
  }

  private static async extractConceptsFromText(text: string) {
    const messages = [
      new SystemMessage(`你是一位资深的中文课程设计师。
      请分析提供的书籍内容片段（可能是摘要或核心选段），提取出一个结构化的“知识图谱”和“学习大纲”。
      
      要求：
      1. **全中文输出**：所有字段必须使用简体中文。
      2. **核心优先**：提取本书最核心的 10-20 个概念。
      3. **去引用化**：不要在输出中包含具体的“来源章节”或引用链接，仅关注知识本身。
      4. **专业且易懂**：定义应当准确且适合学习者理解。

      输出必须严格符合以下 JSON 格式：
      {
        "concepts": [ { "term": "术语名称", "definition": "简明定义", "category": "类别", "importance": 1-5, "prerequisites": ["前置术语"] } ],
        "overview": "书籍的整体中文介绍",
        "learningPath": [ { "phase": "阶段一：基础入门", "concepts": ["术语1", "术语2"], "description": "阶段描述" } ]
      }`),
      new HumanMessage(text)
    ];

    const chain = this.llm.withStructuredOutput(ConceptExtractionSchema);
    return await chain.invoke(messages);
  }
}
