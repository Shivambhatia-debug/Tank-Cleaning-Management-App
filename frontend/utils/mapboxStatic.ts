/**
 * Build Mapbox Static Images API URL for live tracking map.
 * Shows job (red pin), staff (green pins), and dark black lines (distance) between staff and job.
 * Uses EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN from env.
 */

const STYLE = 'mapbox/streets-v12';
const WIDTH = 640;
const HEIGHT = 360;
const DPR = 2;

export type MapPoint = { lat: number; lng: number };

/**
 * Returns Mapbox Static API image URL with markers + distance lines, or null if no token or no points.
 */
export function getMapboxStaticUrl(
  jobPoint: MapPoint | null,
  staffPoints: MapPoint[]
): string | null {
  const token =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
      ? process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
      : null;
  if (!token) return null;

  const points: { lng: number; lat: number; color: string }[] = [];
  if (jobPoint != null) {
    points.push({ lng: jobPoint.lng, lat: jobPoint.lat, color: 'ff0000' });
  }
  staffPoints.forEach((p) => {
    points.push({ lng: p.lng, lat: p.lat, color: '00aa44' });
  });

  if (points.length === 0) return null;

  // Pins only (GeoJSON overlay was causing blank map — distance lines removed for reliable load)
  // pin-s+color(lng,lat) — Mapbox uses lng,lat order
  const pinParts = points.map(
    (p) => `pin-s+${p.color}(${p.lng.toFixed(5)},${p.lat.toFixed(5)})`
  );
  const overlay = pinParts.join(',');

  // Position: auto fits bounds; for single point use center+zoom
  const position =
    points.length > 1
      ? 'auto'
      : `${points[0].lng.toFixed(5)},${points[0].lat.toFixed(5)},14`;
  const size = `${WIDTH}x${HEIGHT}@${DPR}x`;
  const base = `https://api.mapbox.com/styles/v1/${STYLE}/static`;
  const path = `${base}/${encodeURIComponent(overlay)}/${position}/${size}`;
  return `${path}?access_token=${encodeURIComponent(token)}`;
}
