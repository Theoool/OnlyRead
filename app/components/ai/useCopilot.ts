import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

export interface SuggestedAction {
  label: string;
  action: string;
  type?: 'primary' | 'secondary' | 'danger';
}

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  ui?: any;
  sources?: any[];
  suggestedActions?: SuggestedAction[];
  createdAt: string;
}

export interface CopilotDebugState {
  traceId?: string
  mode?: string
  sessionId?: string | null
  lastEvent?: string
  steps: Array<{ name: string; at: number }>
  retrievalPolicy?: any
  lastSources?: { count?: number; minSimilarity?: number; minSources?: number }
  errors: Array<{ message: string; detail?: string; at: number }>
}

export interface ChatHookOptions {
  sessionId?: string;
  mode: 'qa' | 'tutor' | 'copilot';
  context?: {
    articleIds?: string[];
    collectionId?: string;
    selection?: string;
    currentContent?: string;
  };
}

export function useCopilot({ sessionId, mode, context }: ChatHookOptions) {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<Message | null>(null);
  const [debug, setDebug] = useState<CopilotDebugState>({
    steps: [],
    errors: [],
  })
  const pendingTextRef = useRef('');
  const renderedTextRef = useRef('');
  const typewriterRafRef = useRef<number | null>(null);
  const lastUiUpdateAtRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  const isUuid = useCallback((value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  }, []);

  // Fetch Session History (Only if sessionId is provided)
  const { data: session, isLoading } = useQuery({
    queryKey: ['ai', 'session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await fetch(`/api/learning/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch session');
      return res.json();
    },
    enabled: !!sessionId,
  });

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Sliding window configuration
  const MAX_HISTORY_ROUNDS = 10; // Keep last 10 rounds (20 messages)

  const toWireMessages = (
    history?: Array<{ role: string; content?: string; ui?: any }>,
    sessionSummary?: string
  ) => {
    if (!history || history.length === 0) return undefined;

    // Apply sliding window if history exceeds threshold
    let processedHistory = history;
    if (history.length > MAX_HISTORY_ROUNDS * 2) {
      processedHistory = history.slice(-MAX_HISTORY_ROUNDS * 2);
    }

    const messages = processedHistory
      .map((m: any) => {
        const role = m?.role === 'ASSISTANT' ? 'assistant' : 'user';
        const content =
          typeof m?.content === 'string'
            ? m.content
            : m?.ui?.type === 'explanation'
              ? String(m?.ui?.content ?? '')
              : String(m?.content ?? '');
        return { role, content };
      })
      .filter((m: any) => typeof m.content === 'string' && m.content.trim().length > 0);

    // Prepend summary as system context if available and history was truncated
    if (sessionSummary && history.length > MAX_HISTORY_ROUNDS * 2) {
      return [
        { role: 'system', content: `Previous conversation summary: ${sessionSummary}` },
        ...messages
      ];
    }

    return messages;
  };

  // Stream Message
  const sendMessage = useCallback(async ({ message, history, uiIntent }: { message: string; history?: any[]; uiIntent?: string }) => {
    const stopTypewriter = () => {
      if (typewriterRafRef.current != null) {
        window.cancelAnimationFrame(typewriterRafRef.current)
        typewriterRafRef.current = null
      }
    }

    try {
        setIsStreaming(true);
        pendingTextRef.current = '';
        renderedTextRef.current = '';
        lastUiUpdateAtRef.current = 0;
        setDebug((prev) => ({
          ...prev,
          lastEvent: 'start',
          steps: [],
          errors: [],
          retrievalPolicy: undefined,
          lastSources: undefined,
        }))
        setCurrentResponse({
            id: 'streaming-' + Date.now(),
            role: 'ASSISTANT',
            content: '',
            ui: { type: 'explanation', content: '' },
            createdAt: new Date().toISOString()
        });

        const sessionContext = sessionRef.current?.context || {}
        const mergedContext = { ...sessionContext, ...(context || {}) }
        const sessionSummary = sessionRef.current?.summary
        const wireMessages = toWireMessages(
          history || sessionRef.current?.messages || [],
          sessionSummary
        )
        const safeArticleIds = Array.isArray(mergedContext.articleIds)
          ? Array.from(
              new Set(
                mergedContext.articleIds
                  .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
                  .filter((v: string) => v.length > 0 && isUuid(v)),
              ),
            )
          : undefined;
        const safeCollectionId = isUuid(mergedContext.collectionId) ? mergedContext.collectionId : undefined;
        const finalArticleIds = safeArticleIds && safeArticleIds.length > 0 ? safeArticleIds : undefined;
        const finalCollectionId = finalArticleIds ? undefined : safeCollectionId;
        const payload: any = {
            sessionId,
            message,
            messages: wireMessages ? [...wireMessages, { role: 'user', content: message }] : undefined,
            mode,
            uiIntent,
            currentTopic: mergedContext.currentTopic,
            masteryLevel: mergedContext.masteryLevel,
            context: {
              articleIds: finalArticleIds,
              collectionId: finalCollectionId,
              selection: mergedContext.selection,
              currentContent: mergedContext.currentContent,
            },
        };

        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Failed to send message');
        if (!res.body) throw new Error('No response body');
        let sources: any[] = []
        let finalResponse: any = null

        const drainTypewriter = (now: number) => {
          typewriterRafRef.current = null

          const pending = pendingTextRef.current
          if (!pending) return

          const take = Math.min(pending.length, 24)
          renderedTextRef.current += pending.slice(0, take)
          pendingTextRef.current = pending.slice(take)

          const nextText = renderedTextRef.current
          const shouldUpdateUi =
            now - lastUiUpdateAtRef.current >= 50 || pendingTextRef.current.length === 0

          if (shouldUpdateUi) {
            lastUiUpdateAtRef.current = now
            setCurrentResponse((prev) => {
              if (!prev) return null
              if (prev.content === nextText) return prev
              return {
                ...prev,
                content: nextText,
                ui: prev.ui?.type === 'explanation' ? { type: 'explanation', content: nextText } : prev.ui,
              }
            })
          }

          if (pendingTextRef.current.length > 0) {
            scheduleTypewriter()
          }
        }

        const scheduleTypewriter = () => {
          if (typewriterRafRef.current != null) return
          typewriterRafRef.current = window.requestAnimationFrame(drainTypewriter)
        }

        const handleSseEvent = (event: string, data: any) => {
          setDebug((prev) => ({
            ...prev,
            lastEvent: event,
            traceId: typeof data?.traceId === 'string' ? data.traceId : prev.traceId,
          }))

          if (event === 'meta') {
            setDebug((prev) => ({
              ...prev,
              traceId: typeof data?.traceId === 'string' ? data.traceId : prev.traceId,
              mode: typeof data?.mode === 'string' ? data.mode : prev.mode,
              sessionId: typeof data?.sessionId === 'string' ? data.sessionId : data?.sessionId ?? prev.sessionId,
              retrievalPolicy: data?.retrievalPolicy ?? prev.retrievalPolicy,
            }))
            return
          }

          if (event === 'step') {
            const name = typeof data?.name === 'string' ? data.name : 'unknown'
            setDebug((prev) => ({
              ...prev,
              steps: [...prev.steps, { name, at: Date.now() }],
            }))
            return
          }

          if (event === 'sources') {
            const nextSources = Array.isArray(data?.sources) ? data.sources : []
            sources = nextSources
            setCurrentResponse((prev) => (prev ? { ...prev, sources: nextSources } : null))
            setDebug((prev) => ({
              ...prev,
              lastSources: {
                count: typeof data?.count === 'number' ? data.count : nextSources.length,
                minSimilarity: typeof data?.minSimilarity === 'number' ? data.minSimilarity : undefined,
                minSources: typeof data?.minSources === 'number' ? data.minSources : undefined,
              },
            }))
            return
          }

          if (event === 'delta') {
            const text = typeof data?.text === 'string' ? data.text : ''
            if (!text) return
            pendingTextRef.current += text
            scheduleTypewriter()
            return
          }

          if (event === 'final') {
            finalResponse = data
            const ui = data?.ui
            const nextSources = Array.isArray(data?.sources) ? data.sources : sources
            const nextSuggestedActions = Array.isArray(data?.suggestedActions) ? data.suggestedActions : undefined
            sources = nextSources

            stopTypewriter()
            pendingTextRef.current = ''

            if (ui?.type === 'explanation') {
              const text = String(ui?.content ?? '')
              renderedTextRef.current = text
              setCurrentResponse((prev) =>
                prev
                  ? {
                      ...prev,
                      content: text,
                      ui: ui,
                      sources: nextSources,
                      suggestedActions: nextSuggestedActions,
                    }
                  : null,
              )
            } else {
              setCurrentResponse((prev) =>
                prev
                  ? {
                      ...prev,
                      content: '',
                      ui: ui,
                      sources: nextSources,
                      suggestedActions: nextSuggestedActions,
                    }
                  : null,
              )
            }
            return
          }

          if (event === 'error') {
            const message = typeof data?.message === 'string' ? data.message : 'Error'
            const detail = typeof data?.detail === 'string' ? data.detail : undefined
            setDebug((prev) => ({
              ...prev,
              errors: [...prev.errors, { message, detail, at: Date.now() }],
            }))
            const text = detail ? `${message}\n${detail}` : message
            stopTypewriter()
            pendingTextRef.current = ''
            renderedTextRef.current = renderedTextRef.current.trim().length > 0 ? renderedTextRef.current : text
            setCurrentResponse((prev) => {
              if (!prev) return prev
              if (prev.content && prev.content.trim().length > 0) return prev
              return {
                ...prev,
                content: text,
                ui: { type: 'explanation', content: text },
              }
            })
            return
          }
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const feed = (text: string) => {
          buffer += text
          while (true) {
            const splitIndex = buffer.indexOf('\n\n')
            if (splitIndex === -1) break
            const frame = buffer.slice(0, splitIndex)
            buffer = buffer.slice(splitIndex + 2)
            const lines = frame.split(/\r?\n/)
            let event = 'message'
            const dataLines: string[] = []
            for (const line of lines) {
              if (line.startsWith('event:')) {
                event = line.slice('event:'.length).trim()
              } else if (line.startsWith('data:')) {
                const v = line.slice('data:'.length)
                dataLines.push(v.startsWith(' ') ? v.slice(1) : v)
              }
            }
            if (dataLines.length === 0) continue
            const raw = dataLines.join('\n')
            try {
              const parsed = JSON.parse(raw)
              handleSseEvent(event, parsed)
            } catch {
              handleSseEvent(event, raw)
            }
          }
        }

        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            if (value) {
              feed(decoder.decode(value, { stream: true }))
            }
          }
        } finally {
          stopTypewriter()
          try {
            reader.releaseLock()
          } catch {}
        }

        setIsStreaming(false)
        setCurrentResponse(null)

        if (finalResponse) {
          const ui = finalResponse.ui
          const content =
            ui?.type === 'explanation' ? String(ui.content ?? '') : renderedTextRef.current || ''
          const suggestedActions = Array.isArray(finalResponse.suggestedActions) ? finalResponse.suggestedActions : undefined
          return { content, sources, ui, suggestedActions }
        }

        const content = renderedTextRef.current
        return { content, sources, ui: { type: 'explanation', content }, suggestedActions: undefined }

    } catch (error) {
        console.error(error);
        toast.error("Failed to generate response");
        stopTypewriter()
        setIsStreaming(false);
        setCurrentResponse(null);
        throw error;
    } finally {
        if (sessionId) {
            // Invalidate query to fetch saved full message from DB
            // We delay slightly to ensure DB write finishes in background (handleLLMEnd)
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['ai', 'session', sessionId] });
            }, 1000);
        }
    }
  }, [sessionId, mode, context, queryClient]);

  useEffect(() => {
    return () => {
      if (typewriterRafRef.current != null) {
        window.cancelAnimationFrame(typewriterRafRef.current)
        typewriterRafRef.current = null
      }
    }
  }, [])

  // Use useMemo to stabilize the messages array reference
  const messages = useMemo(() => {
    return session?.messages || [];
  }, [session?.messages]);

  return {
    messages,
    isLoading: isLoading,
    sendMessage,
    isSending: isStreaming,
    currentResponse, // Expose streaming response
    debug,
  };
}
