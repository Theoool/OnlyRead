import { OpenAI } from "openai";
import { NextResponse } from "next/server";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// 简单的内存缓存（生产环境建议使用 Redis）
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1小时缓存

function getCacheKey(selection: string): string {
  return selection.toLowerCase().trim();
}

function getCachedResult(selection: string): any | null {
  const key = getCacheKey(selection);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedResult(selection: string, data: any): void {
  const key = getCacheKey(selection);
  cache.set(key, { data, timestamp: Date.now() });

  // 限制缓存大小
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export async function POST(req: Request) {
  try {
    const { selection } = await req.json();

    if (!selection) {
      return NextResponse.json({ error: "No selection provided" }, { status: 400 });
    }

    // 验证输入
    const trimmedSelection = selection.trim();
    if (trimmedSelection.length < 1 || trimmedSelection.length > 100) {
      return NextResponse.json(
        { error: "Selection must be between 1 and 100 characters" },
        { status: 400 }
      );
    }

    // 检查缓存
    const cached = getCachedResult(trimmedSelection);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Construct the prompt
    const systemPrompt = `你是知识解构专家，擅长将复杂概念转化为精炼、可理解的核心定义。
任务
解析用户选中的文本（可能是一个术语、短语或片段），识别其核心概念，并以结构化JSON形式输出解释。
输出规范
格式：仅返回原始JSON，不包含Markdown代码块标记。
结构要求：
{
  "term": "概念的标准名称（首字母大写或学科规范写法）",
  "definition": "一句话精准定义，严格限制在60个字符以内，聚焦本质特征不含冗余。",
  "example": "一个具象化的简短实例（20-40字），展示该概念的真实应用场景。",
  "related": ["相关概念A", "相关概念B", "相关概念C"]
}
执行逻辑
概念识别：若文本指向明确概念，直接解析；若文本模糊，推断最可能的指向；若仅为短语，解释其含义与功能。
定义策略：用"属+种差"定义法或功能性描述，确保信息密度最大化且易于理解。
示例选择：优先选择生活化、具象化场景，避免过于抽象或学术的例证。
关联概念：选择3个具有知识网络关联性的概念（如：层级上下位、因果关联、对比概念），禁止简单同义词堆砌。
质量控制
若无法识别有效概念或文本无明确含义，返回 {"error": "无法识别该文本指向的具体概念，请提供更明确的术语"}。
`;

    const userPrompt = `Explain this concept: "${trimmedSelection}"`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL_NAME || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = completion.choices[0].message.content;
    let result;
    try {
        result = JSON.parse(content || "{}");
    } catch (e) {
        console.error("Failed to parse JSON from AI:", content);
        // Fallback
        result = {
            term: trimmedSelection,
            definition: "AI 返回了无效的格式，请手动输入定义。",
            example: "",
            related: []
        };
    }

    // 如果 AI 返回错误，构造友好响应
    if (result.error) {
      result = {
        term: trimmedSelection,
        definition: "无法自动解析该概念，请手动输入定义。",
        example: "",
        related: [],
        parseError: result.error
      };
    }

    // 缓存结果
    setCachedResult(trimmedSelection, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI API Error:", error);

    return NextResponse.json({
        term: "解析失败",
        definition: "AI 服务暂时不可用，请手动输入概念定义。",
        example: "",
        related: [],
        error: error.message || "Unknown error"
    }, { status: 200 }); // 返回 200 让前端可以正常处理
  }
}
