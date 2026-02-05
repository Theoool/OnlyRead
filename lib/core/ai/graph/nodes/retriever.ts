import { RetrievalService } from '../../retrieval/service';
import { IGraphState } from '../state';
import { emitAiEvent } from '../../streaming/context';

function formatDocuments(sources: any[]) {
  return sources
    .map(
      (s, idx) =>
        `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`,
    )
    .join('\n\n')
}

export const retrieverNode = async (state: IGraphState) => {
  emitAiEvent({ type: 'step', data: { name: 'retriever' } })
  console.log(`[RetrieverNode] Mode: ${state.mode}, Query: ${state.userMessage}`);

  const policy = state.retrievalPolicy
  if (policy && !policy.enabled) {
    return { documents: '', sources: [] }
  }

  const retrievalMode = policy?.mode || (state.nextStep === 'plan' ? 'comprehensive' : 'fast');
  const query = state.retrievalQuery || state.userMessage
  const topK = policy?.topK ?? state.retrievalTopK ?? 5

  const result = await RetrievalService.search({
    query,
    userId: state.userId,
    filter: {
        articleIds: state.articleIds,
        collectionId: state.collectionId,
    },
    mode: retrievalMode,
    topK
  });

  const minSimilarity = policy?.minSimilarity ?? 0
  const minSources = policy?.minSources ?? 0
  const filteredSources = result.sources.filter((s) => (s.similarity ?? 0) >= minSimilarity)

  emitAiEvent({
    type: 'sources',
    data: {
      count: filteredSources.length,
      minSimilarity,
      minSources,
      sources: filteredSources.map((s) => ({
        articleId: s.articleId,
        title: s.title,
        excerpt: s.excerpt,
        similarity: s.similarity,
        domain: s.domain,
      })),
    },
  })

  if (filteredSources.length < minSources) {
    return { documents: '', sources: [] }
  }

  return {
    documents: formatDocuments(filteredSources),
    sources: filteredSources.map(s => ({
        articleId: s.articleId,
        title: s.title,
        excerpt: s.excerpt,
        similarity: s.similarity,
        domain: s.domain
    }))
  };
};
