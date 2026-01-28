import { StateGraph, END } from '@langchain/langgraph';
import { LearningGraphState } from './state';
import { supervisorNode } from './nodes/supervisor';
import { explanationNode, quizNode, codeNode } from './nodes/generators';
import { retrieverNode } from './nodes/retriever';

// Initialize the graph
const workflow = new StateGraph({
  channels: LearningGraphState
});

// Add Nodes
workflow.addNode("supervisor", supervisorNode);
workflow.addNode("retriever", retrieverNode);
workflow.addNode("explain", explanationNode);
workflow.addNode("quiz", quizNode);
workflow.addNode("code", codeNode);

// Define Edges
// 1. Start -> Supervisor (Determine Intent)
workflow.setEntryPoint("supervisor");

// 2. Supervisor -> [Retriever | End]
// If 'end', we stop. If we need to generate something, we go to retriever first to get context.
workflow.addConditionalEdges(
  "supervisor",
  (state) => {
    if (state.nextStep === 'end') return 'end';
    return 'retriever';
  },
  {
    retriever: "retriever",
    end: END
  }
);

// 3. Retriever -> [Explain | Quiz | Code]
// After retrieving documents, we proceed to the step decided by the supervisor
workflow.addConditionalEdges(
  "retriever",
  (state) => state.nextStep,
  {
    explain: "explain",
    quiz: "quiz",
    code: "code"
  }
);

// 4. Generators -> End
workflow.addEdge("explain", END);
workflow.addEdge("quiz", END);
workflow.addEdge("code", END);

// Compile
export const learningGraph = workflow.compile();
