/**
 * Live map using Mapbox Maps SDK for Mobile.
 * Shows road-following route (Directions API) between staff and job.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

let MapboxMaps: typeof import('@rnmapbox/maps') | null = null;
try {
  MapboxMaps = require('@rnmapbox/maps/lib/module/index.native.js');
} catch {
  // Native module not available (Expo Go or not linked)
}

const Mapbox = MapboxMaps?.default;
const MapView = MapboxMaps?.MapView;
const Camera = MapboxMaps?.Camera;
const PointAnnotation = MapboxMaps?.PointAnnotation;
const ShapeSource = MapboxMaps?.ShapeSource;
const LineLayer = MapboxMaps?.LineLayer;

export type MapPoint = { lat: number; lng: number };

type GeoPosition = [number, number] | [number, number, number];
type LineStringFeature = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: GeoPosition[] };
  properties: Record<string, unknown>;
};
type FeatureCollection = { type: 'FeatureCollection'; features: LineStringFeature[] };

const MAPBOX_TOKEN =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
    ? process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
    : '';

/** Fetch driving route (road-following) from Mapbox Directions API */
async function fetchRoute(
  from: MapPoint,
  to: MapPoint,
  token: string
): Promise<GeoPosition[] | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${encodeURIComponent(coords)}?geometries=geojson&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const coordsList = data?.routes?.[0]?.geometry?.coordinates;
    return Array.isArray(coordsList) && coordsList.length > 0 ? coordsList : null;
  } catch {
    return null;
  }
}

function getBounds(points: MapPoint[], padding = 0.005) {
  if (points.length === 0) return null;
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const minLng = Math.min(...lngs) - padding;
  const maxLng = Math.max(...lngs) + padding;
  const minLat = Math.min(...lats) - padding;
  const maxLat = Math.max(...lats) + padding;
  return { ne: [maxLng, maxLat] as [number, number], sw: [minLng, minLat] as [number, number] };
}

type Props = {
  jobPoint: MapPoint | null;
  staffPoints: MapPoint[];
  width: number;
  height: number;
};

export default function MapboxLiveMapView({ jobPoint, staffPoints, width, height }: Props) {
  const [routeGeoJson, setRouteGeoJson] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    if (Mapbox && MAPBOX_TOKEN) Mapbox.setAccessToken(MAPBOX_TOKEN);
  }, []);

  const routeKey = useMemo(
    () => (jobPoint ? `${jobPoint.lat},${jobPoint.lng}|${staffPoints.map((p) => `${p.lat},${p.lng}`).join(';')}` : ''),
    [jobPoint, staffPoints]
  );

  // Fetch road-following route for each staff -> job
  useEffect(() => {
    if (!MAPBOX_TOKEN || !jobPoint || staffPoints.length === 0 || !routeKey) {
      setRouteGeoJson(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const features: LineStringFeature[] = [];
      for (const staff of staffPoints) {
        const coords = await fetchRoute(staff, jobPoint, MAPBOX_TOKEN);
        if (cancelled) return;
        if (coords && coords.length >= 2) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {},
          });
        }
      }
      if (!cancelled) setRouteGeoJson(features.length > 0 ? { type: 'FeatureCollection', features } : null);
    })();
    return () => { cancelled = true; };
  }, [MAPBOX_TOKEN, routeKey, jobPoint, staffPoints]);

  if (!MapboxMaps || !MapView || !Camera || !PointAnnotation || !ShapeSource || !LineLayer) {
    return (
      <View style={[styles.wrap, styles.fallback, { width, height }]}>
        <Text style={styles.fallbackText}>Use dev build for live map (expo run:android)</Text>
      </View>
    );
  }

  const allPoints = useMemo(() => {
    const pts: MapPoint[] = [];
    if (jobPoint) pts.push(jobPoint);
    pts.push(...staffPoints);
    return pts;
  }, [jobPoint, staffPoints]);

  const bounds = useMemo(() => getBounds(allPoints), [allPoints]);
  // Use road route if fetched, else fallback to straight line
  const lineFeatures = useMemo(() => {
    if (routeGeoJson && routeGeoJson.features.length > 0) return routeGeoJson;
    if (!jobPoint || staffPoints.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: staffPoints.map((staff) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [staff.lng, staff.lat],
            [jobPoint.lng, jobPoint.lat],
          ],
        },
      })),
    };
  }, [jobPoint, staffPoints, routeGeoJson]);

  if (!MAPBOX_TOKEN || allPoints.length === 0) return null;

  const cameraSettings = useMemo(() => {
    if (bounds && allPoints.length > 1) {
      return {
        bounds: {
          ne: bounds.ne,
          sw: bounds.sw,
          paddingTop: 40,
          paddingBottom: 40,
          paddingLeft: 40,
          paddingRight: 40,
        },
      };
    }
    const center = jobPoint || staffPoints[0];
    return {
      centerCoordinate: [center.lng, center.lat] as [number, number],
      zoomLevel: 14,
    };
  }, [bounds, allPoints.length, jobPoint, staffPoints]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <MapView style={styles.map}>
        <Camera defaultSettings={cameraSettings} />
        {lineFeatures && (
          <ShapeSource id="distance-lines" shape={lineFeatures}>
            <LineLayer
              id="distance-line-layer"
              style={{ lineColor: '#1a1a1a', lineWidth: 4 }}
            />
          </ShapeSource>
        )}
        {jobPoint && (
          <PointAnnotation
            id="job"
            coordinate={[jobPoint.lng, jobPoint.lat]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={[styles.marker, styles.markerJob]} />
          </PointAnnotation>
        )}
        {staffPoints.map((p, i) => (
          <PointAnnotation
            key={`staff-${i}`}
            id={`staff-${i}`}
            coordinate={[p.lng, p.lat]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={[styles.marker, styles.markerStaff]} />
          </PointAnnotation>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 12 },
  map: { flex: 1 },
  fallback: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerJob: { backgroundColor: '#e53935' },
  markerStaff: { backgroundColor: '#00aa44' },
});
