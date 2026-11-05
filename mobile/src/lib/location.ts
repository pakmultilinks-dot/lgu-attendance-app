import * as Location from 'expo-location';
import type { OfficeSettings } from './supabase';

// Haversine formula: great circle distance between two GPS points, in metres.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export type LocationCheck = {
  ok: boolean;
  distanceMeters: number;
  lat: number;
  lng: number;
  mocked: boolean;
  message: string;
};

// Asks for location permission, reads one accurate fix, and checks the
// distance to the office pin. Returns a refusal with the distance shown
// instead of throwing, so the screen can show a clear message.
export async function checkOfficeLocation(settings: OfficeSettings): Promise<LocationCheck> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    return {
      ok: false, distanceMeters: -1, lat: 0, lng: 0, mocked: false,
      message: 'Location permission is required. Allow location for this app and try again.',
    };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const mocked = position.mocked === true;
  if (mocked) {
    return {
      ok: false,
      distanceMeters: -1,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      mocked: true,
      message: 'Mock location detected. Turn off any fake GPS app and try again.',
    };
  }

  const distance = haversineMeters(
    position.coords.latitude,
    position.coords.longitude,
    settings.office_lat,
    settings.office_lng,
  );

  if (distance > settings.radius_meters) {
    return {
      ok: false,
      distanceMeters: Math.round(distance),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      mocked: false,
      message: `You are ${Math.round(distance)} metres from the office. Check in works only within ${settings.radius_meters} metres.`,
    };
  }

  return {
    ok: true,
    distanceMeters: Math.round(distance),
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    mocked: false,
    message: `Inside office radius (${Math.round(distance)} m from office).`,
  };
}
