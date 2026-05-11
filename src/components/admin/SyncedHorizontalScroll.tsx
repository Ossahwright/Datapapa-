import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SyncedHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A reusable component that provides a synchronized bottom horizontal scrollbar
 * for wide content (like tables). The custom scrollbar is sticky to the viewport bottom
 * and stays in sync with the actual content's scroll position.
 */
export const SyncedHorizontalScroll: React.FC<SyncedHorizontalScrollProps> = ({ 
  children, 
  className = "" 
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const phantomRef = useRef<HTMLDivElement>(null);
  
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);

  // Sync scroll from content to custom scrollbar
  const handleContentScroll = useCallback(() => {
    if (contentRef.current && scrollbarRef.current && !scrollbarRef.current.dataset.scrolling) {
      contentRef.current.dataset.scrolling = 'true';
      scrollbarRef.current.scrollLeft = contentRef.current.scrollLeft;
      delete contentRef.current.dataset.scrolling;
    }
  }, []);

  // Sync scroll from custom scrollbar to content
  const handleScrollbarScroll = useCallback(() => {
    if (scrollbarRef.current && contentRef.current && !contentRef.current.dataset.scrolling) {
      scrollbarRef.current.dataset.scrolling = 'true';
      contentRef.current.scrollLeft = scrollbarRef.current.scrollLeft;
      delete scrollbarRef.current.dataset.scrolling;
    }
  }, []);

  // Update widths and visibility on resize
  useEffect(() => {
    const updateSize = () => {
      if (contentRef.current) {
        const { scrollWidth, clientWidth } = contentRef.current;
        const hasOverflow = scrollWidth > clientWidth;
        
        setShowScrollbar(hasOverflow);
        setContentWidth(scrollWidth);
        
        // Ensure scrollbar is synced after resize
        if (scrollbarRef.current) {
          scrollbarRef.current.scrollLeft = contentRef.current.scrollLeft;
        }
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
      // Also observe first child if it's a table to catch data updates
      if (contentRef.current.firstChild instanceof HTMLElement) {
        resizeObserver.observe(contentRef.current.firstChild);
      }
    }

    // Initial check
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Target Content Area */}
      <div 
        ref={contentRef}
        className="overflow-x-auto scrollbar-hide"
        onScroll={handleContentScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Synchronized Sticky Scrollbar */}
      {showScrollbar && (
        <div 
          className="sticky bottom-0 left-0 right-0 z-10 h-3 bg-white/80 backdrop-blur-sm border-t border-slate-100 flex items-center"
          style={{ width: '100%' }}
        >
          <div
            ref={scrollbarRef}
            className="w-full overflow-x-auto h-2 flex items-center custom-scrollbar"
            onScroll={handleScrollbarScroll}
          >
            {/* The phantom element that matches the scroll width of the content */}
            <div 
              ref={phantomRef}
              style={{ width: `${contentWidth}px`, height: '1px' }}
              className="shrink-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};
