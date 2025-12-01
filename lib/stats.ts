export const STATS_KEY = "readingStats";

export interface ReadingSession {
  articleId: string;
  startTime: number;
  endTime: number;
  duration: number; // ms
}

export function getReadingStats(): ReadingSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ReadingSession[];
    return Array.isArray(arr) ? arr : [];
  } catch { 
    return [];
  }
}

export function saveReadingStats(stats: ReadingSession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

export function recordSession(session: ReadingSession) {
  const stats = getReadingStats();
  stats.push(session);
  saveReadingStats(stats);
}
