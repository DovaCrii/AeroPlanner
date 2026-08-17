import { describe, it, expect } from "vitest";
import { waypointsAlongLine, waypointsForCorridor } from "./waypoints.js";
import { planCorridor } from "./corridor.js";
import { distanceM, type LatLng } from "../geo/geodesy.js";

/** Due east at the equator, ~1113 m long. */
const line: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 },
];

/** An L: 1113 m east, then 1105 m north. */
const bent: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 },
  { lat: 0.01, lng: 0.01 },
];

const base = { altitudeAglM: 80, photoSpacingM: 100 };

describe("waypointsAlongLine", () => {
  it("spaces the shots evenly along the line", () => {
    const wps = waypointsAlongLine({ ...base, line });

    for (let i = 1; i < wps.length - 1; i++) {
      expect(distanceM(wps[i - 1].position, wps[i].position)).toBeCloseTo(
        100,
        0,
      );
    }
  });

  it("starts at the beginning and finishes at the end of the line", () => {
    const wps = waypointsAlongLine({ ...base, line });

    expect(distanceM(wps[0].position, line[0])).toBeLessThan(1);
    expect(
      distanceM(wps[wps.length - 1].position, line[line.length - 1]),
    ).toBeLessThan(1);
  });

  it("walks by distance, not by vertex", () => {
    // The bend adds a vertex but no extra length beyond its own segment, so the
    // count must follow the arc length rather than the number of points drawn.
    const straightCount = waypointsAlongLine({ ...base, line }).length;
    const bentCount = waypointsAlongLine({ ...base, line: bent }).length;

    expect(bentCount).toBeGreaterThan(straightCount * 1.8);
  });

  it("keeps the spacing across a vertex", () => {
    const wps = waypointsAlongLine({ ...base, line: bent });

    // No gap should exceed the requested spacing by more than rounding; the
    // classic bug is restarting the count at every vertex.
    for (let i = 1; i < wps.length - 1; i++) {
      expect(distanceM(wps[i - 1].position, wps[i].position)).toBeLessThan(101);
    }
  });

  it("points the camera straight down when aiming nadir", () => {
    const wps = waypointsAlongLine({ ...base, line, aim: "nadir" });

    for (const wp of wps) {
      expect(wp.gimbalPitchDeg).toBe(-90);
      // Flying east.
      expect(wp.headingDeg).toBeCloseTo(90, 0);
    }
  });

  it("turns the camera sideways when aiming at the corridor", () => {
    const right = waypointsAlongLine({
      ...base,
      line,
      aim: "side",
      sidePitchDeg: -30,
      sideLooksRight: true,
    });
    const left = waypointsAlongLine({
      ...base,
      line,
      aim: "side",
      sideLooksRight: false,
    });

    // Flying east, looking right means facing south (180°), left means north (0°).
    expect(right[0].headingDeg).toBeCloseTo(180, 0);
    expect(right[0].gimbalPitchDeg).toBe(-30);
    expect(left[0].headingDeg).toBeCloseTo(0, 0);
  });

  it("marks every waypoint as a shot", () => {
    const wps = waypointsAlongLine({ ...base, line });
    expect(wps.every((w) => w.takePhoto)).toBe(true);
  });

  it("carries the requested altitude through", () => {
    const wps = waypointsAlongLine({ ...base, line, altitudeAglM: 123 });
    expect(wps.every((w) => w.altitudeAglM === 123)).toBe(true);
  });

  it("still produces both ends when the spacing exceeds the line", () => {
    const wps = waypointsAlongLine({ ...base, line, photoSpacingM: 5000 });
    expect(wps).toHaveLength(2);
  });

  it("rejects invalid input", () => {
    expect(() =>
      waypointsAlongLine({ ...base, line: [{ lat: 0, lng: 0 }] }),
    ).toThrow(RangeError);
    expect(() =>
      waypointsAlongLine({ ...base, line, photoSpacingM: 0 }),
    ).toThrow(RangeError);
  });
});

describe("waypointsForCorridor", () => {
  it("chains every line of the corridor in flight order", () => {
    const plan = planCorridor({
      axis: line,
      lineCount: 3,
      lineSpacingM: 50,
    });
    const wps = waypointsForCorridor(plan.lines, base);

    const perLine = waypointsAlongLine({ ...base, line: plan.lines[0] }).length;
    expect(wps.length).toBeCloseTo(perLine * 3, -1);

    // The serpentine means the end of one line sits beside the start of the
    // next: the hop between them is about one line spacing, not a whole line.
    const endOfFirst = wps[perLine - 1].position;
    const startOfSecond = wps[perLine].position;
    expect(distanceM(endOfFirst, startOfSecond)).toBeLessThan(120);
  });
});
