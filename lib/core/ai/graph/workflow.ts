import { StateGraph, END } from '@langchain/langgraph';
import { GraphState, IGraphState } from './state';
import { supervisorNode } from './nodes/supervisor';
import { explanationNode, quizNode, codeNode, planNode } from './nodes/generators';
import { retrieverNode } from './nodes/retriever';
import { queryRewriteNode } from './nodes/query-rewrite';

// Initialize the graph
const workflow: any = new StateGraph<IGraphState>({
  channels: GraphState as any
});

// Add Nodes
workflow.addNode("supervisor", supervisorNode);
workflow.addNode("query_rewrite", queryRewriteNode);
workflow.addNode("retriever", retrieverNode);
workflow.addNode("explain", explanationNode);
workflow.addNode("quiz", quizNode);
workflow.addNode("code", codeNode);
workflow.addNode("plan", planNode);

// Define Edges
// 1. Start -> Supervisor (Determine Intent)
workflow.setEntryPoint("supervisor" as any);

// 2. Supervisor -> [QueryRewrite | Generator | End]
workflow.addConditionalEdges(
  "supervisor" as any,
  (state: IGraphState) => {
    if (state.nextStep === 'end') return 'end';
    if (state.retrievalPolicy && !state.retrievalPolicy.enabled) return state.nextStep!;
    if (state.retrievalPolicy?.rewriteQuery && (state.messages?.length ?? 0) > 0) return 'query_rewrite';
    return 'retriever';
  },
  {
    query_rewrite: "query_rewrite",
    retriever: "retriever",
    explain: "explain",
    quiz: "quiz",
    code: "code",
    plan: "plan",
    end: END
  }
);

// 3. QueryRewrite -> Retriever
workflow.addEdge("query_rewrite" as any, "retriever" as any);

// 4. Retriever -> [Generators]
workflow.addConditionalEdges(
  "retriever" as any,
  (state: IGraphState) => state.nextStep!,
  {
    explain: "explain",
    quiz: "quiz",
    code: "code",
    plan: "plan",
  }
);

// 5. Generators -> End
workflow.addEdge("explain" as any, END);
workflow.addEdge("quiz" as any, END);
workflow.addEdge("code" as any, END);
workflow.addEdge("plan" as any, END);

// Compile
export const unifiedGraph = workflow.compile();
