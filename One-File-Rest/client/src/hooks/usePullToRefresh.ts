import { useRef, useCallback, useState, useEffect } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * Hook to add pull-to-refresh gesture on mobile devices.
 * Returns a pullProgress (0-1) and a refreshing state.
 */
export function usePullToRefresh({ onRefresh, threshold = 80, containerRef }: PullToRefreshOptions) {
  const [pullProgress, setPullProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const moved = useRef(false);

  const handleTouchStart = useCallback((e: Event) => {
    const te = e as TouchEvent;
    const scrollTop = containerRef?.current?.scrollTop || window.scrollY;
    if (scrollTop > 0) return;
    startY.current = te.touches[0].clientY;
    pulling.current = true;
    moved.current = false;
  }, [containerRef]);

  const handleTouchMove = useCallback((e: Event) => {
    const te = e as TouchEvent;
    if (!pulling.current || refreshing) return;
    const dy = te.touches[0].clientY - startY.current;
    if (dy > 0) {
      moved.current = true;
      const progress = Math.min(1, dy / threshold);
      setPullProgress(progress);
      e.preventDefault();
    }
  }, [refreshing, threshold]);

  const handleTouchEnd = useCallback(async (e: Event) => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullProgress >= 1 && moved.current) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullProgress(0);
      }
    } else {
      setPullProgress(0);
    }
  }, [pullProgress, onRefresh]);

  useEffect(() => {
    const el = containerRef?.current || window;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, containerRef]);

  return { pullProgress, refreshing };
}
