/**
 * 网站适配器 - 用于特定网站的内容提取
 */

interface AdapterResult {
  content: string;
  title?: string;
  adapterName: string;
}

/**
 * 使用适配器提取内容
 */
export function extractWithAdapter(html: string, url: string): AdapterResult {
  // 默认返回原始 HTML，让后续的提取器处理
  return {
    content: html,
    title: undefined,
    adapterName: 'default',
  };
}

