/**
 * Terrain following: keeping a constant height above the ground.
 *
 * On flat ground a fixed altitude is fine. On a slope it is not: fly a
 * constant 80 m over a hill that rises 60 m and the aircraft arrives at 20 m
 * above the ridge, with a GSD that no longer matches what was planned — or
 * worse, into the ridge itself.
 *
 * The domain does not know where elevation comes from. It asks an
 * {@link ElevationSource}, which the interface layer backs with the map's DEM,
 * a GeoTIFF, or a stub in tests.
 */

import {
  type LatLng,
  distanceM,
  destination,
  bearingDeg,
} from "../geo/geodesy.js";

/**
 * Anything that can answer "how high is the ground here?".
 *
 * Returns meters above mean sea level, or `null` where it has no data — the
 * edge of a loaded DEM, an unfetched tile. Callers must handle the gap rather
 * than assume sea level, which would silently plan a flight into a mountain.
 */
export interface ElevationSource {
  elevationM(point: LatLng): number | null;
}

export interface TerrainFollowRequest {
  /** Route to adjust, in flight order. */
  path: readonly LatLng[];
  source: ElevationSource;
  /** Height to hold above the ground, in meters. */
  targetAglM: number;
  /**
   * Elevation of the takeoff point, in meters AMSL. Aircraft altitudes are
   * commanded relative to takeoff, so this is what converts an absolute
   * terrain height into the number the aircraft understands.
   */
  takeoffElevationM: number;
}

export interface TerrainFollowPoint {
  position: LatLng;
  /** Ground elevation under this point, in meters AMSL. */
  groundElevationM: number | null;
  /** Commanded altitude relative to takeoff, in meters. */
  altitudeRelativeM: number | null;
  /** Height above the ground directly below, in meters. */
  aglM: number;
}

export interface TerrainFollowResult {
  points: TerrainFollowPoint[];
  /** Points the source could not answer for. */
  gapCount: number;
}

/**
 * Recomputes each waypoint's altitude so the aircraft holds `targetAglM`.
 *
 * Where the source has no data the altitude is left `null` rather than guessed:
 * a fabricated elevation is indistinguishable from a real one downstream, and
 * the whole point of this module is not to fly into terrain.
 */
export function followTerrain(
  request: TerrainFollowRequest,
): TerrainFollowResult {
  const { path, source, targetAglM, takeoffElevationM } = request;

  if (!Number.isFinite(targetAglM) || targetAglM <= 0) {
    throw new RangeError(
      `targetAglM must be a positive number, got ${targetAglM}`,
    );
  }

  let gapCount = 0;
  const points = path.map((position) => {
    const groundElevationM = source.elevationM(position);
    if (groundElevationM === null) {
      gapCount++;
      return {
        position,
        groundElevationM: null,
        altitudeRelativeM: null,
        aglM: targetAglM,
      };
    }
    return {
      position,
      groundElevationM,
      altitudeRelativeM: groundElevationM + targetAglM - takeoffElevationM,
      aglM: targetAglM,
    };
  });

  return { points, gapCount };
}

export interface ProfileSample {
  /** Distance along the route from its start, in meters. */
  distanceAlongM: number;
  position: LatLng;
  groundElevationM: number | null;
}

/**
 * Samples ground elevation at a fixed interval along a route.
 *
 * Waypoints alone are not enough for a clearance check: a route can clear both
 * ends of a segment and still cut through the hill between them. Sampling
 * catches what the endpoints hide.
 */
export function terrainProfile(
  path: readonly LatLng[],
  source: ElevationSource,
  sampleSpacingM: number,
): ProfileSample[] {
  if (path.length < 2) {
    throw new RangeError("A profile needs at least two points");
  }
  if (!Number.isFinite(sampleSpacingM) || sampleSpacingM <= 0) {
    throw new RangeError(
      `sampleSpacingM must be a positive number, got ${sampleSpacingM}`,
    );
  }

  const samples: ProfileSample[] = [];
  let distanceAlongM = 0;
  let carryM = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const segmentM = distanceM(from, to);
    if (segmentM === 0) continue;
    const heading = bearingDeg(from, to);

    if (i === 0) {
      samples.push({
        distanceAlongM: 0,
        position: from,
        groundElevationM: source.elevationM(from),
      });
      carryM = sampleSpacingM;
    }

    let travelledM = 0;
    while (travelledM + carryM <= segmentM) {
      travelledM += carryM;
      const position = destination(from, travelledM, heading);
      samples.push({
        distanceAlongM: distanceAlongM + travelledM,
        position,
        groundElevationM: source.elevationM(position),
      });
      carryM = sampleSpacingM;
    }
    carryM -= segmentM - travelledM;
    distanceAlongM += segmentM;
  }

  const last = path[path.length - 1];
  samples.push({
    distanceAlongM,
    position: last,
    groundElevationM: source.elevationM(last),
  });

  return samples;
}

export interface ClearanceReport {
  /** Smallest height above ground found, in meters. `null` if unknown. */
  minimumAglM: number | null;
  /** Where that minimum occurs. */
  atDistanceAlongM: number | null;
  /** Samples the source could not answer for. */
  gapCount: number;
  /** True when the minimum drops below the requested floor. */
  violatesMinimum: boolean;
}

/**
 * Finds the tightest clearance along a route flown at a constant altitude.
 *
 * This is the check that matters when terrain following is **off**: a fixed
 * altitude over rising ground is exactly how aircraft meet hillsides.
 */
export function clearanceAlongRoute(
  path: readonly LatLng[],
  source: ElevationSource,
  flightAltitudeAmslM: number,
  sampleSpacingM: number,
  minimumAglM: number,
): ClearanceReport {
  const samples = terrainProfile(path, source, sampleSpacingM);

  let tightest: number | null = null;
  let atDistanceAlongM: number | null = null;
  let gapCount = 0;

  for (const sample of samples) {
    if (sample.groundElevationM === null) {
      gapCount++;
      continue;
    }
    const agl = flightAltitudeAmslM - sample.groundElevationM;
    if (tightest === null || agl < tightest) {
      tightest = agl;
      atDistanceAlongM = sample.distanceAlongM;
    }
  }

  return {
    minimumAglM: tightest,
    atDistanceAlongM,
    gapCount,
    violatesMinimum: tightest !== null && tightest < minimumAglM,
  };
}

/**
 * Climb rate a route demands, in m/s, given the ground speed flown.
 *
 * Terrain following on a steep slope can ask for a climb the aircraft cannot
 * deliver: it then lags behind the terrain and the real clearance is lower than
 * planned. Comparing this against the aircraft's rated climb rate turns that
 * surprise into a warning.
 */
export function requiredClimbRateMs(
  points: readonly TerrainFollowPoint[],
  groundSpeedMs: number,
): number {
  if (!Number.isFinite(groundSpeedMs) || groundSpeedMs <= 0) {
    throw new RangeError(
      `groundSpeedMs must be a positive number, got ${groundSpeedMs}`,
    );
  }

  let worst = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (
      previous.altitudeRelativeM === null ||
      current.altitudeRelativeM === null
    ) {
      continue;
    }
    const horizontalM = distanceM(previous.position, current.position);
    if (horizontalM === 0) continue;

    const climbM = current.altitudeRelativeM - previous.altitudeRelativeM;
    const rate = (climbM / horizontalM) * groundSpeedMs;
    if (Math.abs(rate) > Math.abs(worst)) worst = rate;
  }

  return worst;
}
