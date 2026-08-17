/**
 * AeroPlanner mission core — the domain layer.
 *
 * Nothing here imports React, a map library, the DOM or a manufacturer's file
 * format. That is the whole point: these calculations decide how an aircraft
 * flies, so they must be testable in plain Node against an external oracle,
 * not by squinting at a screen.
 */

export type {
  CameraSpec,
  CameraOrientation,
  Footprint,
} from "./photogrammetry/camera.js";
export {
  gsdCmPerPx,
  nominalGsdCm,
  altitudeForGsdM,
  footprintM,
} from "./photogrammetry/camera.js";

export type {
  CoverageRequest,
  CoveragePlan,
} from "./photogrammetry/coverage.js";
export {
  planCoverage,
  lineSpacingForOverlapM,
  overlapForLineSpacing,
} from "./photogrammetry/coverage.js";

export type { AircraftSpec } from "./catalog/aircraft.js";
export {
  MAVIC_3E,
  MAVIC_3E_WIDE,
  AIRCRAFT_CATALOG,
  findAircraft,
} from "./catalog/aircraft.js";

export type {
  EndurancePolicy,
  FlightLeg,
  BatteryPlan,
} from "./mission/battery.js";
export { planBatteries } from "./mission/battery.js";

export type {
  SurveyGeometry,
  MissionStats,
  DurationModel,
} from "./mission/statistics.js";
export {
  estimatePhotoCount,
  estimateMissionStats,
} from "./mission/statistics.js";
