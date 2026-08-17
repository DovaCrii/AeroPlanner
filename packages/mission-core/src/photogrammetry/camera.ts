/**
 * Camera model and ground-sampling calculations.
 *
 * Everything here is pure arithmetic over SI units — no map, no DOM, no
 * manufacturer format. Distances carry their unit in the name, and altitudes
 * are always AGL (above ground level), never AMSL: mixing the two is the
 * classic way to fly an aircraft into a hillside.
 */

/** Physical description of a camera, from its datasheet. */
export interface CameraSpec {
  /** Human-readable name, e.g. "DJI Mavic 3E — wide". */
  label: string;
  /** Sensor width in millimeters (the long side). */
  sensorWidthMm: number;
  /** Sensor height in millimeters (the short side). */
  sensorHeightMm: number;
  /** Image width in pixels (the long side). */
  imageWidthPx: number;
  /** Image height in pixels (the short side). */
  imageHeightPx: number;
  /** True focal length in millimeters — NOT the 35mm-equivalent. */
  focalLengthMm: number;
  /** Shortest time between two shots, in seconds. */
  minShutterIntervalS: number;
  /**
   * A mechanical shutter exposes the whole frame at once. A rolling
   * (electronic) shutter scans the frame line by line, which skews moving
   * subjects and is a poor fit for mapping at speed.
   */
  hasMechanicalShutter: boolean;
}

/**
 * Which image side runs across the flight line.
 *
 * `wide-across` (the usual mapping setup) points the long side perpendicular
 * to the flight path, giving the widest swath and therefore the fewest lines.
 */
export type CameraOrientation = "wide-across" | "wide-along";

/** Ground footprint of a single photo, in meters. */
export interface Footprint {
  /** Extent perpendicular to the flight line — this sets the swath width. */
  acrossTrackM: number;
  /** Extent along the flight line — this sets the shooting interval. */
  alongTrackM: number;
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `${name} must be a positive finite number, got ${value}`,
    );
  }
}

/**
 * Ground sample distance in centimeters per pixel.
 *
 * GSD = (sensor size × altitude) / (focal length × image size). Sensor and
 * focal length are both in millimeters, so those units cancel and the result
 * lands in the same unit as the altitude — meters — which is then converted
 * to centimeters.
 *
 * Width and height are computed separately because a sensor with
 * non-square pixels yields a different GSD on each axis.
 */
export function gsdCmPerPx(
  camera: CameraSpec,
  altitudeAglM: number,
): { widthCm: number; heightCm: number } {
  assertPositive(altitudeAglM, "altitudeAglM");
  assertPositive(camera.focalLengthMm, "focalLengthMm");

  const widthM =
    (camera.sensorWidthMm * altitudeAglM) /
    (camera.focalLengthMm * camera.imageWidthPx);
  const heightM =
    (camera.sensorHeightMm * altitudeAglM) /
    (camera.focalLengthMm * camera.imageHeightPx);

  return { widthCm: widthM * 100, heightCm: heightM * 100 };
}

/**
 * The single GSD figure to show the user and to drive quality checks.
 *
 * Takes the coarser of the two axes: claiming the finer one would promise a
 * resolution the imagery does not deliver in every direction.
 */
export function nominalGsdCm(camera: CameraSpec, altitudeAglM: number): number {
  const { widthCm, heightCm } = gsdCmPerPx(camera, altitudeAglM);
  return Math.max(widthCm, heightCm);
}

/**
 * Flight altitude AGL that achieves a target GSD.
 *
 * The inverse of {@link nominalGsdCm}. Solved on the axis that produces the
 * coarser GSD, so the requested figure is met on both axes rather than only
 * on the favourable one.
 */
export function altitudeForGsdM(
  camera: CameraSpec,
  targetGsdCm: number,
): number {
  assertPositive(targetGsdCm, "targetGsdCm");

  const mmPerPxWidth = camera.sensorWidthMm / camera.imageWidthPx;
  const mmPerPxHeight = camera.sensorHeightMm / camera.imageHeightPx;
  const coarsestPitchMm = Math.max(mmPerPxWidth, mmPerPxHeight);

  return (targetGsdCm / 100) * (camera.focalLengthMm / coarsestPitchMm);
}

/** Ground area covered by one photo at a given altitude. */
export function footprintM(
  camera: CameraSpec,
  altitudeAglM: number,
  orientation: CameraOrientation = "wide-across",
): Footprint {
  const { widthCm, heightCm } = gsdCmPerPx(camera, altitudeAglM);
  const longSideM = (widthCm / 100) * camera.imageWidthPx;
  const shortSideM = (heightCm / 100) * camera.imageHeightPx;

  return orientation === "wide-across"
    ? { acrossTrackM: longSideM, alongTrackM: shortSideM }
    : { acrossTrackM: shortSideM, alongTrackM: longSideM };
}
