import { describe, it, expect } from "vitest";
import { planCorridor, offsetPolyline } from "./corridor.js";
import {
  distanceM,
  bearingDeg,
  polylineLengthM,
  type LatLng,
} from "../geo/geodesy.js";

/** A due-east axis at the equator: easy to reason about by hand. */
const straightAxis: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 }, // ~1113 m east
];

/** An axis that turns 90° — the case where naive offsetting pinches corners. */
const bentAxis: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 },
  { lat: 0.01, lng: 0.01 },
];

describe("offsetPolyline", () => {
  it("keeps every point at the requested distance on a straight axis", () => {
    const offset = offsetPolyline(straightAxis, 50);

    for (let i = 0; i < straightAxis.length; i++) {
      expect(distanceM(straightAxis[i], offset[i])).toBeCloseTo(50, 1);
    }
  });

  it("puts a positive offset to the right of travel", () => {
    // Travelling east, right is south, so latitude must decrease.
    const right = offsetPolyline(straightAxis, 50);
    const left = offsetPolyline(straightAxis, -50);

    expect(right[0].lat).toBeLessThan(0);
    expect(left[0].lat).toBeGreaterThan(0);
  });

  it("stays parallel: the offset line keeps the axis length", () => {
    const offset = offsetPolyline(straightAxis, 120);
    expect(polylineLengthM(offset)).toBeCloseTo(
      polylineLengthM(straightAxis),
      0,
    );
  });

  it("stretches the outer corner so the bend does not pinch", () => {
    // Turning left (east then north), the right-hand side is the outer one and
    // its corner must be pushed out by 1/cos(45°) ≈ 1.414 × the offset.
    const offset = offsetPolyline(bentAxis, 100);
    const cornerDistance = distanceM(bentAxis[1], offset[1]);

    expect(cornerDistance).toBeCloseTo(100 * Math.SQRT2, 0);
  });

  it("clamps the mitre on a hairpin instead of flinging the vertex away", () => {
    const hairpin: LatLng[] = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.01 },
      { lat: 0.00001, lng: 0 }, // doubles back on itself
    ];
    const offset = offsetPolyline(hairpin, 100);

    // Without a clamp this distance runs away towards infinity.
    expect(distanceM(hairpin[1], offset[1])).toBeLessThanOrEqual(100 * 3 + 1);
  });

  it("returns a copy when the offset is zero", () => {
    const offset = offsetPolyline(straightAxis, 0);
    expect(offset).toEqual(straightAxis);
    expect(offset).not.toBe(straightAxis);
  });

  it("rejects a polyline with fewer than two points", () => {
    expect(() => offsetPolyline([{ lat: 0, lng: 0 }], 10)).toThrow(RangeError);
  });
});

describe("planCorridor", () => {
  it("centres an odd number of lines on the axis", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 3,
      lineSpacingM: 40,
    });

    expect(plan.offsetsM).toEqual([-40, 0, 40]);
    expect(plan.corridorWidthM).toBe(80);
  });

  it("straddles the axis with an even number of lines", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 2,
      lineSpacingM: 40,
    });

    expect(plan.offsetsM).toEqual([-20, 20]);
    // No line runs down the middle.
    expect(plan.offsetsM).not.toContain(0);
  });

  it("alternates direction so the aircraft does not deadhead", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 2,
      lineSpacingM: 40,
      serpentine: true,
    });

    const first = plan.lines[0];
    const second = plan.lines[1];
    const firstBearing = bearingDeg(first[0], first[first.length - 1]);
    const secondBearing = bearingDeg(second[0], second[second.length - 1]);

    // Opposite headings, about 180° apart.
    expect(Math.abs(Math.abs(firstBearing - secondBearing) - 180)).toBeLessThan(
      1,
    );
  });

  it("keeps every line in the same direction when serpentine is off", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 3,
      lineSpacingM: 40,
      serpentine: false,
    });

    const headings = plan.lines.map((l) => bearingDeg(l[0], l[l.length - 1]));
    for (const h of headings) expect(h).toBeCloseTo(headings[0], 1);
  });

  it("turns only the line spacing when serpentining", () => {
    const spacing = 40;
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 3,
      lineSpacingM: spacing,
      serpentine: true,
    });

    // Each line ends beside the start of the next, so a turn is one spacing.
    expect(plan.turnaroundLengthTotalM).toBeCloseTo(spacing * 2, 0);
  });

  it("pays the whole line length per turn when serpentine is off", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 2,
      lineSpacingM: 40,
      serpentine: false,
    });

    // Flying every line in the same direction means transiting back each time —
    // which is exactly the waste the serpentine avoids.
    expect(plan.turnaroundLengthTotalM).toBeGreaterThan(1000);
  });

  it("sums the length of every line", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 4,
      lineSpacingM: 30,
    });

    expect(plan.lineLengthTotalM).toBeCloseTo(
      polylineLengthM(straightAxis) * 4,
      0,
    );
  });

  it("gives a single line no width and no turns", () => {
    const plan = planCorridor({
      axis: straightAxis,
      lineCount: 1,
      lineSpacingM: 40,
    });

    expect(plan.offsetsM).toEqual([0]);
    expect(plan.corridorWidthM).toBe(0);
    expect(plan.turnaroundLengthTotalM).toBe(0);
  });

  it("follows a bent axis on every line", () => {
    const plan = planCorridor({
      axis: bentAxis,
      lineCount: 3,
      lineSpacingM: 50,
    });

    for (const line of plan.lines) expect(line).toHaveLength(bentAxis.length);
  });

  it("rejects invalid input", () => {
    expect(() =>
      planCorridor({
        axis: [{ lat: 0, lng: 0 }],
        lineCount: 2,
        lineSpacingM: 10,
      }),
    ).toThrow(RangeError);
    expect(() =>
      planCorridor({ axis: straightAxis, lineCount: 0, lineSpacingM: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      planCorridor({ axis: straightAxis, lineCount: 2, lineSpacingM: 0 }),
    ).toThrow(RangeError);
  });
});
