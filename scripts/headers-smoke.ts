import { NextResponse } from 'next/server'

async function main() {
  const sources = [
    { title: '第三部分 研究方法篇', articleId: 'x', url: null },
    { title: '前言', articleId: 'y', url: null },
  ]

  const sourcesJson = JSON.stringify(sources)
  const sourcesHeader = Buffer.from(sourcesJson, 'utf8').toString('base64')

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('ok'))
      controller.close()
    },
  })

  const res = new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Copilot-Sources': sourcesHeader,
      'X-Copilot-Sources-Encoding': 'base64',
    },
  })

  console.log('created response ok, status:', res.status)
  console.log('header length:', sourcesHeader.length)
  console.log('body:', await res.text())
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

