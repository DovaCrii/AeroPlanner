/**
 * Aircraft and camera catalogue.
 *
 * These are physical figures used to compute a mission — sensor size, focal
 * length, endurance. They are NOT the numeric codes DJI writes into a KMZ:
 * those live in the export layer and mean nothing to the domain.
 *
 * Every entry cites its source. An invented figure here silently corrupts
 * every altitude and every photo count downstream, so a spec that cannot be
 * cited does not get added.
 */

import type { CameraSpec } from "../photogrammetry/camera.js";

export interface AircraftSpec {
  /** Stable identifier used to reference this model. */
  id: string;
  label: string;
  cameras: CameraSpec[];
  /** Manufacturer's maximum horizontal speed, in m/s. */
  maxSpeedMs: number;
  /**
   * Manufacturer's hover endurance, in minutes, in ideal conditions.
   *
   * This is a laboratory figure and must NOT be used directly to decide
   * whether a mission fits. Real endurance depends on wind, temperature,
   * payload and battery age. The operational value and its reserve are a
   * policy decision for the operation — see `HANDOFF.md`.
   */
  nominalEnduranceMin: number;
}

/**
 * DJI Mavic 3 Enterprise, wide (mapping) camera.
 *
 * Source: DJI Enterprise specifications — 4/3 CMOS, 20 MP effective,
 * 5280×3956 max image size, 3.3 µm pixels, 24 mm equivalent focal length,
 * mechanical shutter, 0.7 s minimum interval.
 *
 * Sensor dimensions are derived from the pixel pitch rather than the rounded
 * "4/3" label: 5280 × 3.3 µm = 17.42 mm and 3956 × 3.3 µm = 13.05 mm. Deriving
 * them keeps pitch, resolution and sensor size mutually consistent, which is
 * what the GSD formula actually depends on.
 *
 * The focal length is the true 12.29 mm reported in the image EXIF, not the
 * 24 mm 35mm-equivalent — using the equivalent would roughly halve every GSD.
 */
export const MAVIC_3E_WIDE: CameraSpec = {
  label: "DJI Mavic 3E — wide",
  sensorWidthMm: 17.42,
  sensorHeightMm: 13.05,
  imageWidthPx: 5280,
  imageHeightPx: 3956,
  focalLengthMm: 12.29,
  minShutterIntervalS: 0.7,
  hasMechanicalShutter: true,
};

export const MAVIC_3E: AircraftSpec = {
  id: "dji-mavic-3e",
  label: "DJI Mavic 3E",
  cameras: [MAVIC_3E_WIDE],
  maxSpeedMs: 21,
  nominalEnduranceMin: 45,
};

export const AIRCRAFT_CATALOG: AircraftSpec[] = [MAVIC_3E];

export function findAircraft(id: string): AircraftSpec | undefined {
  return AIRCRAFT_CATALOG.find((a) => a.id === id);
}
