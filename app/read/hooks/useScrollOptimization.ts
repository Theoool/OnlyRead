import { useRef, useEffect, useCallback } from 'react';

interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

/**
 * 精确居中滚动 Hook
 * 确保目标元素始终在视口中心位置
 */
export function useCenteredScroll() {
  const isScrolling = useRef<boolean>(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const scrollToCenter = useCallback((
    element: HTMLElement,
    options: ScrollOptions = {}
  ) => {
    if (isScrolling.current) return;
    
    isScrolling.current = true;
    
    const defaultOptions: ScrollOptions = {
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // 获取元素和视口信息
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // 计算精确的居中位置偏移
    const verticalOffset = (viewportHeight - rect.height) / 2 - rect.top;
    const horizontalOffset = (viewportWidth - rect.width) / 2 - rect.left;
    
    // 移动端特殊处理
    const isMobile = viewportWidth < 768;
    if (isMobile) {
      // 移动端使用更保守的定位
      element.scrollIntoView({
        behavior: finalOptions.behavior,
        block: 'start',
        inline: finalOptions.inline
      });
    } else {
      // 桌面端精确定位到中心
      element.scrollIntoView({
        behavior: finalOptions.behavior,
        block: finalOptions.block,
        inline: finalOptions.inline
      });
      
      // 微调位置确保完美居中
      if (finalOptions.behavior === 'smooth') {
        // 平滑滚动时延迟微调
        setTimeout(() => {
          window.scrollBy(-horizontalOffset, -verticalOffset);
          isScrolling.current = false;
        }, 300);
      } else {
        // 立即滚动时直接微调
        window.scrollBy(-horizontalOffset, -verticalOffset);
        isScrolling.current = false;
      }
    }
    
    // 设置超时清理状态
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
    }, 500);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return {
    scrollToCenter,
    isScrolling: isScrolling.current
  };
}

/**
 * 虚拟滚动 Hook
 * 只渲染可见区域内的元素，提高性能
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  bufferSize: number = 5
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef<number>(0);

  // 计算可见范围
  const getVisibleRange = useCallback(() => {
    if (!containerRef.current) return { startIndex: 0, endIndex: 0 };
    
    const container = containerRef.current;
    const containerHeight = container.clientHeight;
    
    const startIndex = Math.max(0, 
      Math.floor(scrollTop.current / itemHeight) - bufferSize
    );
    
    const endIndex = Math.min(items.length - 1,
      Math.ceil((scrollTop.current + containerHeight) / itemHeight) + bufferSize
    );
    
    return { startIndex, endIndex };
  }, [items.length, itemHeight, bufferSize]);

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTop.current = e.currentTarget.scrollTop;
  }, []);

  const visibleRange = getVisibleRange();
  
  return {
    containerRef,
    handleScroll,
    visibleItems: items.slice(visibleRange.startIndex, visibleRange.endIndex + 1),
    startIndex: visibleRange.startIndex,
    totalHeight: items.length * itemHeight
  };
}

/**
 * Intersection Observer Hook
 * 监听元素进入视口的时机
 */
export function useIntersectionObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
) {
  const elementRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    }, {
      threshold: 0.5,
      ...options
    });

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [callback, options]);

  return elementRef;
}
