import { StateGraph, END } from '@langchain/langgraph';
import { LearningGraphState, ILearningGraphState } from './state';
import { supervisorNode } from './nodes/supervisor';
import { explanationNode, quizNode, codeNode, planNode } from './nodes/generators';
import { retrieverNode } from './nodes/retriever';

// Initialize the graph
const workflow = new StateGraph<ILearningGraphState>({
  channels: LearningGraphState
});

// Add Nodes
// @ts-ignore
workflow.addNode("supervisor", supervisorNode);
// @ts-ignore
workflow.addNode("retriever", retrieverNode);
// @ts-ignore
workflow.addNode("explain", explanationNode);
// @ts-ignore
workflow.addNode("quiz", quizNode);
// @ts-ignore
workflow.addNode("code", codeNode);
// @ts-ignore
workflow.addNode("plan", planNode);

// Define Edges
// 1. Start -> Supervisor (Determine Intent)
// @ts-ignore
workflow.setEntryPoint("supervisor");

// 2. Supervisor -> [Retriever | End]
// If 'end', we stop. If we need to generate something, we go to retriever first to get context.
workflow.addConditionalEdges(
  // @ts-ignore
  "supervisor",
  (state: any) => {
    if (state.nextStep === 'end') return 'end';
    return 'retriever';
  },
  {
    retriever: "retriever",
    end: END
  }
);

// 3. Retriever -> [Explain | Quiz | Code | Plan]
// After retrieving documents, we proceed to the step decided by the supervisor
workflow.addConditionalEdges(
  // @ts-ignore
  "retriever",
  (state: any) => state.nextStep,
  {
    explain: "explain",
    quiz: "quiz",
    code: "code",
    plan: "plan"
  }
);

// 4. Generators -> End
// @ts-ignore
workflow.addEdge("explain", END);
// @ts-ignore
workflow.addEdge("quiz", END);
// @ts-ignore
workflow.addEdge("code", END);
// @ts-ignore
workflow.addEdge("plan", END);

// Compile
export const learningGraph = workflow.compile();
