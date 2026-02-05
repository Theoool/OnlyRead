export function encodeSseEvent(event: string, data: unknown) {
  const json = JSON.stringify(data ?? null)
  const normalized = json.replace(/\r?\n/g, '\n')
  const dataLines = normalized.split('\n').map((line) => `data: ${line}`).join('\n')
  return `event: ${event}\n${dataLines}\n\n`
}

