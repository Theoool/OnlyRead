import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ExplanationSchema, QuizSchema, CodeSchema, ConceptMapSchema } from '../../schemas';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// We import individual schemas to enforce strict typing per agent
// This prevents the "Code Agent" from generating a "Quiz"

export const explanationNode = async (state: any) => {
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0.3, 
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  const context = state.documents 
    ? `\n\nReference the following retrieved documents if relevant:\n${state.documents}` 
    : "";

  const messages = [
    new SystemMessage(`You are an Expert Tutor. Your goal is to explain the topic: "${state.currentTopic}".
    Use analogies, clear structure, and a friendly tone.
    ${context}
    Output a JSON object strictly matching the 'explanation' or 'concept_map' schema.`),
    new HumanMessage(state.userMessage)
  ];

  // Allow explanation agent to choose between text or map
  const outputSchema = z.discriminatedUnion('type', [ExplanationSchema, ConceptMapSchema]);
  
  const chain = llm.withStructuredOutput(outputSchema);
  const result = await chain.invoke(messages);

  return {
    finalResponse: {
      reasoning: state.reasoning,
      ui: result,
      suggestedActions: [{ label: "Got it!", action: "understood" }, { label: "Give me an example", action: "example" }]
    }
  };
};

export const quizNode = async (state: any) => {
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0.1, 
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  const context = state.documents 
    ? `\n\nBase your question strictly on the facts from these documents:\n${state.documents}` 
    : "";

  const messages = [
    new SystemMessage(`You are an Examiner. Generate a multiple-choice question for: "${state.currentTopic}".
    Ensure one correct answer and plausible distractors.
    ${context}
    IMPORTANT: You must return a 'quiz' type object with 'options' array and 'correctIndex'. 
    DO NOT generate code exercises.`),
    new HumanMessage(state.userMessage)
  ];

  const chain = llm.withStructuredOutput(QuizSchema);
  const result = await chain.invoke(messages);

  return {
    finalResponse: {
      reasoning: state.reasoning,
      ui: result,
      suggestedActions: [{ label: "I'm not sure", action: "hint" }]
    }
  };
};

export const codeNode = async (state: any) => {
    const llm = new ChatOpenAI({
      modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
      temperature: 0.1, 
      apiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
    });

    const context = state.documents 
      ? `\n\nIncorporate concepts from these documents if applicable:\n${state.documents}` 
      : "";
  
    const messages = [
      new SystemMessage(`You are a Coding Instructor. Create a coding exercise for: "${state.currentTopic}".
      ${context}
      IMPORTANT: You must return a 'code' type object.
      'starterCode' must be valid executable code (e.g. JavaScript/TypeScript) with // TODO comments.
      Do NOT return a multiple choice question.`),
      new HumanMessage(state.userMessage)
    ];
  
    const chain = llm.withStructuredOutput(CodeSchema);
    const result = await chain.invoke(messages);
  
    return {
      finalResponse: {
        reasoning: state.reasoning,
        ui: result
      }
    };
  };
