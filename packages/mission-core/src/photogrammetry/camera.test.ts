import { describe, it, expect } from "vitest";
import {
  gsdCmPerPx,
  nominalGsdCm,
  altitudeForGsdM,
  footprintM,
} from "./camera.js";
import { MAVIC_3E_WIDE } from "../catalog/aircraft.js";

describe("GSD", () => {
  /**
   * Two independent checks against the datasheet rather than against the code:
   *
   * 1. GSD also equals pixel pitch × altitude / focal length. Feeding DJI's
   *    published 3.3 µm pitch through that route must agree with the
   *    sensor-size route the implementation takes.
   * 2. DJI quotes roughly 2.7 cm/px at 100 m for the M3E. The computed
   *    2.684 cm rounds to that, so the figure is confirmed to the precision
   *    at which it is published — asserting more decimals would be asserting
   *    DJI's rounding, not our arithmetic.
   */
  it("matches the pixel-pitch derivation for the Mavic 3E at 100 m", () => {
    const pitchM = 3.3e-6;
    const expectedCm = ((pitchM * 100) / 12.29e-3) * 100;

    expect(nominalGsdCm(MAVIC_3E_WIDE, 100)).toBeCloseTo(expectedCm, 2);
    expect(nominalGsdCm(MAVIC_3E_WIDE, 100)).toBeCloseTo(2.7, 1);
  });

  it("scales linearly with altitude", () => {
    const at50 = nominalGsdCm(MAVIC_3E_WIDE, 50);
    const at100 = nominalGsdCm(MAVIC_3E_WIDE, 100);
    const at200 = nominalGsdCm(MAVIC_3E_WIDE, 200);

    expect(at100 / at50).toBeCloseTo(2, 6);
    expect(at200 / at100).toBeCloseTo(2, 6);
  });

  it("gives a near-square GSD, since the pixels are square", () => {
    const { widthCm, heightCm } = gsdCmPerPx(MAVIC_3E_WIDE, 100);
    expect(widthCm).toBeCloseTo(heightCm, 3);
  });

  it("rejects a non-positive altitude", () => {
    expect(() => nominalGsdCm(MAVIC_3E_WIDE, 0)).toThrow(RangeError);
    expect(() => nominalGsdCm(MAVIC_3E_WIDE, -10)).toThrow(RangeError);
  });
});

describe("altitudeForGsdM", () => {
  it("round-trips with nominalGsdCm", () => {
    for (const targetCm of [1, 2, 2.5, 5, 10]) {
      const altitude = altitudeForGsdM(MAVIC_3E_WIDE, targetCm);
      expect(nominalGsdCm(MAVIC_3E_WIDE, altitude)).toBeCloseTo(targetCm, 6);
    }
  });

  it("puts a 2 cm GSD at roughly 74 m for the Mavic 3E", () => {
    expect(altitudeForGsdM(MAVIC_3E_WIDE, 2)).toBeCloseTo(74.5, 0);
  });

  it("rejects a non-positive target", () => {
    expect(() => altitudeForGsdM(MAVIC_3E_WIDE, 0)).toThrow(RangeError);
  });
});

describe("footprintM", () => {
  it("covers GSD × pixel count on each axis", () => {
    const altitude = 100;
    const { widthCm, heightCm } = gsdCmPerPx(MAVIC_3E_WIDE, altitude);
    const fp = footprintM(MAVIC_3E_WIDE, altitude);

    expect(fp.acrossTrackM).toBeCloseTo(
      (widthCm / 100) * MAVIC_3E_WIDE.imageWidthPx,
      6,
    );
    expect(fp.alongTrackM).toBeCloseTo(
      (heightCm / 100) * MAVIC_3E_WIDE.imageHeightPx,
      6,
    );
  });

  it("swaps the axes when the long side runs along the flight line", () => {
    const across = footprintM(MAVIC_3E_WIDE, 100, "wide-across");
    const along = footprintM(MAVIC_3E_WIDE, 100, "wide-along");

    expect(along.acrossTrackM).toBeCloseTo(across.alongTrackM, 6);
    expect(along.alongTrackM).toBeCloseTo(across.acrossTrackM, 6);
  });

  it("gives about 142 × 106 m at 100 m for the Mavic 3E", () => {
    const fp = footprintM(MAVIC_3E_WIDE, 100);
    expect(fp.acrossTrackM).toBeCloseTo(141.7, 0);
    expect(fp.alongTrackM).toBeCloseTo(106.2, 0);
  });
});
