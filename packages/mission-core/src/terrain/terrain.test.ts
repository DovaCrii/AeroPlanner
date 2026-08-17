import { describe, it, expect } from "vitest";
import {
  followTerrain,
  terrainProfile,
  clearanceAlongRoute,
  requiredClimbRateMs,
  type ElevationSource,
} from "./terrain.js";
import { type LatLng } from "../geo/geodesy.js";

/** Flat ground at 100 m AMSL. */
const flat: ElevationSource = { elevationM: () => 100 };

/**
 * A ramp rising eastwards: 100 m at lng 0, climbing 10 000 m per degree — about
 * 9 m per 100 m on the ground at the equator. Steep, but easy to verify.
 */
const ramp: ElevationSource = {
  elevationM: (p) => 100 + p.lng * 10000,
};

/** Knows nothing east of lng 0.005 — stands in for the edge of a loaded DEM. */
const partial: ElevationSource = {
  elevationM: (p) => (p.lng > 0.005 ? null : 100),
};

const route: LatLng[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 }, // ~1113 m east
];

describe("followTerrain", () => {
  it("holds the target height over flat ground", () => {
    const result = followTerrain({
      path: route,
      source: flat,
      targetAglM: 80,
      takeoffElevationM: 100,
    });

    for (const p of result.points) {
      expect(p.aglM).toBe(80);
      // Takeoff is on the same flat ground, so the commanded altitude is just
      // the target height.
      expect(p.altitudeRelativeM).toBeCloseTo(80, 6);
    }
    expect(result.gapCount).toBe(0);
  });

  it("climbs with the ground on a slope", () => {
    const result = followTerrain({
      path: route,
      source: ramp,
      targetAglM: 80,
      takeoffElevationM: 100,
    });

    const [first, last] = [
      result.points[0],
      result.points[result.points.length - 1],
    ];
    // The ground rises 100 m over the route, so the commanded altitude must too.
    expect(last.altitudeRelativeM! - first.altitudeRelativeM!).toBeCloseTo(
      100,
      6,
    );
    // And the height above ground stays put — that is the whole point.
    expect(last.aglM).toBe(first.aglM);
  });

  it("accounts for a takeoff point higher than the terrain ahead", () => {
    const result = followTerrain({
      path: route,
      source: flat,
      targetAglM: 80,
      takeoffElevationM: 130,
    });

    // Ground at 100, target 80 AGL → 180 AMSL → 50 above a 130 m takeoff.
    expect(result.points[0].altitudeRelativeM).toBeCloseTo(50, 6);
  });

  it("leaves altitude null where the source has no data, and counts it", () => {
    const result = followTerrain({
      path: route,
      source: partial,
      targetAglM: 80,
      takeoffElevationM: 100,
    });

    expect(result.gapCount).toBe(1);
    expect(
      result.points[result.points.length - 1].altitudeRelativeM,
    ).toBeNull();
    // Never invent an elevation: a fabricated one is indistinguishable from a
    // real one downstream.
    expect(result.points[result.points.length - 1].groundElevationM).toBeNull();
  });

  it("rejects a non-positive target height", () => {
    expect(() =>
      followTerrain({
        path: route,
        source: flat,
        targetAglM: 0,
        takeoffElevationM: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("terrainProfile", () => {
  it("samples at the requested spacing and records distance along", () => {
    const samples = terrainProfile(route, flat, 100);

    expect(samples[0].distanceAlongM).toBe(0);
    for (let i = 1; i < samples.length - 1; i++) {
      expect(
        samples[i].distanceAlongM - samples[i - 1].distanceAlongM,
      ).toBeCloseTo(100, 0);
    }
    // The end of the route is always sampled. 0.01° of longitude at the equator
    // is 1111.9 m on the IUGG mean radius.
    expect(samples[samples.length - 1].distanceAlongM).toBeCloseTo(1112, 0);
  });

  it("reads the elevation at every sample", () => {
    const samples = terrainProfile(route, ramp, 200);
    const elevations = samples.map((s) => s.groundElevationM!);

    for (let i = 1; i < elevations.length; i++) {
      expect(elevations[i]).toBeGreaterThan(elevations[i - 1]);
    }
  });

  it("rejects invalid input", () => {
    expect(() => terrainProfile([{ lat: 0, lng: 0 }], flat, 100)).toThrow(
      RangeError,
    );
    expect(() => terrainProfile(route, flat, 0)).toThrow(RangeError);
  });
});

describe("clearanceAlongRoute", () => {
  it("finds the tightest clearance between the waypoints, not just at them", () => {
    // A hill in the middle that both endpoints miss entirely.
    const hill: ElevationSource = {
      elevationM: (p) => (p.lng > 0.004 && p.lng < 0.006 ? 300 : 100),
    };

    const report = clearanceAlongRoute(route, hill, 250, 50, 50);

    // Flying at 250 m over a 300 m hill: 50 m *below* the ground.
    expect(report.minimumAglM).toBeLessThan(0);
    expect(report.violatesMinimum).toBe(true);
    expect(report.atDistanceAlongM).toBeGreaterThan(400);
  });

  it("passes when the route stays above the floor", () => {
    const report = clearanceAlongRoute(route, flat, 200, 100, 50);

    expect(report.minimumAglM).toBeCloseTo(100, 0);
    expect(report.violatesMinimum).toBe(false);
  });

  it("counts gaps instead of treating them as sea level", () => {
    const report = clearanceAlongRoute(route, partial, 200, 200, 50);

    expect(report.gapCount).toBeGreaterThan(0);
    // The known part is flat at 100 m, so the clearance there is 100 m — a
    // missing sample must not masquerade as a 200 m clearance over the ocean.
    expect(report.minimumAglM).toBeCloseTo(100, 0);
  });
});

describe("requiredClimbRateMs", () => {
  it("is zero over flat ground", () => {
    const { points } = followTerrain({
      path: route,
      source: flat,
      targetAglM: 80,
      takeoffElevationM: 100,
    });

    expect(requiredClimbRateMs(points, 10)).toBeCloseTo(0, 6);
  });

  it("scales with slope and speed", () => {
    const { points } = followTerrain({
      path: route,
      source: ramp,
      targetAglM: 80,
      takeoffElevationM: 100,
    });

    // 100 m of climb over 1113 m at 10 m/s → about 0.9 m/s.
    const slow = requiredClimbRateMs(points, 10);
    const fast = requiredClimbRateMs(points, 20);

    expect(slow).toBeCloseTo(0.9, 1);
    expect(fast).toBeCloseTo(slow * 2, 6);
  });

  it("ignores segments with unknown elevation", () => {
    const { points } = followTerrain({
      path: route,
      source: partial,
      targetAglM: 80,
      takeoffElevationM: 100,
    });

    expect(() => requiredClimbRateMs(points, 10)).not.toThrow();
  });

  it("rejects a non-positive speed", () => {
    expect(() => requiredClimbRateMs([], 0)).toThrow(RangeError);
  });
});
