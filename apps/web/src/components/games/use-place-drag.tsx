"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type PlaceGhost = {
  id: string;
  label: string;
  x: number;
  y: number;
};

const DRAG_THRESHOLD = 10;

export function closestFromPoint(x: number, y: number, selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof Element)) continue;
    const hit = node.closest(selector);
    if (hit instanceof HTMLElement) return hit;
  }
  return null;
}

export function usePlaceDrag({
  disabled,
  dropSelector,
  onDrop,
  allowDrag = true,
}: {
  disabled: boolean;
  dropSelector: string;
  onDrop: (itemId: string, target: HTMLElement) => void;
  allowDrag?: boolean;
}) {
  const selectedRef = useRef<string | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const skipClickRef = useRef(false);
  const labelRef = useRef("");
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [ghost, setGhost] = useState<PlaceGhost | null>(null);
  const [overEl, setOverEl] = useState<HTMLElement | null>(null);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setSelected(id);
  }, []);

  function endDrag() {
    draggingIdRef.current = null;
    pointerIdRef.current = null;
    movedRef.current = false;
    setDragging(null);
    setGhost(null);
    setOverEl(null);
  }

  function onPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    itemId: string,
    label: string,
  ) {
    if (disabled || event.button > 0 || !allowDrag) return;
    draggingIdRef.current = itemId;
    pointerIdRef.current = event.pointerId;
    originRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    labelRef.current = label;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (draggingIdRef.current === null || event.pointerId !== pointerIdRef.current) {
      return;
    }
    const dx = event.clientX - originRef.current.x;
    const dy = event.clientY - originRef.current.y;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;
    setDragging(draggingIdRef.current);
    setGhost({
      id: draggingIdRef.current,
      label: labelRef.current,
      x: event.clientX,
      y: event.clientY,
    });
    setOverEl(closestFromPoint(event.clientX, event.clientY, dropSelector));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== pointerIdRef.current) return;
    const id = draggingIdRef.current;
    const moved = movedRef.current;
    const target = moved
      ? closestFromPoint(event.clientX, event.clientY, dropSelector)
      : null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    endDrag();
    if (id && target) {
      skipClickRef.current = true;
      onDropRef.current(id, target);
    }
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerId !== pointerIdRef.current) return;
    endDrag();
  }

  function consumeClick() {
    if (!skipClickRef.current) return false;
    skipClickRef.current = false;
    return true;
  }

  return {
    selected,
    selectedRef,
    select,
    dragging,
    ghost,
    overEl,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeClick,
  };
}

export function PlaceGhost({ ghost }: { ghost: PlaceGhost | null }) {
  if (!ghost) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[14rem] rounded-2xl bg-violet-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg ring-2 ring-violet-800"
      style={{
        left: ghost.x,
        top: ghost.y,
        transform: "translate(-50%, -60%) rotate(-2deg)",
      }}
    >
      {ghost.label}
    </div>
  );
}
