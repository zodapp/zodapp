import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionIcon, Affix, Transition } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { AutoTableHandle } from './AutoTable';

const DEFAULT_EDGE_THRESHOLD_PX = 8;
const DEFAULT_SMOOTH_SCROLL_DISTANCE_TOP_PX = 120;
const DEFAULT_SMOOTH_SCROLL_DISTANCE_BOTTOM_PX = 120;
const DEFAULT_SHOW_SCROLL_TO_TOP_AFTER_PX = 160;
const DEFAULT_SCROLL_FAB_SIZE_PX = 44;
const DEFAULT_AFFIX_BOTTOM_PX = 24;
const DEFAULT_AFFIX_RIGHT_PX = 24;
const DEFAULT_TRANSITION_DURATION_MS = 150;

export type UseAutoTableScrollOptions = {
  itemCount: number;
  isLoading: boolean;
  fetchMore: () => void;
  smoothScrollDistanceTopPx?: number;
  smoothScrollDistanceBottomPx?: number;
  edgeThresholdPx?: number;
  showScrollToTopAfterPx?: number;
  scrollFabSizePx?: number;
  affixBottomPx?: number;
  affixRightPx?: number;
  transitionDurationMs?: number;
};

type ScrollState = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  isAtTop: boolean;
  isAtBottom: boolean;
};

type ScrollToBottomOptions = {
  behavior?: ScrollBehavior;
  keepFabVisible?: boolean;
};

export type UseAutoTableScrollResult = {
  scrollParent: HTMLDivElement | null;
  scrollParentRef: React.RefCallback<HTMLDivElement>;
  tableRef: React.RefObject<AutoTableHandle | null>;
  bottomAnchorRef: React.RefObject<HTMLDivElement | null>;
  handleFetchMore: () => void;
  scrollFab: ReactNode;
};

const buildScrollState = (element: HTMLElement, edgeThresholdPx: number): ScrollState => {
  const { scrollTop, clientHeight, scrollHeight } = element;
  return {
    scrollTop,
    clientHeight,
    scrollHeight,
    isAtTop: scrollTop <= edgeThresholdPx,
    isAtBottom: scrollTop + clientHeight >= scrollHeight - edgeThresholdPx
  };
};

type AutoTableScrollFabProps = {
  showScrollToTop: boolean;
  showScrollToBottom: boolean;
  onScrollToTop: () => void;
  onScrollToBottom: () => void;
  sizePx: number;
  affixBottomPx: number;
  affixRightPx: number;
  transitionDurationMs: number;
};

function AutoTableScrollFab({
  showScrollToTop,
  showScrollToBottom,
  onScrollToTop,
  onScrollToBottom,
  sizePx,
  affixBottomPx,
  affixRightPx,
  transitionDurationMs
}: AutoTableScrollFabProps) {
  return (
    <Affix position={{ bottom: affixBottomPx, right: affixRightPx }}>
      <Transition
        mounted={showScrollToTop || showScrollToBottom}
        transition="fade"
        duration={transitionDurationMs}
      >
        {(transitionStyles) => (
          <div
            style={{ ...transitionStyles, display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ minHeight: `${sizePx}px` }}>
              {showScrollToTop ? (
                <ActionIcon
                  size="xl"
                  radius="xl"
                  variant="filled"
                  color="var(--mantine-color-primary-filled)"
                  aria-label="一覧の先頭へ移動"
                  onClick={onScrollToTop}
                >
                  <IconChevronUp size={20} />
                </ActionIcon>
              ) : null}
            </div>
            <div style={{ minHeight: `${sizePx}px` }}>
              {showScrollToBottom ? (
                <ActionIcon
                  size="xl"
                  radius="xl"
                  variant="filled"
                  aria-label="一覧の末尾へ移動"
                  color="var(--mantine-color-primary-filled)"
                  onClick={onScrollToBottom}
                >
                  <IconChevronDown size={20} />
                </ActionIcon>
              ) : null}
            </div>
          </div>
        )}
      </Transition>
    </Affix>
  );
}

export function useAutoTableScroll(options: UseAutoTableScrollOptions): UseAutoTableScrollResult {
  const {
    itemCount,
    isLoading,
    fetchMore,
    smoothScrollDistanceTopPx = DEFAULT_SMOOTH_SCROLL_DISTANCE_TOP_PX,
    smoothScrollDistanceBottomPx = DEFAULT_SMOOTH_SCROLL_DISTANCE_BOTTOM_PX,
    edgeThresholdPx = DEFAULT_EDGE_THRESHOLD_PX,
    showScrollToTopAfterPx = DEFAULT_SHOW_SCROLL_TO_TOP_AFTER_PX,
    scrollFabSizePx = DEFAULT_SCROLL_FAB_SIZE_PX,
    affixBottomPx = DEFAULT_AFFIX_BOTTOM_PX,
    affixRightPx = DEFAULT_AFFIX_RIGHT_PX,
    transitionDurationMs = DEFAULT_TRANSITION_DURATION_MS
  } = options;

  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const tableRef = useRef<AutoTableHandle | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const previousItemCountRef = useRef(itemCount);
  const hasStartedAutoScrollRef = useRef(false);
  const [autoScrollDirection, setAutoScrollDirection] = useState<'top' | 'bottom' | null>(null);
  const [isFetchMoreScrollPending, setIsFetchMoreScrollPending] = useState(false);

  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollTop: 0,
    clientHeight: 0,
    scrollHeight: 0,
    isAtTop: true,
    isAtBottom: false
  });

  const handleFetchMore = useCallback(() => {
    previousItemCountRef.current = itemCount;
    setIsFetchMoreScrollPending(true);
    fetchMore();
  }, [itemCount, fetchMore]);

  useEffect(() => {
    if (!scrollParent) return;

    const updateScrollState = () => {
      setScrollState(buildScrollState(scrollParent, edgeThresholdPx));
    };

    updateScrollState();
    scrollParent.addEventListener('scroll', updateScrollState, { passive: true });
    return () => scrollParent.removeEventListener('scroll', updateScrollState);
  }, [scrollParent, itemCount, edgeThresholdPx]);

  const scrollToTop = useCallback(async () => {
    setAutoScrollDirection('top');
    hasStartedAutoScrollRef.current = false;
    await tableRef.current?.ensureFirstItemVisible({ offsetPx: smoothScrollDistanceTopPx });
    hasStartedAutoScrollRef.current = true;
    scrollParent?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollParent, smoothScrollDistanceTopPx]);

  const scrollToBottom = useCallback(
    async ({ behavior = 'smooth', keepFabVisible = true }: ScrollToBottomOptions = {}) => {
      if (keepFabVisible) {
        setAutoScrollDirection('bottom');
      }

      hasStartedAutoScrollRef.current = false;
      await tableRef.current?.ensureLastItemVisible({ offsetPx: smoothScrollDistanceBottomPx });
      if (keepFabVisible) {
        hasStartedAutoScrollRef.current = true;
      }
      scrollParent?.scrollTo({
        top: scrollParent.scrollHeight,
        behavior
      });
      if (scrollParent && behavior === 'auto') {
        setScrollState(buildScrollState(scrollParent, edgeThresholdPx));
      }
    },
    [edgeThresholdPx, scrollParent, smoothScrollDistanceBottomPx]
  );

  useEffect(() => {
    if (!isFetchMoreScrollPending || isLoading) return;
    if (itemCount <= previousItemCountRef.current) {
      setIsFetchMoreScrollPending(false);
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      void (async () => {
        await scrollToBottom({ behavior: 'auto', keepFabVisible: false });
        setIsFetchMoreScrollPending(false);
      })();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isFetchMoreScrollPending, itemCount, isLoading, scrollToBottom]);

  useEffect(() => {
    if (!autoScrollDirection || !hasStartedAutoScrollRef.current) return;
    if (autoScrollDirection === 'top' && !scrollState.isAtTop) return;
    if (autoScrollDirection === 'bottom' && !scrollState.isAtBottom) return;
    hasStartedAutoScrollRef.current = false;
    setAutoScrollDirection(null);
  }, [autoScrollDirection, scrollState.isAtTop, scrollState.isAtBottom]);

  const showScrollToTopFab =
    autoScrollDirection === 'top' ||
    (scrollState.scrollTop > showScrollToTopAfterPx && !scrollState.isAtTop);

  const showScrollToBottomFab =
    !isFetchMoreScrollPending &&
    (autoScrollDirection === 'bottom' || (!isLoading && !scrollState.isAtBottom));

  const scrollFab = (
    <AutoTableScrollFab
      showScrollToTop={showScrollToTopFab}
      showScrollToBottom={showScrollToBottomFab}
      onScrollToTop={() => {
        void scrollToTop();
      }}
      onScrollToBottom={() => {
        void scrollToBottom();
      }}
      sizePx={scrollFabSizePx}
      affixBottomPx={affixBottomPx}
      affixRightPx={affixRightPx}
      transitionDurationMs={transitionDurationMs}
    />
  );

  return {
    scrollParent,
    scrollParentRef: setScrollParent,
    tableRef,
    bottomAnchorRef,
    handleFetchMore,
    scrollFab
  };
}
