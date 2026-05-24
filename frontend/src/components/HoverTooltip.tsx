import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef } from 'react';
import './HoverTooltip.css';

type TooltipPlacement = 'right' | 'bottom';

interface HoverTooltipTriggerProps<T extends HTMLElement> {
  ref: (node: T | null) => void;
  interestfor: string;
  className: string;
}

interface HoverTooltipProps<T extends HTMLElement> {
  content: string;
  placement?: TooltipPlacement;
  children: (props: HoverTooltipTriggerProps<T>) => ReactNode;
}

function toAnchorToken(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export default function HoverTooltip<T extends HTMLElement>({
  content,
  placement = 'right',
  children,
}: HoverTooltipProps<T>) {
  const reactId = useId();
  const token = toAnchorToken(reactId);
  const tooltipId = `aip-tooltip-${token}`;
  const anchorName = `--aip-tooltip-anchor-${token}`;
  const triggerRef = useRef<T | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const setTriggerRef = useCallback((node: T | null) => {
    triggerRef.current = node;
  }, []);

  useEffect(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;

    if (!trigger || !popover) {
      return;
    }

    trigger.style.setProperty('anchor-name', anchorName);
    popover.style.setProperty('position-anchor', anchorName);

    return () => {
      trigger.style.removeProperty('anchor-name');
      popover.style.removeProperty('position-anchor');
    };
  }, [anchorName]);

  return (
    <>
      {/* eslint-disable-next-line react-hooks/refs */}
      {children({
        ref: setTriggerRef,
        interestfor: tooltipId,
        className: 'aip-hover-tooltip-trigger',
      })}
      <div
        ref={popoverRef}
        id={tooltipId}
        popover="hint"
        className="aip-hover-tooltip"
        data-tooltip-placement={placement}
      >
        <div className="aip-hover-tooltip__surface">{content}</div>
      </div>
    </>
  );
}
