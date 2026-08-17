/**
 * Turns corridor lines into flyable waypoints.
 *
 * Still manufacturer-agnostic: this produces positions, headings and gimbal
 * angles, and knows nothing about how DJI encodes them. The export layer
 * translates.
 */

import {
  type LatLng,
  bearingDeg,
  destination,
  distanceM,
} from "../geo/geodesy.js";

/** Where the camera points relative to the flight line. */
export type CameraAim =
  /** Straight down — the standard for mapping. */
  | "nadir"
  /** Sideways at the corridor, for photographing a face: a pylon, a cut slope. */
  | "side";

export interface CorridorWaypointRequest {
  /** One corridor line, in flight order. */
  line: readonly LatLng[];
  /** Height above ground, in meters. */
  altitudeAglM: number;
  /**
   * Distance between shots along the line, in meters. Comes from the front
   * overlap via the photogrammetry engine.
   */
  photoSpacingM: number;
  aim?: CameraAim;
  /**
   * Gimbal pitch in degrees for `side` aiming: 0 is the horizon, negative
   * looks down. Ignored when aiming nadir.
   */
  sidePitchDeg?: number;
  /** Which side `side` aiming looks at: right of travel, or left. */
  sideLooksRight?: boolean;
}

export interface CorridorWaypoint {
  position: LatLng;
  /** Height above ground, in meters. */
  altitudeAglM: number;
  /** Aircraft heading in degrees clockwise from north. */
  headingDeg: number;
  /** Gimbal pitch in degrees: -90 is straight down, 0 is the horizon. */
  gimbalPitchDeg: number;
  /** Whether the camera fires here. */
  takePhoto: boolean;
}

const NADIR_PITCH_DEG = -90;

/**
 * Places waypoints along a line at a fixed ground spacing.
 *
 * Walks the polyline by arc length rather than dropping a waypoint per vertex:
 * a corridor axis may have vertices every few meters in a bend and none for a
 * kilometer on a straight, and the camera has to fire at an even spacing
 * regardless of how the operator happened to draw it.
 *
 * The last vertex always gets a waypoint, even if it falls short of a full
 * spacing, so the line is flown to its end instead of stopping early.
 */
export function waypointsAlongLine(
  request: CorridorWaypointRequest,
): CorridorWaypoint[] {
  const {
    line,
    altitudeAglM,
    photoSpacingM,
    aim = "nadir",
    sidePitchDeg = -45,
    sideLooksRight = true,
  } = request;

  if (line.length < 2) {
    throw new RangeError("A corridor line needs at least two points");
  }
  if (!Number.isFinite(photoSpacingM) || photoSpacingM <= 0) {
    throw new RangeError(
      `photoSpacingM must be a positive number, got ${photoSpacingM}`,
    );
  }

  const pitch = aim === "nadir" ? NADIR_PITCH_DEG : sidePitchDeg;
  const out: CorridorWaypoint[] = [];

  const push = (position: LatLng, headingDeg: number): void => {
    // With side aiming the airframe still flies along the line; it is the
    // gimbal that turns, so the yaw offset goes on the heading the camera
    // needs, not on the course.
    const cameraHeading =
      aim === "side"
        ? (headingDeg + (sideLooksRight ? 90 : -90) + 360) % 360
        : headingDeg;
    out.push({
      position,
      altitudeAglM,
      headingDeg: cameraHeading,
      gimbalPitchDeg: pitch,
      takePhoto: true,
    });
  };

  // Distance still to travel before the next shot.
  let remainingM = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const from = line[i];
    const to = line[i + 1];
    const segmentM = distanceM(from, to);
    if (segmentM === 0) continue;
    const heading = bearingDeg(from, to);

    if (i === 0) {
      push(from, heading);
      remainingM = photoSpacingM;
    }

    let travelledM = 0;
    while (travelledM + remainingM <= segmentM) {
      travelledM += remainingM;
      push(destination(from, travelledM, heading), heading);
      remainingM = photoSpacingM;
    }
    remainingM -= segmentM - travelledM;
  }

  // Always finish the line, even if the last shot falls short of a spacing.
  const last = line[line.length - 1];
  const lastPlaced = out[out.length - 1]?.position;
  if (!lastPlaced || distanceM(lastPlaced, last) > 1) {
    const tailHeading = bearingDeg(line[line.length - 2], last);
    push(last, tailHeading);
  }

  return out;
}

/** Runs {@link waypointsAlongLine} over every line of a corridor, in order. */
export function waypointsForCorridor(
  lines: readonly (readonly LatLng[])[],
  options: Omit<CorridorWaypointRequest, "line">,
): CorridorWaypoint[] {
  return lines.flatMap((line) => waypointsAlongLine({ ...options, line }));
}
