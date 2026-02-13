'use client';

import { memo, useCallback } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useSession } from '@/lib/hooks/useSession';
import { useChat } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

interface CopilotWidgetProps {
  sessionId: string;
  variant?: 'full' | 'sidebar' | 'floating';
  onEngineAction?: (action: string, value?: any) => void;
}

const variantStyles = {
  full: 'bg-zinc-50 dark:bg-zinc-950',
  sidebar: 'bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800',
  floating: 'bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800',
};

/**
 * CopilotWidget - 重构后的简化版本
 * 职责：组合 Header、Messages、Input 三个子组件
 */
export const CopilotWidget = memo(function CopilotWidget({
  sessionId,
  variant = 'full',
  onEngineAction,
}: CopilotWidgetProps) {
  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { messages, sendMessage, isStreaming } = useChat({ sessionId });

  const handleEngineAction = useCallback(
    (action: string, value?: any) => {
      if (onEngineAction) {
        onEngineAction(action, value);
      }

      // 默认处理：将动作转换为消息
      const actionMessages: Record<string, string> = {
        quiz_correct: `我回答正确: ${value?.answer || ''}`,
        quiz_incorrect: `我回答错误: ${value?.answer || ''}`,
        code_run: `我提交了代码`,
        node_click: `我想了解 "${value?.label || '这个概念'}" 的详细信息`,
        review: '开始复习闪卡',
        more_cards: '生成更多闪卡',
        fill_blank_done: '我完成了填空练习',
      };

      const message = actionMessages[action];
      if (message) {
        sendMessage(message);
      }
    },
    [onEngineAction, sendMessage]
  );

  const handleSuggestedAction = useCallback(
    (action: any) => {
      sendMessage(action.label);
    },
    [sendMessage]
  );

  return (
    <div className={cn('flex flex-col h-full', variantStyles[variant])}>
      <ChatHeader session={session} />
      
      <ChatMessages
        messages={messages}
        isStreaming={isStreaming}
        onEngineAction={handleEngineAction}
        onSuggestedAction={handleSuggestedAction}
      />
      
      <ChatInput
        onSend={sendMessage}
        disabled={sessionLoading || isStreaming}
      />
    </div>
  );
});

