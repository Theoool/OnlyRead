import type { BaseMessage } from "@langchain/core/messages";

// ============================================
// 1. 基础类型定义
// ============================================

/** 学习主题类型 */
type Topic = string;

/** 掌握程度 (0-100) */
type MasteryLevel = number;

/** 对话步骤类型 */
type ConversationStep = 
  | "analyze_input"
  | "retrieve_knowledge" 
  | "generate_response"
  | "update_mastery"
  | "end_conversation";

// ============================================
// 2. 状态值配置类型 (支持 reducer 模式)
// ============================================

/**
 * 状态字段配置接口
 * @template T - 状态值类型
 * @template R - reducer 返回值类型
 */
interface StateFieldConfig<T, R = T> {
  /** Reducer 函数: 合并旧值和新值 */
  value: (prev: T, next: T) => R;
  /** 默认值工厂函数 */
  default: () => T;
}

// ============================================
// 3. 具体状态字段类型
// ============================================

/** 消息历史状态 - 使用 concat 合并 */
type MessagesState = StateFieldConfig<BaseMessage[], BaseMessage[]>;

/** 用户输入状态 - 直接替换 */
type UserMessageState = StateFieldConfig<string, string>;

/** 当前主题状态 - 可空，直接替换 */
type CurrentTopicState = StateFieldConfig<Topic | undefined, Topic | undefined>;

/** 掌握程度状态 - 直接替换 */
type MasteryLevelState = StateFieldConfig<MasteryLevel, MasteryLevel>;

/** 下一步决策状态 - 可空，直接替换 */
type NextStepState = StateFieldConfig<ConversationStep | undefined, ConversationStep | undefined>;

/** 推理过程状态 - 可空，直接替换 */
type ReasoningState = StateFieldConfig<string | undefined, string | undefined>;

/** 最终响应状态 - 可空，直接替换，支持任意类型 */
type FinalResponseState = StateFieldConfig<unknown | undefined, unknown | undefined>;

// ============================================
// 4. 完整状态类型
// ============================================

/**
 * 学习图谱状态接口
 * 用于 LangGraph 管理 AI 辅导学习对话的完整状态
 */
interface LearningGraphState {
  /** 对话历史记录 - 累积所有消息 */
  messages: MessagesState;
  
  /** 当前用户输入 - 最新输入覆盖旧值 */
  userMessage: UserMessageState;
  
  /** 当前学习主题 - 可动态切换 */
  currentTopic: CurrentTopicState;
  
  /** 主题掌握程度 (0-100) - 实时更新 */
  masteryLevel: MasteryLevelState;
  
  /** 下一步执行动作 - 由路由节点决定 */
  nextStep: NextStepState;
  
  /** AI 推理过程说明 - 用于可解释性 */
  reasoning: ReasoningState;
  
  /** 最终输出载荷 - 传递给前端的结果 */
  finalResponse: FinalResponseState;
}

// ============================================
// 5. 运行时状态值类型 (提取实际值类型)
// ============================================

/**
 * 从 StateFieldConfig 提取运行时值类型
 */
type ExtractStateValue<T> = T extends StateFieldConfig<infer V, any> ? V : never;

/** 学习图谱运行时状态 (用于组件/Hook) */
type LearningGraphRuntimeState = {
  [K in keyof LearningGraphState]: ExtractStateValue<LearningGraphState[K]>;
};

// 使用示例:
// const runtimeState: LearningGraphRuntimeState = {
//   messages: [],           // BaseMessage[]
//   userMessage: "",        // string
//   currentTopic: undefined, // string | undefined
//   masteryLevel: 0,        // number
//   nextStep: undefined,    // ConversationStep | undefined
//   reasoning: undefined,   // string | undefined
//   finalResponse: undefined // unknown | undefined
// };

// ============================================
// 6. 工厂函数: 创建默认状态配置
// ============================================

/**
 * 创建学习图谱状态配置的工厂函数
 * @returns 完整的 LearningGraphState 配置对象
 */
export const createLearningGraphState = (): LearningGraphState => ({
  messages: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  userMessage: {
    value: (_x, y) => y,
    default: () => "",
  },
  currentTopic: {
    value: (_x, y) => y,
    default: () => undefined,
  },
  masteryLevel: {
    value: (_x, y) => y,
    default: () => 0,
  },
  nextStep: {
    value: (_x, y) => y,
    default: () => undefined,
  },
  reasoning: {
    value: (_x, y) => y,
    default: () => undefined,
  },
  finalResponse: {
    value: (_x, y) => y,
    default: () => undefined,
  },
});

// ============================================
// 7. 辅助类型: 状态更新操作
// ============================================

/** 部分状态更新类型 (用于 setState) */
type PartialLearningGraphState = Partial<LearningGraphRuntimeState>;

/** 状态更新 Action 类型 */
type StateAction = 
  | { type: "ADD_MESSAGE"; payload: BaseMessage }
  | { type: "SET_USER_MESSAGE"; payload: string }
  | { type: "SET_TOPIC"; payload: Topic }
  | { type: "SET_MASTERY"; payload: MasteryLevel }
  | { type: "SET_NEXT_STEP"; payload: ConversationStep }
  | { type: "SET_REASONING"; payload: string }
  | { type: "SET_FINAL_RESPONSE"; payload: unknown }
  | { type: "RESET" };

// ============================================
// 8. 导出兼容原代码的常量 (保留原接口)
// ============================================

const LearningGraphState = createLearningGraphState();

// 类型导出
export type {
  Topic,
  MasteryLevel,
  ConversationStep,
  StateFieldConfig,
  LearningGraphState,
  LearningGraphRuntimeState,
  PartialLearningGraphState,
  StateAction,
  ExtractStateValue,
};
