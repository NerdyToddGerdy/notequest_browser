import type { SegmentType } from "../../../data/dungeonTypes.ts";

export function SegmentIcon({ type }: { type: SegmentType }) {
  switch (type) {
    case "corridor":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="10" width="20" height="6" />
          <line x1="3" y1="13" x2="23" y2="13" strokeDasharray="2 2" />
        </svg>
      );
    case "staircase":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <polyline points="3,22 3,17 9,17 9,12 15,12 15,7 21,7 21,3" />
        </svg>
      );
    case "room-small":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="8" y="8" width="10" height="10" />
        </svg>
      );
    case "room-medium":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="5" y="5" width="16" height="16" />
        </svg>
      );
    case "room-wide":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="8" width="22" height="10" />
        </svg>
      );
    case "room-large":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="4" width="22" height="18" />
        </svg>
      );
    case "final":
      return (
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="13" cy="11" r="7" />
          <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none" />
          <path d="M9 15l1.5 3M17 15l-1.5 3M13 15v3" />
        </svg>
      );
  }
}

export function DoorIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="2" width="10" height="16" rx="1" />
      <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DescentIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v11M5 10l5 5 5-5" />
    </svg>
  );
}

/** DescentIcon's arrow flipped vertically -- "the way back up and out," badged onto the
 * dungeon's entrance segment so it reads differently from an ordinary descent staircase. */
export function EntranceIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17V6M5 10l5-5 5 5" />
    </svg>
  );
}

export function MonsterIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

export function SecretIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <circle cx="8" cy="6" r="2.4" />
      <path d="M6.3 7.5h3.4l1 5.5h-5.4z" />
    </svg>
  );
}
