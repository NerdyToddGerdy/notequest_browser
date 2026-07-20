import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DungeonState } from "../../../engine/dungeonState.ts";
import { classifyDoorOpen, DIR_VEC, edgePoint, reachableSegIds } from "../../../engine/dungeon.ts";
import { rollDie } from "../../../engine/dice.ts";
import { OPEN_DOOR_TABLE, TYPE_LABELS, type SegmentType } from "../../../data/dungeonTypes.ts";
import { DUNGEON_TABLES } from "../../../data/dungeonTables.ts";
import { Die } from "../Die/Die.tsx";
import { revealDelay } from "../../rollTiming.ts";
import { computeMapLayout } from "./layout.ts";
import { DescentIcon, DoorIcon, EntranceIcon, MonsterIcon, SecretIcon, SegmentIcon } from "./icons.tsx";
import { useZoomGesture } from "../../hooks/useZoomGesture.ts";
import styles from "./DungeonMap.module.css";

const AUTOMATIC_KINDS = new Set(["descend-final", "dead-end-final", "reuse-final", "reuse-normal"]);
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const TYPE_CLASS: Partial<Record<SegmentType, string>> = {
  corridor: styles.typeCorridor,
  staircase: styles.typeStaircase,
  final: styles.typeFinal,
};

const PILLAR_OFFSETS = [
  [10, 10],
  [-10, 10],
  [10, -10],
  [-10, -10],
] as const;

export interface DungeonMapProps {
  state: DungeonState;
  onDoorResolved: (segId: number, doorIdx: number, roll: number | null, wasNoisy: boolean) => void;
  onResolveLock: (
    segId: number,
    doorIdx: number,
    doorRoll: number,
    trapRoll: number | null,
    lockChoice: "pickLock" | "breakDoor" | null,
  ) => void;
  onSelectSegment: (segId: number) => void;
  onSwitchLevel: (levelIndex: number, segId?: number) => void;
  /** Fires the instant a door-lock roll is confirmed as a trap -- before the second die rolls to
   * decide *which* trap, so the warning lands as an ambush rather than after-the-fact flavor text. */
  onTrapTriggered?: () => void;
}

type DoorFlow =
  | { kind: "rolling"; segId: number; doorIdx: number; x: number; y: number }
  | { kind: "lockChoice"; segId: number; doorIdx: number; x: number; y: number; doorRoll: number };

export function DungeonMap({
  state,
  onDoorResolved,
  onResolveLock,
  onSelectSegment,
  onSwitchLevel,
  onTrapTriggered,
}: DungeonMapProps) {
  const level = state.levels[state.activeLevel];
  const layout = useMemo(() => computeMapLayout(level ?? { segments: [] }), [level]);
  // Fog of war: only the player's current segment and its direct, already-opened-door neighbors
  // are interactive right now (see CLAUDE.md's Positional movement section) -- everything else on
  // this level's map renders greyed out until the player walks there segment by segment. A level
  // other than wherever the player actually stands ends up with an empty reachable set here (its
  // segment ids never match currentSegId, which lives elsewhere), correctly locking it read-only.
  const reachable = useMemo(() => (level ? reachableSegIds(level, state.currentSegId) : new Set<number>()), [level, state.currentSegId]);
  // Mirrors the reducer's hasPendingRoomEntry: a quiet arrival revealed monsters the player hasn't
  // yet chosen to Attack First or Move Silently past -- no further doors open until they decide.
  // `state.alive` guards against a lost fight in this same room (never marks monstersDefeated)
  // leaving this true forever post-death -- every use site here already ORs in its own `!state.alive`
  // check too, so this is defense-in-depth, not the only thing guarding door interaction.
  const currentSeg = level?.segments.find((s) => s.id === state.currentSegId);
  const pendingRoomEntry =
    state.alive && !!currentSeg?.monsters && !currentSeg.monstersDefeated && !currentSeg.sneakedPast;

  const [doorFlow, setDoorFlow] = useState<DoorFlow | null>(null);
  const [dieValue, setDieValue] = useState(1);
  const [dieRollToken, setDieRollToken] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  /** True once a pointer-down has moved past the click-vs-drag threshold -- checked (and reset) by
   * the capturing click handler below so a drag-to-pan gesture doesn't also select whatever room or
   * door the pointer happened to release over. */
  const didDrag = useRef(false);

  // Zoom (wheel + pinch, see useZoomGesture) -- applied as a CSS transform on .canvas rather than
  // changing layout.width/height, since modern browsers already grow/shrink .scroll's scrollable
  // region to match transformed content. `pendingFocalPoint` is set synchronously in the zoom
  // callback and consumed by the layout effect below, which runs (and corrects scrollLeft/scrollTop)
  // before the next paint -- avoids needing flushSync just to read the DOM mid-handler.
  const [scale, setScale] = useState(1);
  const pendingFocalPoint = useRef<{ clientX: number; clientY: number } | null>(null);
  const prevScale = useRef(1);
  useZoomGesture(scrollRef, ({ factor, clientX, clientY }) => {
    pendingFocalPoint.current = { clientX, clientY };
    setScale((s) => clamp(s * factor, MIN_SCALE, MAX_SCALE));
  });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const focal = pendingFocalPoint.current;
    if (el && focal) {
      const rect = el.getBoundingClientRect();
      const viewportX = focal.clientX - rect.left;
      const viewportY = focal.clientY - rect.top;
      const contentX = (el.scrollLeft + viewportX) / prevScale.current;
      const contentY = (el.scrollTop + viewportY) / prevScale.current;
      el.scrollLeft = contentX * scale - viewportX;
      el.scrollTop = contentY * scale - viewportY;
    }
    prevScale.current = scale;
    pendingFocalPoint.current = null;
  }, [scale]);

  if (!level) return null;

  // Click-and-drag panning (mouse only -- touch already gets native scrolling from `overflow:
  // auto` on .scroll, and fighting that with a custom touch handler would be a net regression).
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    dragOrigin.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const origin = dragOrigin.current;
    const el = scrollRef.current;
    if (!origin || !el) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (!didDrag.current && Math.hypot(dx, dy) > 4) {
      didDrag.current = true;
      // Deferred until movement is confirmed: capturing on pointerdown itself retargets the
      // resulting mouseup/click compatibility events to this element (per the Pointer Events
      // spec), which would swallow a plain click on a room/door before it ever reaches them.
      el.setPointerCapture(e.pointerId);
    }
    if (didDrag.current) {
      el.scrollLeft = origin.scrollLeft - dx;
      el.scrollTop = origin.scrollTop - dy;
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragOrigin.current = null;
    if (scrollRef.current?.hasPointerCapture(e.pointerId)) {
      scrollRef.current.releasePointerCapture(e.pointerId);
    }
  }

  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (didDrag.current) {
      didDrag.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function animateDie(value: number, onDone: () => void) {
    setDieValue(value);
    setDieRollToken((t) => t + 1);
    window.setTimeout(onDone, revealDelay(1));
  }

  /** Rolls (if needed) and applies the Segments-table result once any lock/trap is out of the way. */
  function proceedToSegment(segId: number, doorIdx: number, x: number, y: number, wasNoisy: boolean) {
    const classification = classifyDoorOpen(state, segId, doorIdx);
    if (AUTOMATIC_KINDS.has(classification.kind)) {
      setDoorFlow(null);
      onDoorResolved(segId, doorIdx, null, wasNoisy);
      return;
    }
    setDoorFlow({ kind: "rolling", segId, doorIdx, x, y });
    const segRoll = rollDie();
    animateDie(segRoll, () => {
      setDoorFlow(null);
      onDoorResolved(segId, doorIdx, segRoll, wasNoisy);
    });
  }

  function handleDoorClick(segId: number, doorIdx: number, x: number, y: number) {
    if (doorFlow || !state.alive || state.combat || pendingRoomEntry || segId !== state.currentSegId) return;
    setDoorFlow({ kind: "rolling", segId, doorIdx, x, y });
    const doorRoll = rollDie();
    animateDie(doorRoll, () => {
      const outcome = OPEN_DOOR_TABLE[doorRoll]!;
      if (outcome === "unlocked") {
        onResolveLock(segId, doorIdx, doorRoll, null, null);
        proceedToSegment(segId, doorIdx, x, y, false);
      } else if (outcome === "trap") {
        onTrapTriggered?.();
        setDoorFlow({ kind: "rolling", segId, doorIdx, x, y });
        const trapRoll = rollDie();
        animateDie(trapRoll, () => {
          onResolveLock(segId, doorIdx, doorRoll, trapRoll, null);
          const trap = state.dungeonTypeKey ? DUNGEON_TABLES[state.dungeonTypeKey].trap[trapRoll] : undefined;
          const cost = trap?.torchCost ?? 0;
          if (cost > 0 && state.torches < cost) {
            setDoorFlow(null); // the Darkness took them -- the door never opens
            return;
          }
          // Setting off a trap makes noise -- monsters beyond the door get the first attack.
          proceedToSegment(segId, doorIdx, x, y, true);
        });
      } else {
        setDoorFlow({ kind: "lockChoice", segId, doorIdx, x, y, doorRoll });
      }
    });
  }

  function handleLockChoice(choice: "pickLock" | "breakDoor") {
    if (!doorFlow || doorFlow.kind !== "lockChoice") return;
    const { segId, doorIdx, x, y, doorRoll } = doorFlow;
    onResolveLock(segId, doorIdx, doorRoll, null, choice);
    if (choice === "pickLock" && state.torches < 1) {
      setDoorFlow(null); // the Darkness took them while picking the lock
      return;
    }
    // Breaking the door down is loud; picking the lock is quiet.
    proceedToSegment(segId, doorIdx, x, y, choice === "breakDoor");
  }

  return (
    <div className={styles.wrap}>
      <div
        ref={scrollRef}
        className={styles.scroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
      >
        <div
          className={styles.canvas}
          style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        >
          {level.connectors.map((connector, index) => (
            <div
              key={index}
              className={`${styles.connector} ${connector.horiz ? styles.horiz : styles.vert}`}
              style={{
                left: connector.x - layout.originX,
                top: connector.y - layout.originY,
                width: connector.w,
                height: connector.h,
              }}
            />
          ))}

          {level.segments.map((seg) => {
            const isReachable = reachable.has(seg.id);
            return (
            <div
              key={seg.id}
              className={`${styles.room} ${TYPE_CLASS[seg.type] ?? ""} ${seg.isEntrance ? styles.typeEntrance : ""} ${seg.id === state.selectedSegId ? styles.selected : ""} ${seg.id === state.currentSegId ? styles.current : ""} ${isReachable ? "" : styles.locked}`}
              style={{ left: seg.x - layout.originX, top: seg.y - layout.originY, width: seg.w, height: seg.h }}
              title={`${seg.isEntrance ? "Entrance " : ""}${TYPE_LABELS[seg.type]}${seg.flavor ? ` — ${seg.flavor}` : ""}${isReachable ? "" : " (out of reach -- walk there first)"}`}
              onClick={() => isReachable && onSelectSegment(seg.id)}
            >
              <span className={styles.roomId}>S{seg.id}</span>
              <div className={styles.roomIcon}>
                <SegmentIcon type={seg.type} />
              </div>
              {seg.type === "room-large" &&
                PILLAR_OFFSETS.map(([dx, dy], i) => (
                  <span
                    key={i}
                    className={styles.pillarDot}
                    style={{
                      left: dx > 0 ? dx : seg.w + dx - 7,
                      top: dy > 0 ? dy : seg.h + dy - 7,
                    }}
                  />
                ))}
              {seg.isEntrance && (
                <span className={`${styles.badge} ${styles.entrance}`} title="Dungeon entrance">
                  <EntranceIcon />
                </span>
              )}
              {seg.monsters && !seg.monstersDefeated && (
                <span className={`${styles.badge} ${styles.monster}`}>
                  <MonsterIcon />
                </span>
              )}
              {seg.roomContent?.secretPassage && (
                <span
                  className={`${styles.badge} ${styles.secret} ${seg.secretPassageSearched ? styles.searched : ""}`}
                >
                  <SecretIcon />
                </span>
              )}
            </div>
            );
          })}

          {level.segments.flatMap((seg) =>
            seg.doors.map((door, idx) => {
              const pt = edgePoint(seg, door.dir);
              const vec = DIR_VEC[door.dir];
              const mx = pt.x + vec.x * 22 - layout.originX;
              const my = pt.y + vec.y * 22 - layout.originY;

              if (!door.opened) {
                // Hide every other door while one is mid-resolution so the lock-choice
                // popover never has to compete with a neighboring door icon for space.
                if (doorFlow && !(doorFlow.segId === seg.id && doorFlow.doorIdx === idx)) return null;
                return (
                  <button
                    key={`${seg.id}-${idx}`}
                    type="button"
                    className={styles.doorBtn}
                    style={{ left: mx - 12, top: my - 12 }}
                    disabled={
                      doorFlow !== null ||
                      !state.alive ||
                      !!state.combat ||
                      pendingRoomEntry ||
                      seg.id !== state.currentSegId
                    }
                    title={seg.id === state.currentSegId ? "Open door" : "Walk here first"}
                    onClick={() => handleDoorClick(seg.id, idx, mx, my)}
                  >
                    <DoorIcon />
                  </button>
                );
              }
              if (door.leadsToLevel == null) return null;
              const targetLevel = door.leadsToLevel;
              return (
                <button
                  key={`${seg.id}-${idx}`}
                  type="button"
                  className={styles.descentBtn}
                  style={{ left: mx - 13, top: my - 13 }}
                  disabled={!state.alive || !!state.combat || seg.id !== state.currentSegId}
                  title={seg.id === state.currentSegId ? `Descend to Level ${targetLevel + 1}` : "Walk here first"}
                  onClick={() => door.childId != null && onSwitchLevel(targetLevel, door.childId)}
                >
                  <DescentIcon />
                </button>
              );
            }),
          )}

          {doorFlow && doorFlow.kind === "rolling" && (
            <div className={styles.rollOverlay} style={{ left: doorFlow.x - 14, top: doorFlow.y - 44 }}>
              <Die value={dieValue} rollToken={dieRollToken} />
            </div>
          )}

          {doorFlow && doorFlow.kind === "lockChoice" && (
            <div className={styles.lockChoice} style={{ left: doorFlow.x - 70, top: doorFlow.y - 76 }}>
              <p>Locked!</p>
              <button type="button" onClick={() => handleLockChoice("pickLock")} disabled={state.torches < 1}>
                Pick Lock (1 torch)
              </button>
              <button type="button" onClick={() => handleLockChoice("breakDoor")}>
                Break Door (free)
              </button>
            </div>
          )}
        </div>
      </div>
      {scale !== 1 && (
        <button type="button" className={styles.resetZoomBtn} onClick={() => setScale(1)}>
          Reset Zoom
        </button>
      )}
    </div>
  );
}
