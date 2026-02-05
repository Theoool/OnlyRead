import { prisma } from '@/lib/infrastructure/database/prisma'
import { RetrievalService } from '@/lib/core/ai/retrieval/service'

async function main() {
  const collectionId = 'c92367f9-d37d-4c8b-b71d-8a19de84c0c2'
  const query = '说些什么'

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, userId: true },
  })

  if (!collection) {
    console.log('Collection not found:', collectionId)
    return
  }

  const result = await RetrievalService.search({
    query,
    userId: collection.userId,
    filter: { collectionId },
    topK: 5,
  })

  console.log({
    case: 'collectionId',
    sources: result.sources.length,
    documentsLength: result.documents.length,
    first: result.sources[0] ?? null,
  })

  const emptyArticleId = '00000000-0000-0000-0000-000000000000'
  const fallback = await RetrievalService.search({
    query,
    userId: collection.userId,
    filter: { articleIds: [emptyArticleId] },
    topK: 5,
  })

  console.log({
    case: 'articleIds-empty',
    sources: fallback.sources.length,
    documentsLength: fallback.documents.length,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
