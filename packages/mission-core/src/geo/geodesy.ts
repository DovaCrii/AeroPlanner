/**
 * Spherical geodesy helpers.
 *
 * A sphere, not an ellipsoid: over the few kilometers a single mission spans,
 * the difference is centimeters — well under the GSD of any survey — and the
 * arithmetic stays legible. If millimetric accuracy is ever needed, this is the
 * module to replace, and nothing else has to change.
 */

/** A point on the ground. Latitude first, matching the rest of the codebase. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Mean Earth radius in meters (IUGG). */
const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Great-circle distance between two points, in meters. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, in degrees clockwise from north. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** The point reached by travelling `distM` from `origin` on `bearing`. */
export function destination(
  origin: LatLng,
  distM: number,
  bearing: number,
): LatLng {
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const brg = toRad(bearing);
  const delta = distM / EARTH_RADIUS_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) +
      Math.cos(lat1) * Math.sin(delta) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );

  // Normalise longitude to [-180, 180] so a path crossing the antimeridian
  // does not produce coordinates a consumer will reject.
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

/** Signed smallest difference between two bearings, in degrees (-180, 180]. */
export function bearingDeltaDeg(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Total length of a polyline, in meters. */
export function polylineLengthM(points: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceM(points[i - 1], points[i]);
  }
  return total;
}
