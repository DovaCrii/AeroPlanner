/**
 * Corridor missions: parallel lines along an axis.
 *
 * The shape that power lines, roads, canals and mine haul routes actually need,
 * and the one a rectangular grid wastes most flight time on — a grid over a
 * long, thin feature spends most of its battery photographing ground nobody
 * asked for.
 */

import {
  type LatLng,
  bearingDeg,
  bearingDeltaDeg,
  destination,
  polylineLengthM,
} from "../geo/geodesy.js";

export interface CorridorRequest {
  /** Centre line of the corridor, in order. At least two points. */
  axis: readonly LatLng[];
  /** How many parallel lines to fly. */
  lineCount: number;
  /** Distance between adjacent lines, in meters — from the photogrammetry engine. */
  lineSpacingM: number;
  /**
   * Fly consecutive lines in opposite directions (a boustrophedon), so the
   * aircraft does not deadhead back to the start of every line.
   */
  serpentine?: boolean;
}

export interface CorridorPlan {
  /** One entry per line, each already in flight order. */
  lines: LatLng[][];
  /** Offset from the axis for each line, in meters. Negative is left. */
  offsetsM: number[];
  /** Combined length of the lines, in meters. Excludes the turns. */
  lineLengthTotalM: number;
  /** Distance flown turning between lines, in meters. */
  turnaroundLengthTotalM: number;
  /** Full swath covered across the corridor, in meters. */
  corridorWidthM: number;
}

/**
 * Cap on how far a vertex may be pushed out on a tight bend.
 *
 * Offsetting a polyline moves outer corners by `1 / cos(turn / 2)`, which runs
 * away to infinity as the turn approaches a hairpin. Without a limit, a sharp
 * bend in the axis throws a waypoint kilometers off the corridor. Clamping
 * distorts the corner slightly; not clamping produces a mission that cannot be
 * flown.
 */
const MAX_MITRE_FACTOR = 3;

/**
 * Offsets a polyline sideways by a fixed distance.
 *
 * Positive is to the right of travel, negative to the left. Interior vertices
 * move along the bisector of the two adjacent segments, stretched by the mitre
 * factor so the offset line stays truly parallel through the bend rather than
 * pinching in at corners.
 */
export function offsetPolyline(
  points: readonly LatLng[],
  offsetM: number,
): LatLng[] {
  if (points.length < 2) {
    throw new RangeError("A polyline needs at least two points");
  }
  if (offsetM === 0) return points.map((p) => ({ ...p }));

  const side = offsetM > 0 ? 90 : -90;
  const magnitude = Math.abs(offsetM);
  const result: LatLng[] = [];

  for (let i = 0; i < points.length; i++) {
    const isFirst = i === 0;
    const isLast = i === points.length - 1;

    if (isFirst || isLast) {
      // End caps: square off, perpendicular to the only adjacent segment.
      const [from, to] = isFirst
        ? [points[0], points[1]]
        : [points[points.length - 2], points[points.length - 1]];
      const brg = bearingDeg(from, to);
      result.push(destination(points[i], magnitude, brg + side));
      continue;
    }

    const brgIn = bearingDeg(points[i - 1], points[i]);
    const brgOut = bearingDeg(points[i], points[i + 1]);
    const turn = bearingDeltaDeg(brgIn, brgOut);

    const halfTurnRad = (turn / 2) * (Math.PI / 180);
    const cosHalf = Math.cos(halfTurnRad);
    const mitre =
      Math.abs(cosHalf) < 1e-9
        ? MAX_MITRE_FACTOR
        : Math.min(MAX_MITRE_FACTOR, 1 / Math.abs(cosHalf));

    result.push(
      destination(points[i], magnitude * mitre, brgIn + turn / 2 + side),
    );
  }

  return result;
}

/**
 * Builds the parallel lines of a corridor, centred on its axis.
 *
 * Offsets are symmetric about the axis: an odd count puts one line straight
 * down the middle, an even count straddles it. Either way the corridor is
 * centred on the feature being surveyed, which is what the operator drew.
 */
export function planCorridor(request: CorridorRequest): CorridorPlan {
  const { axis, lineCount, lineSpacingM, serpentine = true } = request;

  if (axis.length < 2) {
    throw new RangeError("A corridor axis needs at least two points");
  }
  if (!Number.isInteger(lineCount) || lineCount < 1) {
    throw new RangeError(
      `lineCount must be a positive integer, got ${lineCount}`,
    );
  }
  if (!Number.isFinite(lineSpacingM) || lineSpacingM <= 0) {
    throw new RangeError(
      `lineSpacingM must be a positive number, got ${lineSpacingM}`,
    );
  }

  const offsetsM = Array.from(
    { length: lineCount },
    (_, i) => (i - (lineCount - 1) / 2) * lineSpacingM,
  );

  const lines = offsetsM.map((offset, i) => {
    const line = offsetPolyline(axis, offset);
    // Every other line runs backwards so the aircraft ends each pass next to
    // the start of the following one.
    return serpentine && i % 2 === 1 ? line.reverse() : line;
  });

  const lineLengthTotalM = lines.reduce(
    (sum, line) => sum + polylineLengthM(line),
    0,
  );

  // The turn is the hop from the end of one line to the start of the next.
  let turnaroundLengthTotalM = 0;
  for (let i = 1; i < lines.length; i++) {
    const previousEnd = lines[i - 1][lines[i - 1].length - 1];
    const nextStart = lines[i][0];
    turnaroundLengthTotalM += polylineLengthM([previousEnd, nextStart]);
  }

  return {
    lines,
    offsetsM,
    lineLengthTotalM,
    turnaroundLengthTotalM,
    corridorWidthM: lineCount > 1 ? (lineCount - 1) * lineSpacingM : 0,
  };
}
