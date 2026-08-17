/**
 * Mission statistics: distance, duration, photo count.
 *
 * Pure arithmetic over a geometry that is handed in already measured. This
 * module deliberately knows nothing about polygons or map projections — the
 * caller measures the route, this works out what flying it costs.
 */

export interface SurveyGeometry {
  /** Combined length of all survey lines, in meters. */
  lineLengthTotalM: number;
  /** Number of parallel lines. */
  lineCount: number;
  /** Distance flown turning between lines, in meters. */
  turnaroundLengthTotalM: number;
  /** Transit from takeoff to the first line and back, in meters. */
  approachLengthM?: number;
}

export interface MissionStats {
  /** Total distance flown, in meters. */
  distanceM: number;
  /** Total flight time, in seconds. */
  durationS: number;
  /** Photos triggered along the survey lines. */
  photoCount: number;
}

export interface DurationModel {
  /** Cruise speed along the survey lines, in m/s. */
  speedMs: number;
  /**
   * Seconds lost at each turn, on top of the distance flown. Covers
   * deceleration, the turn itself and getting back up to speed.
   */
  turnPenaltyS?: number;
}

/**
 * Photos taken along the survey lines.
 *
 * Each line yields one shot at its start plus one every `photoSpacingM`, hence
 * the `+ 1` per line: a 100 m line at 20 m spacing gives six photos, not five.
 * Turnarounds are excluded — the camera does not fire outside the lines.
 */
export function estimatePhotoCount(
  geometry: SurveyGeometry,
  photoSpacingM: number,
): number {
  if (!Number.isFinite(photoSpacingM) || photoSpacingM <= 0) {
    throw new RangeError(
      `photoSpacingM must be a positive number, got ${photoSpacingM}`,
    );
  }
  if (geometry.lineCount <= 0) return 0;

  const lengthPerLineM = geometry.lineLengthTotalM / geometry.lineCount;
  const perLine = Math.floor(lengthPerLineM / photoSpacingM) + 1;
  return perLine * geometry.lineCount;
}

/** Total distance, duration and photo count for a survey. */
export function estimateMissionStats(
  geometry: SurveyGeometry,
  photoSpacingM: number,
  model: DurationModel,
): MissionStats {
  const { speedMs, turnPenaltyS = 0 } = model;
  if (!Number.isFinite(speedMs) || speedMs <= 0) {
    throw new RangeError(`speedMs must be a positive number, got ${speedMs}`);
  }

  const distanceM =
    geometry.lineLengthTotalM +
    geometry.turnaroundLengthTotalM +
    (geometry.approachLengthM ?? 0);

  // One turn fewer than lines: the last line is not followed by a turn.
  const turnCount = Math.max(0, geometry.lineCount - 1);

  return {
    distanceM,
    durationS: distanceM / speedMs + turnCount * turnPenaltyS,
    photoCount: estimatePhotoCount(geometry, photoSpacingM),
  };
}
