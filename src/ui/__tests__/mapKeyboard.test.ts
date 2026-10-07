import { describe, expect, it } from "vitest";
import { isArrowKey, nextCellInDirection, type MapCell } from "../mapKeyboard.ts";

/** A pointy-top hex ring around the origin, at the World map's own spacing. */
const W = Math.sqrt(3) * 40;
const RING: MapCell<string>[] = [
  { key: "center", x: 0, y: 0 },
  { key: "e", x: W, y: 0 },
  { key: "w", x: -W, y: 0 },
  { key: "ne", x: W / 2, y: -60 },
  { key: "nw", x: -W / 2, y: -60 },
  { key: "se", x: W / 2, y: 60 },
  { key: "sw", x: -W / 2, y: 60 },
];

describe("nextCellInDirection", () => {
  it("moves straight sideways to the hex beside you", () => {
    expect(nextCellInDirection(RING, "center", "ArrowRight")).toBe("e");
    expect(nextCellInDirection(RING, "center", "ArrowLeft")).toBe("w");
  });

  it("moves up and down onto the nearer of the two diagonal neighbors", () => {
    expect(["ne", "nw"]).toContain(nextCellInDirection(RING, "center", "ArrowUp"));
    expect(["se", "sw"]).toContain(nextCellInDirection(RING, "center", "ArrowDown"));
  });

  it("prefers the cell straight ahead over a closer one far off to the side", () => {
    const cells: MapCell<string>[] = [
      { key: "here", x: 0, y: 0 },
      { key: "ahead", x: 100, y: 0 },
      { key: "offside", x: 30, y: 80 },
    ];
    expect(nextCellInDirection(cells, "here", "ArrowRight")).toBe("ahead");
  });

  it("returns null at the edge of the map, and for an unknown starting cell", () => {
    expect(nextCellInDirection(RING, "e", "ArrowRight")).toBeNull();
    expect(nextCellInDirection(RING, "nowhere", "ArrowRight")).toBeNull();
  });
});

describe("isArrowKey", () => {
  it("accepts only the four arrows", () => {
    expect(isArrowKey("ArrowUp")).toBe(true);
    expect(isArrowKey("Enter")).toBe(false);
  });
});
