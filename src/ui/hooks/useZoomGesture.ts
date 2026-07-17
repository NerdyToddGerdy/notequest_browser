import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export interface ZoomEvent {
  /** Multiplicative zoom factor for this event (1.1 = 10% in, 0.9 = 10% out). Never 1. */
  factor: number;
  /** Viewport-space (clientX/clientY) focal point the zoom should center on. */
  clientX: number;
  clientY: number;
}

/** Wheel deltaY -> factor conversion rate -- small enough that a single mouse-wheel "click"
 * (~deltaY 100) or a smooth trackpad tick both feel like a gentle, controllable zoom step. */
const WHEEL_SENSITIVITY = 0.0018;

/**
 * Gesture *detection* only -- wheel zoom and two-finger pinch, normalized into a single
 * `onZoom(ZoomEvent)` callback. Deliberately doesn't touch rendering: DungeonMap (CSS
 * `transform: scale()` + scroll correction) and WorldScreen (SVG `viewBox` math) apply the
 * resulting factor completely differently, so only the input side is worth sharing.
 *
 * Single-finger touch is left alone -- listeners only ever call `preventDefault()` once a second
 * touch pointer actually joins (an active pinch), so native one-finger scroll/pan on the target
 * keeps working exactly as it does today.
 */
export function useZoomGesture(ref: RefObject<Element | null>, onZoom: (e: ZoomEvent) => void): void {
  const onZoomRef = useRef(onZoom);
  useLayoutEffect(() => {
    onZoomRef.current = onZoom;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      if (factor !== 1) onZoomRef.current({ factor, clientX: e.clientX, clientY: e.clientY });
    }

    // Two-finger pinch: track every active touch pointer by id, and once exactly two are down,
    // compare each move's inter-pointer distance to the last-seen one for a per-move factor.
    const activePointers = new Map<number, { x: number; y: number }>();
    let lastPinchDistance: number | null = null;

    function distanceAndMidpoint(points: { x: number; y: number }[]): { distance: number; x: number; y: number } {
      const [a, b] = points;
      return {
        distance: Math.hypot(b!.x - a!.x, b!.y - a!.y),
        x: (a!.x + b!.x) / 2,
        y: (a!.y + b!.y) / 2,
      };
    }

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastPinchDistance = activePointers.size === 2 ? distanceAndMidpoint([...activePointers.values()]).distance : null;
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.pointerType !== "touch" || !activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size !== 2) return;
      e.preventDefault(); // suppress native pinch-zoom/scroll now that a pinch is actively underway
      const { distance, x, y } = distanceAndMidpoint([...activePointers.values()]);
      if (lastPinchDistance != null && lastPinchDistance > 0) {
        const factor = distance / lastPinchDistance;
        if (factor !== 1) onZoomRef.current({ factor, clientX: x, clientY: y });
      }
      lastPinchDistance = distance;
    }

    function handlePointerEnd(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      activePointers.delete(e.pointerId);
      lastPinchDistance = activePointers.size === 2 ? distanceAndMidpoint([...activePointers.values()]).distance : null;
    }

    el.addEventListener("wheel", handleWheel as EventListener, { passive: false });
    el.addEventListener("pointerdown", handlePointerDown as EventListener);
    el.addEventListener("pointermove", handlePointerMove as EventListener, { passive: false });
    el.addEventListener("pointerup", handlePointerEnd as EventListener);
    el.addEventListener("pointercancel", handlePointerEnd as EventListener);
    return () => {
      el.removeEventListener("wheel", handleWheel as EventListener);
      el.removeEventListener("pointerdown", handlePointerDown as EventListener);
      el.removeEventListener("pointermove", handlePointerMove as EventListener);
      el.removeEventListener("pointerup", handlePointerEnd as EventListener);
      el.removeEventListener("pointercancel", handlePointerEnd as EventListener);
    };
    // No dependency array (re-runs every render) rather than `[ref]` -- a RefObject's identity
    // never changes, so `[ref]` alone would only ever attach once, at first mount. That's a real
    // gap for a consumer like WorldScreen where the element behind `ref` doesn't exist yet on the
    // very first render (it's behind an early-return branch) and only mounts later in the same
    // component instance: `ref.current` flips from null to real without the effect ever re-running
    // to notice. Re-running every render costs one cheap remove+add pair, which is worth it for
    // correctness here.
  });
}
