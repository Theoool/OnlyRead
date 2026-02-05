import { prisma } from '@/lib/infrastructure/database/prisma'
import { POST } from '@/app/api/(core)/ai/chat/route'

async function main() {
  const collectionId = 'c92367f9-d37d-4c8b-b71d-8a19de84c0c2'
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { userId: true },
  })

  if (!collection) {
    console.log('Collection not found:', collectionId)
    return
  }

  const payload = {
    sessionId: 'c0846a5b-f954-411a-920a-c0d212b23c13',
    message: '你是什么',
    mode: 'qa',
    context: {
      articleIds: [],
      collectionId,
    },
  }

  const req = new Request('http://local.test/api/ai/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': collection.userId,
      'x-user-email': 'smoke@test.local',
    },
    body: JSON.stringify(payload),
  })

  const prevModel = process.env.AI_MODEL_NAME
  delete process.env.AI_MODEL_NAME

  const res = await POST(req)

  if (prevModel) process.env.AI_MODEL_NAME = prevModel

  console.log('status', res.status)
  console.log('headers', Object.fromEntries(res.headers.entries()))

  const text = await res.text()
  console.log('body', text)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
