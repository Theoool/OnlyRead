import { AsyncLocalStorage } from 'node:async_hooks'

export type AiStreamEvent =
  | { type: 'meta'; data: any }
  | { type: 'step'; data: any }
  | { type: 'delta'; data: { text: string } }
  | { type: 'sources'; data: any }
  | { type: 'final'; data: any }
  | { type: 'error'; data: any }
  | { type: 'done'; data: any }

export interface AiStreamEmitter {
  emit(event: AiStreamEvent): void
}

type AiStreamContext = {
  emitter: AiStreamEmitter
  traceId: string
}

const storage = new AsyncLocalStorage<AiStreamContext>()

export function runWithAiStreamContext<T>(
  context: AiStreamContext,
  fn: () => Promise<T>,
) {
  return storage.run(context, fn)
}

export function getAiStreamContext() {
  return storage.getStore()
}

export function emitAiEvent(event: AiStreamEvent) {
  const ctx = storage.getStore()
  if (!ctx) return
  ctx.emitter.emit(event)
}

export function getAiTraceId() {
  return storage.getStore()?.traceId
}

