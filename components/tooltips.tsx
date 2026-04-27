'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

/**
 * InfoTooltip — hover/tap-triggered popover with explanation text.
 * 
 * Usage:
 *   <InfoTooltip text="What this section explains" />
 *   <InfoTooltip text="..." position="left" />
 * 
 * On desktop: hover.
 * On mobile: tap to toggle.
 */
type Props = {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md';
};

export function InfoTooltip({ text, position = 'top', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-neutral-700 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-700 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-neutral-700 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-neutral-700 border-y-transparent border-l-transparent',
  };

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex text-neutral-500 hover:text-neutral-300 transition cursor-help focus:outline-none focus:text-neutral-300"
        aria-label="More info"
      >
        <Info className={iconSize} />
      </button>
      {open && (
        <span
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <span className="block rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-xs text-neutral-200 shadow-xl whitespace-normal w-[28rem] max-w-[90vw] leading-relaxed">
            {text}
          </span>
          <span className={`absolute h-0 w-0 border-4 ${arrowClasses[position]}`} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

/**
 * SectionHeading — h2-style heading with built-in info icon.
 * 
 * Usage:
 *   <SectionHeading title="Rating Breakdown" help="How your overall score is computed..." />
 */
export function SectionHeading({
  title,
  help,
  level = 2,
  className = '',
  icon,
}: {
  title: string;
  help?: string;
  level?: 1 | 2 | 3;
  className?: string;
  icon?: React.ReactNode;
}) {
  const Tag = (level === 1 ? 'h1' : level === 3 ? 'h3' : 'h2') as keyof React.JSX.IntrinsicElements;
  const sizeClass = level === 1 ? 'text-2xl' : level === 3 ? 'text-base' : 'text-lg';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon}
      <Tag className={`${sizeClass} font-medium text-neutral-100`}>{title}</Tag>
      {help && <InfoTooltip text={help} position="bottom" />}
    </div>
  );
}

/**
 * Column header label with optional info icon (for table headers).
 * 
 * Usage in a <th>:
 *   <th><LabelWithHelp label="NPV" help="Net Present Value..." /></th>
 */
export function LabelWithHelp({
  label,
  help,
  className = '',
}: {
  label: string;
  help?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {label}
      {help && <InfoTooltip text={help} position="bottom" />}
    </span>
  );
}
