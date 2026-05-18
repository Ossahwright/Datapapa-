import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SyncedHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A reusable component that provides a synchronized bottom horizontal scrollbar
 * with navigation arrows for wide content (like tables). 
 * The navigation bar is sticky to the viewport bottom.
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update button states based on current scroll position
  const updateScrollStates = useCallback(() => {
    if (contentRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = contentRef.current;
      setCanScrollLeft(scrollLeft > 1);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  // Sync scroll from content to custom scrollbar
  const handleContentScroll = useCallback(() => {
    if (contentRef.current && scrollbarRef.current && !scrollbarRef.current.dataset.scrolling) {
      contentRef.current.dataset.scrolling = 'true';
      scrollbarRef.current.scrollLeft = contentRef.current.scrollLeft;
      delete contentRef.current.dataset.scrolling;
      updateScrollStates();
    }
  }, [updateScrollStates]);

  // Sync scroll from custom scrollbar to content
  const handleScrollbarScroll = useCallback(() => {
    if (scrollbarRef.current && contentRef.current && !contentRef.current.dataset.scrolling) {
      scrollbarRef.current.dataset.scrolling = 'true';
      contentRef.current.scrollLeft = scrollbarRef.current.scrollLeft;
      delete scrollbarRef.current.dataset.scrolling;
      updateScrollStates();
    }
  }, [updateScrollStates]);

  // Smooth scroll by distance
  const scrollBy = (distance: number) => {
    if (contentRef.current) {
      contentRef.current.scrollBy({
        left: distance,
        behavior: 'smooth'
      });
    }
  };

  // Update widths and visibility on resize
  useEffect(() => {
    const updateSize = () => {
      if (contentRef.current) {
        const { scrollWidth, clientWidth } = contentRef.current;
        const hasOverflow = scrollWidth > clientWidth;
        
        setShowScrollbar(hasOverflow);
        setContentWidth(scrollWidth);
        updateScrollStates();
        
        if (scrollbarRef.current) {
          scrollbarRef.current.scrollLeft = contentRef.current.scrollLeft;
        }
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
      if (contentRef.current.firstChild instanceof HTMLElement) {
        resizeObserver.observe(contentRef.current.firstChild);
      }
    }

    updateSize();
    return () => resizeObserver.disconnect();
  }, [updateScrollStates]);

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Scroll Indicators (Shadows) */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-[5] transition-opacity duration-300 bg-gradient-to-r from-slate-900/5 to-transparent ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} 
      />
      <div 
        className={`absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-[5] transition-opacity duration-300 bg-gradient-to-l from-slate-900/5 to-transparent ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Target Content Area */}
      <div 
        ref={contentRef}
        className="overflow-x-auto scrollbar-hide"
        onScroll={handleContentScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Synchronized Sticky Navigation Bar */}
      {showScrollbar && (
        <div 
          className="sticky bottom-0 left-0 right-0 z-10 p-1 bg-white/90 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)] flex items-center gap-2"
        >
          {/* Scroll Left Button */}
          <button
            onClick={() => scrollBy(-Math.max(200, window.innerWidth * 0.3))}
            disabled={!canScrollLeft}
            className={`p-1.5 rounded-lg transition-all ${
              canScrollLeft 
                ? 'text-slate-600 hover:bg-slate-100 active:scale-95' 
                : 'text-slate-300 opacity-40 cursor-not-allowed'
            }`}
            title="Scroll Left"
          >
            <ChevronLeft size={16} />
          </button>

          {/* The Scrollbar track */}
          <div
            ref={scrollbarRef}
            className="flex-1 overflow-x-auto h-3 flex items-center custom-scrollbar"
            onScroll={handleScrollbarScroll}
          >
            <div 
              ref={phantomRef}
              style={{ width: `${contentWidth}px`, height: '1px' }}
              className="shrink-0"
            />
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scrollBy(Math.max(200, window.innerWidth * 0.3))}
            disabled={!canScrollRight}
            className={`p-1.5 rounded-lg transition-all ${
              canScrollRight 
                ? 'text-slate-600 hover:bg-slate-100 active:scale-95' 
                : 'text-slate-300 opacity-40 cursor-not-allowed'
            }`}
            title="Scroll Right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
