import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { prisma } from '@/lib/infrastructure/database/prisma';

interface MessageForSummary {
  role: string;
  content: string | null;
}

/**
 * Service for generating and managing conversation summaries
 * Implements sliding window + summarization strategy for long conversations
 */
export class SummaryService {
  // Thresholds for summary generation
  static readonly SUMMARY_TRIGGER_THRESHOLD = 20; // Generate summary after 20 messages (10 rounds)
  static readonly SUMMARY_UPDATE_INTERVAL = 10;   // Update summary every 10 new messages

  /**
   * Check if summary generation is needed for a session
   */
  static shouldGenerateSummary(messageCount: number, hasExistingSummary: boolean): boolean {
    if (!hasExistingSummary && messageCount >= this.SUMMARY_TRIGGER_THRESHOLD) {
      return true;
    }
    if (hasExistingSummary && messageCount % this.SUMMARY_UPDATE_INTERVAL === 0) {
      return true;
    }
    return false;
  }

  /**
   * Generate a summary from conversation messages
   */
  static async generateSummary(messages: MessageForSummary[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    const llm = new ChatOpenAI({
      modelName: process.env.AI_MODEL_NAME || 'gpt-4o-mini', // Use mini for cost efficiency
      temperature: 0.3,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
    });

    // Format messages for summarization
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const summaryPrompt = `Summarize the following conversation concisely. 
Focus on:
1. Main topics discussed
2. Key questions asked by the user
3. Important information provided
4. Current learning context/topic

Keep the summary under 200 words. Be specific about what has been covered.

Conversation:
${conversationText}`;

    try {
      const result = await llm.invoke([
        new SystemMessage('You are a conversation summarizer. Create concise, informative summaries.'),
        new HumanMessage(summaryPrompt)
      ]);

      const summary = typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content);

      return summary.trim();
    } catch (error) {
      console.error('[SummaryService] Failed to generate summary:', error);
      // Fallback: return truncated conversation
      return this.createFallbackSummary(messages);
    }
  }

  /**
   * Create a simple fallback summary when LLM fails
   */
  private static createFallbackSummary(messages: MessageForSummary[]): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const topics = userMessages
      .map(m => (m.content || '').slice(0, 50))
      .join('; ');
    
    return `Conversation covered: ${topics.slice(0, 200)}...`;
  }

  /**
   * Generate and save summary for a session
   */
  static async generateAndSaveSummary(sessionId: string): Promise<string | null> {
    try {
      // Fetch all messages for the session
      const messages = await prisma.learningMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true }
      });

      if (messages.length < this.SUMMARY_TRIGGER_THRESHOLD) {
        return null;
      }

      // Get messages that are not in the recent window (to be summarized)
      const recentWindowSize = 20; // Keep last 10 rounds in detail
      const messagesToSummarize = messages.slice(0, -recentWindowSize);
      
      if (messagesToSummarize.length === 0) {
        return null;
      }

      // Generate summary
      const summary = await this.generateSummary(messagesToSummarize);

      // Save to session
      await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          summary,
          summaryUpdatedAt: new Date(),
          messageCount: messages.length
        }
      });

      console.log(`[SummaryService] Generated summary for session ${sessionId}: ${summary.slice(0, 100)}...`);
      return summary;
    } catch (error) {
      console.error('[SummaryService] Error generating session summary:', error);
      return null;
    }
  }

  /**
   * Get or create summary for a session
   */
  static async getSummary(sessionId: string, forceRegenerate = false): Promise<string | null> {
    try {
      const session = await prisma.learningSession.findUnique({
        where: { id: sessionId },
        select: { summary: true, messageCount: true, summaryUpdatedAt: true }
      });

      if (!session) {
        return null;
      }

      // Check if we need to regenerate
      const shouldRegenerate = forceRegenerate || 
        this.shouldGenerateSummary(session.messageCount, !!session.summary);

      if (shouldRegenerate || !session.summary) {
        return this.generateAndSaveSummary(sessionId);
      }

      return session.summary;
    } catch (error) {
      console.error('[SummaryService] Error getting summary:', error);
      return null;
    }
  }

  /**
   * Increment message count for a session
   */
  static async incrementMessageCount(sessionId: string): Promise<void> {
    try {
      await prisma.learningSession.update({
        where: { id: sessionId },
        data: {
          messageCount: {
            increment: 1
          }
        }
      });
    } catch (error) {
      console.error('[SummaryService] Error incrementing message count:', error);
    }
  }
}
