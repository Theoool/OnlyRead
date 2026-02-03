import { ChatOpenAI } from '@langchain/openai';
import { LegacyExplanationSchema as ExplanationSchema, LegacyQuizSchema as QuizSchema, LegacyCodeSchema as CodeSchema, UIComponentSchema } from '../../schemas';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// Helper to reliably parse JSON from LLM output (handles markdown code blocks)
function parseJSON(text: string): any {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extracting from ```json ... ```
    const match = text.match(/```json([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    // 3. Try extracting from ``` ... ```
    const matchGeneric = text.match(/```([\s\S]*?)```/);
    if (matchGeneric) {
      return JSON.parse(matchGeneric[1]);
    }
    
    // 4. Try extracting raw object {} if wrapped in other text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }

    throw new Error("Failed to parse JSON from response: " + text.substring(0, 100));
  }
}

export const explanationNode = async (state: any) => {
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0.3,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  // Build sources reference for citation
  const sourcesContext = state.sources && state.sources.length > 0
    ? `\n\nAvailable Sources:\n${state.sources.map((s: any, idx: number) => `[Source ${idx + 1}] ${s.title}`).join('\n')}`
    : "";

  // Manually instruct the model for JSON structure
  const messages = [
    new SystemMessage(`你是一位乐于助人的中文学习导师，基于用户的资料库进行回答。

规则：
1. **全中文回答**：所有解释、推理和互动必须使用简体中文。
2. 引用：当陈述具体事实、数据或引用原文时，使用 [Source: {{title}}] 进行标注。
3. 范围：如果资料库中没有相关信息，请明确说明“我在您的资料库中找不到相关内容”，除非用户明确要求，否则不要使用通用知识回答。
4. 严谨：严格基于提供的上下文，不要产生幻觉。

你可以使用标准的文本解释，或者如果概念涉及变量/逻辑（如数学、算法、模拟），你应该生成一个 'Generative App' (type: 'app')。

重要：只返回一个有效的 JSON 对象。不要包含前言或后记。

如果生成 App，请遵循此结构：
{
  "type": "app",
  "initialState": { "count": "0", "user": "{\\"name\\":\\"Bob\\"}" },
  "layout": {
    "type": "stack",
    "direction": "vertical",
    "children": [
       { "type": "text", "content": "Count is {{state.count}}" },
       { "type": "button", "label": "Increment", "onClick": [{ "type": "increment", "path": "state.count" }] }
    ]
  }
}

如果生成文本解释：
{
  "type": "explanation",
  "content": "这里是 Markdown 格式的文本..."
}

上下文:
${state.documents || "未找到相关文档。"}${sourcesContext}`),
    new HumanMessage(state.userMessage)
  ];

  try {
    const result = await llm.invoke(messages);
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const rawJson = parseJSON(text);

    // Validate against schema
    const validatedUI = UIComponentSchema.parse(rawJson);

    return {
      finalResponse: {
        reasoning: state.reasoning,
        ui: validatedUI,
        sources: state.sources || [],
        suggestedActions: [{ label: "我明白了", action: "understood" }, { label: "举个例子", action: "example" }]
      }
    };
  } catch (error) {
    console.error("Explanation Generation Error:", error);
    // Fallback response
    return {
      finalResponse: {
        reasoning: "Error generating response.",
        ui: {
          type: "explanation",
          content: "抱歉，生成解释时遇到错误，请重试。"
        },
        sources: state.sources || []
      }
    };
  }
};

export const planNode = async (state: any) => {
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  const sourcesContext = state.sources && state.sources.length > 0
    ? `\n\n可用来源 (摘要):\n${state.sources.map((s: any, idx: number) => `[来源 ${idx + 1}] ${s.title}`).join('\n')}`
    : "";

  const messages = [
    new SystemMessage(`你是一位资深的中文学习架构师。
    你的目标是分析提供的文章摘要或核心片段，为用户创建一个结构化的学习计划。
    
    计划应当：
    1. **全中文输出**。
    2. 识别选定文章中的关键主题和概念。
    3. 提出合理的阅读/学习顺序。
    4. 为每篇文章或主题建议具体的思考问题或关注点。
    
    重要：只返回一个匹配此结构的有效 JSON 对象 (使用 'explanation' 类型作为计划)：
    {
      "type": "explanation",
      "title": "Learning Plan",
      "content": "## 概览\n...\n\n## 核心概念\n- **概念 1**: 定义...\n- **概念 2**: 定义...\n\n## 建议路径\n..."
    }
    
    上下文:
    ${state.documents || "未选择文档。"}${sourcesContext}`),
    new HumanMessage("请创建一份学习计划。")
  ];

  try {
    const result = await llm.invoke(messages);
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const rawJson = parseJSON(text);
    const validatedUI = ExplanationSchema.parse(rawJson);

    return {
      finalResponse: {
        reasoning: "Generated learning plan based on document summaries.",
        ui: validatedUI,
        sources: state.sources || [],
        suggestedActions: [
          { label: "从第一个主题开始", action: "start_topic_1" }, 
          { label: "测试我的概览知识", action: "quiz_overview" }
        ]
      }
    };
  } catch (error) {
    console.error("Plan Generation Error:", error);
    return {
      finalResponse: {
        reasoning: "Error generating plan.",
        ui: { type: "explanation", content: "无法生成学习计划。" },
        sources: state.sources || []
      }
    };
  }
};

export const quizNode = async (state: any) => {
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  const context = state.documents
    ? `\n\n请严格基于以下文档事实出题：\n${state.documents}`
    : "";

  const messages = [
    new SystemMessage(`你是一位中文考官。请为主题 "${state.currentTopic}" 生成一道单项选择题。
    确保只有一个正确答案和合理的干扰项。
    ${context}

    重要：只返回一个匹配此结构的有效 JSON 对象：
    {
      "type": "quiz",
      "question": "问题描述...",
      "options": ["选项 A", "选项 B", "选项 C", "选项 D"],
      "correctIndex": 0,
      "explanation": "为什么 A 是正确的..."
    }

    不要生成代码练习。`),
    new HumanMessage(state.userMessage)
  ];

  try {
    const result = await llm.invoke(messages);
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const rawJson = parseJSON(text);
    const validatedUI = QuizSchema.parse(rawJson);

    return {
      finalResponse: {
        reasoning: state.reasoning,
        ui: validatedUI,
        sources: state.sources || [],
        suggestedActions: [{ label: "我不确定", action: "hint" }]
      }
    };
  } catch (error) {
    console.error("Quiz Generation Error:", error);
    return {
      finalResponse: {
        reasoning: "Error generating quiz.",
        ui: { type: "explanation", content: "无法生成测验。" },
        sources: state.sources || []
      }
    };
  }
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

      IMPORTANT: Return ONLY a valid JSON object matching this structure:
      {
        "type": "code",
        "language": "javascript",
        "description": "Task description...",
        "starterCode": "// TODO: Implement function...",
        "solution": "function solution() { ... }"
      }

      Do NOT return a multiple choice question.`),
    new HumanMessage(state.userMessage)
  ];

  try {
    const result = await llm.invoke(messages);
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const rawJson = parseJSON(text);
    const validatedUI = CodeSchema.parse(rawJson);

    return {
      finalResponse: {
        reasoning: state.reasoning,
        ui: validatedUI,
        sources: state.sources || []
      }
    };
  } catch (error) {
    console.error("Code Generation Error:", error);
    return {
      finalResponse: {
        reasoning: "Error generating code task.",
        ui: { type: "explanation", content: "Failed to generate code task." },
        sources: state.sources || []
      }
    };
  }
};
