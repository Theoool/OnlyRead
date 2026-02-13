import { NextResponse } from "next/server";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { extractFromHtml } from "@/lib/content-extraction/server";
import { extractWithAdapter } from "@/lib/site-adapters";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url: string | undefined = body?.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "无效的URL" }, { status: 400 });
    }

    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`请求失败: ${res.status}`);
      }
      html = await res.text();
    } catch (e) {
      return NextResponse.json(
        { error: "该网站不支持，请手动复制粘贴文本" },
        { status: 502 }
      );
    }

    const baseUrl = new URL(url);
    html = html.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, path) => {
      try {
        const absolute = new URL(path, baseUrl).href;
        return `${attr}="${absolute}"`;
      } catch {
        return match;
      }
    });

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const fallbackTitle = (titleMatch?.[1] || url).trim();
    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = "未知来源";
    }
    
    const id = `url-${Date.now()}`;
    try {
      // 使用新的提取系统
      const adapted = extractWithAdapter(html, url);

      const extracted = adapted.content && adapted.content.trim().length > 200
        ? await extractFromHtml(
            `<!doctype html><html><head><meta charset="utf-8"></head><body>${adapted.content}</body></html>`,
            url,
            { 
              removeRecommendations: true,
              aggressiveNoiseRemoval: true,
              cacheEnabled: true,
            }
          )
        : await extractFromHtml(html, url, { 
            removeRecommendations: true,
            aggressiveNoiseRemoval: true,
            cacheEnabled: true,
          });

      const title = (adapted.title || extracted.title || fallbackTitle).trim();

      return NextResponse.json({
        id,
        title,
        domain,
        url,
        content: extracted.content,
        type: extracted.type,
        metadata: extracted.metadata,
        adapterName: adapted.adapterName,
      });
    } catch (error) {
      console.error('提取失败，使用降级方案:', error);
      const turndownService = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        hr: "---",
        bulletListMarker: "-",
      });
      turndownService.use(gfm);

      const cleanHtml = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gim, "")
        .replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gim, "")
        .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gim, "")
        .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gim, "")
        .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "");

      const markdown = turndownService.turndown(cleanHtml);

      return NextResponse.json({
        id,
        title: fallbackTitle,
        domain,
        url,
        content: markdown,
        type: "markdown",
        adapterName: "fallback",
      });
    }
  } catch (err) {
    console.error('服务异常:', err);
    return NextResponse.json(
      { error: "服务异常" },
      { status: 500 }
    );
  }
}

