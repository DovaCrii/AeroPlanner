import { describe, it, expect } from "vitest";
import {
  planCoverage,
  lineSpacingForOverlapM,
  overlapForLineSpacing,
} from "./coverage.js";
import { footprintM } from "./camera.js";
import { MAVIC_3E_WIDE, MAVIC_3E } from "../catalog/aircraft.js";

const baseRequest = {
  camera: MAVIC_3E_WIDE,
  altitudeAglM: 100,
  frontOverlap: 0.8,
  sideOverlap: 0.7,
};

describe("planCoverage", () => {
  it("carves the spacing out of the footprint by the overlap", () => {
    const fp = footprintM(MAVIC_3E_WIDE, 100);
    const plan = planCoverage(baseRequest);

    expect(plan.lineSpacingM).toBeCloseTo(fp.acrossTrackM * 0.3, 6);
    expect(plan.photoSpacingM).toBeCloseTo(fp.alongTrackM * 0.2, 6);
  });

  it("caps speed by the shutter interval when nothing else binds", () => {
    const plan = planCoverage(baseRequest);

    // 80 % front overlap at 100 m leaves ~21 m between shots; at 0.7 s that is
    // about 30 m/s — well past what the aircraft can do, which is the point of
    // the next test.
    expect(plan.speedLimitedBy).toBe("shutter-interval");
    expect(plan.recommendedSpeedMs).toBeCloseTo(
      plan.photoSpacingM / MAVIC_3E_WIDE.minShutterIntervalS,
      6,
    );
  });

  it("caps speed by the aircraft when that is the lower limit", () => {
    const plan = planCoverage({
      ...baseRequest,
      maxAircraftSpeedMs: MAVIC_3E.maxSpeedMs,
    });

    expect(plan.speedLimitedBy).toBe("aircraft");
    expect(plan.recommendedSpeedMs).toBe(MAVIC_3E.maxSpeedMs);
  });

  it("caps speed by motion blur with a slow shutter", () => {
    const plan = planCoverage({
      ...baseRequest,
      shutterSpeedS: 1 / 100,
      maxMotionBlurPx: 1,
      maxAircraftSpeedMs: MAVIC_3E.maxSpeedMs,
    });

    // One pixel of blur at ~2.7 cm GSD with a 1/100 s exposure allows only
    // ~2.7 m/s — far below the aircraft ceiling.
    expect(plan.speedLimitedBy).toBe("motion-blur");
    expect(plan.recommendedSpeedMs).toBeCloseTo(plan.gsdCm / 100 / 0.01, 6);
  });

  it("keeps the shutter interval consistent with the chosen speed", () => {
    const plan = planCoverage({
      ...baseRequest,
      maxAircraftSpeedMs: MAVIC_3E.maxSpeedMs,
    });

    expect(plan.shutterIntervalS).toBeCloseTo(
      plan.photoSpacingM / plan.recommendedSpeedMs,
      6,
    );
    // Whatever the cap, the camera must be able to keep up.
    expect(plan.shutterIntervalS).toBeGreaterThanOrEqual(
      MAVIC_3E_WIDE.minShutterIntervalS - 1e-9,
    );
  });

  it("gives a tighter spacing as overlap grows", () => {
    const loose = planCoverage({ ...baseRequest, sideOverlap: 0.6 });
    const tight = planCoverage({ ...baseRequest, sideOverlap: 0.85 });

    expect(tight.lineSpacingM).toBeLessThan(loose.lineSpacingM);
  });

  it("rejects an out-of-range overlap", () => {
    expect(() => planCoverage({ ...baseRequest, sideOverlap: 1 })).toThrow(
      RangeError,
    );
    expect(() => planCoverage({ ...baseRequest, frontOverlap: -0.1 })).toThrow(
      RangeError,
    );
  });
});

describe("overlap and spacing are inverses", () => {
  it("round-trips through line spacing", () => {
    for (const overlap of [0, 0.3, 0.6, 0.75, 0.9]) {
      const spacing = lineSpacingForOverlapM(MAVIC_3E_WIDE, 100, overlap);
      expect(overlapForLineSpacing(MAVIC_3E_WIDE, 100, spacing)).toBeCloseTo(
        overlap,
        6,
      );
    }
  });

  it("reports a negative overlap when the spacing leaves a gap", () => {
    const swathM = footprintM(MAVIC_3E_WIDE, 100).acrossTrackM;
    // Lines further apart than the swath: the ground between them is unphotographed.
    expect(
      overlapForLineSpacing(MAVIC_3E_WIDE, 100, swathM * 1.2),
    ).toBeLessThan(0);
  });
});
