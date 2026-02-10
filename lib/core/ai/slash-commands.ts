/**
 * Slash Commands Parser
 * 
 * 斜杠命令解析器，支持在输入框中通过 / 命令快速切换模式或获取帮助
 * 类似 Slack/Discord 的交互体验
 */

export type ModeType = 'qa' | 'tutor' | 'copilot';

export interface SlashCommand {
  command: string;
  description: string;
  aliases?: string[];
  handler: (args?: string) => CommandResult;
}

export interface CommandResult {
  type: 'mode_switch' | 'system_message' | 'help' | 'unknown' | 'ui_intent';
  message?: string;
  mode?: ModeType;
  uiIntent?: string;
  uiIntentArgs?: string;
  commands?: Array<{ command: string; description: string }>;
}

const commands: SlashCommand[] = [
  // ===== 模式切换命令 =====
  {
    command: '/qa',
    description: '切换到 QA 模式（快速问答）',
    aliases: ['/quick'],
    handler: () => ({
      type: 'mode_switch',
      mode: 'qa',
      message: '已切换到 QA 模式：快速问答，简洁回答',
    }),
  },
  {
    command: '/tutor',
    description: '切换到 Tutor 模式（深度学习）',
    aliases: ['/learn', '/study'],
    handler: () => ({
      type: 'mode_switch',
      mode: 'tutor',
      message: '已切换到 Tutor 模式：AI 导师将引导你的学习',
    }),
  },
  {
    command: '/copilot',
    description: '切换到 Copilot 模式（上下文辅助）',
    aliases: ['/assist', '/help'],
    handler: () => ({
      type: 'mode_switch',
      mode: 'copilot',
      message: '已切换到 Copilot 模式：基于当前内容提供辅助',
    }),
  },
  // ===== UI Intent Skills =====
  {
    command: '/flashcard',
    description: '生成记忆闪卡（可指定主题，如 /flashcard React Hooks）',
    aliases: ['/fc', '/卡片'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'flashcard',
      uiIntentArgs: args,
      message: args ? `生成闪卡: ${args}` : '生成记忆闪卡',
    }),
  },
  {
    command: '/quiz',
    description: '生成互动测验（可指定题目数量，如 /quiz 5道题）',
    aliases: ['/test', '/测验', '/考我'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'quiz',
      uiIntentArgs: args,
      message: args ? `生成测验: ${args}` : '生成互动测验',
    }),
  },
  {
    command: '/explain',
    description: '解释当前内容（可指定方式，如 /explain 简单点）',
    aliases: ['/exp', '/解释', '/说明'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'text',
      uiIntentArgs: args,
      message: args ? `解释: ${args}` : '解释当前内容',
    }),
  },
  {
    command: '/mindmap',
    description: '生成思维导图（可指定主题，如 /mindmap 知识体系）',
    aliases: ['/map', '/思维导图', '/脑图'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'mindmap',
      uiIntentArgs: args,
      message: args ? `生成思维导图: ${args}` : '生成思维导图',
    }),
  },
  {
    command: '/summary',
    description: '生成要点摘要（可指定长度，如 /summary 3句话）',
    aliases: ['/sum', '/总结', '/摘要'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'summary',
      uiIntentArgs: args,
      message: args ? `生成摘要: ${args}` : '生成要点摘要',
    }),
  },
  {
    command: '/compare',
    description: '对比分析（需指定两个概念，如 /compare A vs B）',
    aliases: ['/vs', '/对比', '/比较'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'comparison',
      uiIntentArgs: args,
      message: args ? `对比分析: ${args}` : '进行对比分析',
    }),
  },
  {
    command: '/timeline',
    description: '生成时间线（可指定主题，如 /timeline 发展历程）',
    aliases: ['/time', '/时间线', '/历程'],
    handler: (args) => ({
      type: 'ui_intent',
      uiIntent: 'timeline',
      uiIntentArgs: args,
      message: args ? `生成时间线: ${args}` : '生成时间线',
    }),
  },
  // ===== 系统命令 =====
  {
    command: '/mode',
    description: '显示当前模式',
    handler: (currentMode?: string) => ({
      type: 'system_message',
      message: `当前模式: ${currentMode || '未设置'}。可用模式: /qa, /tutor, /copilot`,
    }),
  },
  {
    command: '/help',
    description: '显示所有可用命令',
    aliases: ['/commands', '/?'],
    handler: () => ({
      type: 'help',
      commands: commands.map(cmd => ({
        command: cmd.command,
        description: cmd.description,
      })),
    }),
  },
];

/**
 * 解析输入文本，检查是否为斜杠命令
 */
export function parseSlashCommand(input: string, currentMode?: ModeType): CommandResult | null {
  const trimmed = input.trim();
  
  // 必须以 / 开头
  if (!trimmed.startsWith('/')) {
    return null;
  }
  
  // 提取命令名和参数
  const parts = trimmed.split(' ');
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');
  
  // 查找匹配的命令
  const command = commands.find(
    cmd => cmd.command === cmdName || cmd.aliases?.includes(cmdName)
  );
  
  if (!command) {
    return {
      type: 'unknown',
      message: `未知命令: ${cmdName}。输入 /help 查看所有命令`,
    };
  }
  
  // 执行命令
  const result = command.handler(args);
  
  // 对于 /mode 命令，传入当前模式
  if (command.command === '/mode') {
    return command.handler(currentMode);
  }
  
  return result;
}

/**
 * 检查输入是否以 / 开头（用于触发命令提示）
 */
export function isSlashCommandInput(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * 获取匹配的命令列表（用于 autocomplete）
 */
export function getMatchingCommands(input: string): Array<{ command: string; description: string }> {
  const trimmed = input.trim().toLowerCase();
  
  if (!trimmed.startsWith('/')) {
    return [];
  }
  
  const query = trimmed.slice(1); // 去掉 /
  
  return commands
    .filter(cmd => {
      const matchCommand = cmd.command.slice(1).startsWith(query);
      const matchAlias = cmd.aliases?.some(alias => alias.slice(1).startsWith(query));
      return matchCommand || matchAlias;
    })
    .map(cmd => ({
      command: cmd.command,
      description: cmd.description,
    }));
}

/**
 * 获取所有可用命令（用于 help）
 */
export function getAllCommands(): Array<{ command: string; description: string; aliases?: string[] }> {
  return commands.map(cmd => ({
    command: cmd.command,
    description: cmd.description,
    aliases: cmd.aliases,
  }));
}
