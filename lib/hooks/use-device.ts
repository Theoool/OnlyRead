"use client";

import { useEffect, useState } from "react";

/**
 * 移动端断点: 768px (md)
 * - mobile: < 768px
 * - desktop: >= 768px
 */
const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // 初始检测
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkMobile();

    // 监听窗口变化
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    window.addEventListener("resize", checkMobile);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile ?? false;
}

/**
 * 获取当前视口宽度断点
 */
export function useBreakpoint(): "mobile" | "tablet" | "desktop" {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint("mobile");
      } else if (width < 1024) {
        setBreakpoint("tablet");
      } else {
        setBreakpoint("desktop");
      }
    };

    checkBreakpoint();
    window.addEventListener("resize", checkBreakpoint);
    return () => window.removeEventListener("resize", checkBreakpoint);
  }, []);

  return breakpoint;
}
