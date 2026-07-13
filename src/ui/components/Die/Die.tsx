import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./Die.module.css";

const PIP_LAYOUT: Record<number, string[]> = {
  1: ["pC"],
  2: ["pTl", "pBr"],
  3: ["pTl", "pC", "pBr"],
  4: ["pTl", "pTr", "pBl", "pBr"],
  5: ["pTl", "pTr", "pC", "pBl", "pBr"],
  6: ["pTl", "pTr", "pMl", "pMr", "pBl", "pBr"],
};

const SHOW_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

const TOSS_DURATION_MS = 850;

/** Rotation needed to carry `current` to `targetMod` (mod 360), plus a couple of extra full turns for flair. */
function angleTo(current: number, targetMod: number): number {
  const curMod = ((current % 360) + 360) % 360;
  const tgtMod = ((targetMod % 360) + 360) % 360;
  let diff = tgtMod - curMod;
  if (diff < 0) diff += 360;
  const extraTurns = 2 + Math.floor(Math.random() * 2);
  return current + diff + extraTurns * 360;
}

export interface DieProps {
  /** The face this die should show (1-6). */
  value: number;
  /** Change this (e.g. increment a counter) each time a new roll animation should play. */
  rollToken: number;
  /** Stagger this die's animation start behind others rolled in the same pool. */
  delayMs?: number;
  /** Die edge length in pixels. */
  size?: number;
}

export function Die({ value, rollToken, delayMs = 0, size = 52 }: DieProps) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotation = useRef({ x: 0, y: 0 });
  const isFirstRender = useRef(true);
  const [tossing, setTossing] = useState(false);

  useEffect(() => {
    const cube = cubeRef.current;
    const target = SHOW_ROTATION[value];
    if (!cube || !target) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      rotation.current = { x: target[0], y: target[1] };
      cube.style.transform = `rotateX(${target[0]}deg) rotateY(${target[1]}deg)`;
      return;
    }

    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const delayTimer = setTimeout(() => {
      rotation.current.x = angleTo(rotation.current.x, target[0]);
      rotation.current.y = angleTo(rotation.current.y, target[1]);
      cube.style.transform = `rotateX(${rotation.current.x}deg) rotateY(${rotation.current.y}deg)`;
      setTossing(true);
      settleTimer = setTimeout(() => setTossing(false), TOSS_DURATION_MS);
    }, delayMs);

    return () => {
      clearTimeout(delayTimer);
      if (settleTimer) clearTimeout(settleTimer);
    };
    // rollToken is the intentional trigger; value/delayMs change alongside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollToken]);

  return (
    <div
      className={`${styles.die} ${tossing ? styles.rolling : ""}`}
      style={{ "--die-size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.dieCube} ref={cubeRef}>
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <div key={face} className={`${styles.dieFace} ${styles[`face${face}`]}`}>
            {PIP_LAYOUT[face]!.map((pos) => (
              <div key={pos} className={`${styles.pip} ${styles[pos]}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
