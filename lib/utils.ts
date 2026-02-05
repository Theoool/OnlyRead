import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时`;
  const d = Math.floor(h / 24);
  return `${d}天`;
}

export function isUrl(input: string) {
  return /^(https?:\/\/)/i.test(input.trim());
}

export function truncate(input: string, n = 20) {
  return input.length > n ? `${input.slice(0, n)}…` : input;
}
