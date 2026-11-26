import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface HelpTooltipProps {
  text: string;
  className?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipW = 224;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(12, Math.min(window.innerWidth - tooltipW - 12, left));
    const top = rect.top > 96 ? rect.top - 10 : rect.bottom + 10;
    setPos({ top, left });
    setOpen(true);
  };

  const showAbove = btnRef.current ? btnRef.current.getBoundingClientRect().top > 96 : true;

  return (
    <>
      <span
        ref={btnRef}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setOpen(false)}
        onFocus={handleEnter}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        role="button"
        aria-label={text}
        className={`inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[9px] font-semibold leading-none text-zinc-400 transition-colors hover:border-white/30 hover:bg-white/15 hover:text-white ${className}`}
      >
        ?
      </span>
      {open &&
        createPortal(
          <div
            style={{
              top: pos.top,
              left: pos.left,
              transform: showAbove ? 'translateY(-100%)' : 'none',
            }}
            className="pointer-events-none fixed z-[9999] w-56 rounded-xl border border-white/15 bg-[#242426]/95 px-3 py-2 text-[11px] leading-relaxed text-zinc-200 shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
};
