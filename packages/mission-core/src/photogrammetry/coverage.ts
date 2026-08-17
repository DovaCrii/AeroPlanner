/**
 * Turns photogrammetric intent (GSD, overlap) into flight parameters
 * (line spacing, shooting interval, speed).
 *
 * The chain is always the same: altitude fixes the footprint, overlap carves
 * the spacing out of that footprint, and speed falls out of how fast the
 * camera can shoot. Reversing any link produces a mission that looks fine on
 * screen and comes back with gaps.
 */

import {
  type CameraSpec,
  type CameraOrientation,
  footprintM,
  nominalGsdCm,
} from "./camera.js";

/** What the operator asks for. */
export interface CoverageRequest {
  camera: CameraSpec;
  /** Height above ground, in meters. */
  altitudeAglM: number;
  /** Overlap along the flight line, as a fraction: 0.8 means 80 %. */
  frontOverlap: number;
  /** Overlap between adjacent lines, as a fraction. */
  sideOverlap: number;
  orientation?: CameraOrientation;
  /**
   * Blur budget in pixels. Imagery is considered sharp while forward motion
   * during the exposure stays under this many pixels on the ground. One pixel
   * is the usual survey convention.
   */
  maxMotionBlurPx?: number;
  /** Exposure time in seconds, e.g. 1/1000 s → 0.001. */
  shutterSpeedS?: number;
  /** Ceiling imposed by the aircraft, in m/s. */
  maxAircraftSpeedMs?: number;
}

/** What the mission needs in order to fly. */
export interface CoveragePlan {
  gsdCm: number;
  /** Photo footprint on the ground. */
  swathWidthM: number;
  footprintAlongTrackM: number;
  /** Distance between adjacent flight lines. */
  lineSpacingM: number;
  /** Distance between consecutive shots along a line. */
  photoSpacingM: number;
  /** Fastest speed that satisfies every constraint, in m/s. */
  recommendedSpeedMs: number;
  /** Time between shots at the recommended speed, in seconds. */
  shutterIntervalS: number;
  /** Which constraint ended up capping the speed. */
  speedLimitedBy: "motion-blur" | "shutter-interval" | "aircraft";
}

const MAX_OVERLAP = 0.95;

function assertOverlap(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > MAX_OVERLAP) {
    throw new RangeError(
      `${name} must be a fraction between 0 and ${MAX_OVERLAP}, got ${value}`,
    );
  }
}

/**
 * Derives every flight parameter from the requested coverage.
 *
 * Speed is capped by whichever constraint bites first:
 *
 * - **Motion blur** — the ground moves under the camera during the exposure.
 *   Keeping that smear within the blur budget bounds speed at
 *   `blurPx × GSD / exposure`.
 * - **Shutter interval** — the camera cannot shoot faster than its minimum
 *   interval, so covering `photoSpacing` must take at least that long.
 * - **The aircraft** — its own maximum speed.
 */
export function planCoverage(request: CoverageRequest): CoveragePlan {
  const {
    camera,
    altitudeAglM,
    frontOverlap,
    sideOverlap,
    orientation = "wide-across",
    maxMotionBlurPx = 1,
    shutterSpeedS,
    maxAircraftSpeedMs,
  } = request;

  assertOverlap(frontOverlap, "frontOverlap");
  assertOverlap(sideOverlap, "sideOverlap");

  const gsdCm = nominalGsdCm(camera, altitudeAglM);
  const footprint = footprintM(camera, altitudeAglM, orientation);

  const lineSpacingM = footprint.acrossTrackM * (1 - sideOverlap);
  const photoSpacingM = footprint.alongTrackM * (1 - frontOverlap);

  // Every candidate ceiling, in m/s. The lowest one wins.
  const candidates: Array<{
    speedMs: number;
    cause: CoveragePlan["speedLimitedBy"];
  }> = [
    {
      speedMs: photoSpacingM / camera.minShutterIntervalS,
      cause: "shutter-interval",
    },
  ];

  if (shutterSpeedS !== undefined && shutterSpeedS > 0) {
    candidates.push({
      speedMs: (maxMotionBlurPx * (gsdCm / 100)) / shutterSpeedS,
      cause: "motion-blur",
    });
  }

  if (maxAircraftSpeedMs !== undefined && maxAircraftSpeedMs > 0) {
    candidates.push({ speedMs: maxAircraftSpeedMs, cause: "aircraft" });
  }

  const limiting = candidates.reduce((lowest, candidate) =>
    candidate.speedMs < lowest.speedMs ? candidate : lowest,
  );

  return {
    gsdCm,
    swathWidthM: footprint.acrossTrackM,
    footprintAlongTrackM: footprint.alongTrackM,
    lineSpacingM,
    photoSpacingM,
    recommendedSpeedMs: limiting.speedMs,
    shutterIntervalS: photoSpacingM / limiting.speedMs,
    speedLimitedBy: limiting.cause,
  };
}

/**
 * Line spacing for a target overlap — the value that replaces the manual
 * `spacingM` inherited from the original grid tool.
 */
export function lineSpacingForOverlapM(
  camera: CameraSpec,
  altitudeAglM: number,
  sideOverlap: number,
  orientation: CameraOrientation = "wide-across",
): number {
  assertOverlap(sideOverlap, "sideOverlap");
  return (
    footprintM(camera, altitudeAglM, orientation).acrossTrackM *
    (1 - sideOverlap)
  );
}

/**
 * The inverse: what overlap does a given line spacing actually produce?
 *
 * Needed to report honestly on a mission whose spacing was set by hand — and
 * to warn when that spacing leaves no overlap at all.
 */
export function overlapForLineSpacing(
  camera: CameraSpec,
  altitudeAglM: number,
  lineSpacingM: number,
  orientation: CameraOrientation = "wide-across",
): number {
  const swathM = footprintM(camera, altitudeAglM, orientation).acrossTrackM;
  return 1 - lineSpacingM / swathM;
}
