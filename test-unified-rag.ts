require('dotenv').config();
import { prisma } from './lib/infrastructure/database/prisma';
import { unifiedGraph } from './lib/core/ai/graph/workflow';

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
      console.log("No user found, skipping execution.");
      return;
  }

  console.log(`Running test for user: ${user.id}`);

  const inputs: any = {
    userMessage: "RAG 的原理是什么？",
    userId: user.id,
    mode: 'qa',
    messages: [],
    articleIds: [], 
  };

  console.log("Invoking Unified Graph (QA Mode)...");
  try {
    const result = await unifiedGraph.invoke(inputs);
    console.log("Final Output:", JSON.stringify(result.finalResponse, null, 2));
  } catch (e) {
      console.error("Graph invocation failed:", e);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
