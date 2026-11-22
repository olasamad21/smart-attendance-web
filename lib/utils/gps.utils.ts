export interface GpsFix {
  latitude: number;
  longitude: number;
  /** 68% confidence radius in metres, as reported by the device. */
  accuracy: number;
}

/**
 * Location rules — keep in sync with python-backend/services/attendance_service.py.
 *  - Fixes worse than MAX_ACCURACY_M are rejected outright (indoor Wi-Fi guesses).
 *  - Otherwise the reported error is given as tolerance, capped at MAX_TOLERANCE_M,
 *    so a student standing at the edge of the room isn't failed by GPS noise.
 */
export const MAX_ACCURACY_M = 100;
export const MAX_TOLERANCE_M = 50;

function geoError(err: GeolocationPositionError): Error {
  if (err.code === 1) return new Error('Location access denied. Please enable location in browser settings.');
  if (err.code === 3) return new Error('Location request timed out. Move near a window or outside and try again.');
  return new Error('Location unavailable. Please check your device GPS.');
}

/** Single reading (kept for callers that only need a rough position). */
export async function getCurrentPosition(): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(geoError(err)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

/**
 * Watch GPS for up to `maxWaitMs` and return the most accurate fix.
 * The first reading is usually a coarse network estimate; the GPS chip settles over a
 * few seconds. Stops early once a fix is at least `targetAccuracy` metres.
 */
export function getBestPosition(opts: {
  maxWaitMs?: number;
  targetAccuracy?: number;
  onUpdate?: (best: GpsFix) => void;
} = {}): Promise<GpsFix> {
  const { maxWaitMs = 8000, targetAccuracy = 15, onUpdate } = opts;
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    let best: GpsFix | null = null;
    let watchId = -1;
    const finish = () => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(new Error('Could not get your location. Move near a window or outside and try again.'));
    };
    const timer = setTimeout(finish, maxWaitMs);
    watchId = navigator.geolocation.watchPosition(
      pos => {
        const fix = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) {
          best = fix;
          onUpdate?.(fix);
        }
        if (fix.accuracy <= targetAccuracy) finish();
      },
      err => {
        if (err.code === 1 || !best) {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
          reject(geoError(err));
        }
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 },
    );
  });
}

/**
 * Collect readings for `durationMs` and return an accuracy-weighted average position.
 * Used by lecturers to place a classroom pin while standing in the room.
 */
export function averagePosition(opts: {
  durationMs?: number;
  onUpdate?: (current: GpsFix & { samples: number }) => void;
} = {}): Promise<GpsFix & { samples: number }> {
  const { durationMs = 12000, onUpdate } = opts;
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    const fixes: GpsFix[] = [];
    const summarize = () => {
      // Use the better half of the readings, weighted by 1/accuracy².
      const sorted = [...fixes].sort((a, b) => a.accuracy - b.accuracy);
      const used = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
      let w = 0, lat = 0, lng = 0;
      for (const f of used) {
        const wi = 1 / Math.max(f.accuracy, 1) ** 2;
        w += wi; lat += f.latitude * wi; lng += f.longitude * wi;
      }
      const accuracy = used.reduce((s, f) => s + f.accuracy, 0) / used.length;
      return { latitude: lat / w, longitude: lng / w, accuracy, samples: fixes.length };
    };
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        fixes.push({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        onUpdate?.(summarize());
      },
      err => {
        if (err.code === 1) {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
          reject(geoError(err));
        }
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    const timer = setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (fixes.length === 0) reject(new Error('Could not get your location. Try again near a window.'));
      else resolve(summarize());
    }, durationMs);
  });
}

/** Suggested classroom radius from the GPS accuracy observed while placing the pin. */
export function suggestRadius(accuracy: number): number {
  return Math.min(300, Math.max(40, Math.ceil((accuracy * 2 + 20) / 10) * 10));
}

export type ProximityResult =
  | { ok: true; distance: number }
  | { ok: false; distance: number; reason: 'too_far' | 'low_accuracy'; message: string };

export function checkProximity(
  fix: GpsFix, classroom: { lat: number; lng: number; radius: number; name?: string },
): ProximityResult {
  const distance = Math.round(calculateDistance(fix.latitude, fix.longitude, classroom.lat, classroom.lng));
  if (fix.accuracy > MAX_ACCURACY_M) {
    return {
      ok: false, distance, reason: 'low_accuracy',
      message: `Your location is too imprecise (±${Math.round(fix.accuracy)}m). Move near a window or step outside, then try again.`,
    };
  }
  const tolerance = Math.min(fix.accuracy, MAX_TOLERANCE_M);
  if (distance - tolerance > classroom.radius) {
    return {
      ok: false, distance, reason: 'too_far',
      message: `You are about ${distance}m from ${classroom.name || 'the classroom'} (must be within ${classroom.radius}m).`,
    };
  }
  return { ok: true, distance };
}

export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function isWithinRadius(
  studentLat: number, studentLng: number,
  classroomLat: number, classroomLng: number,
  radiusMeters: number
): boolean {
  return calculateDistance(studentLat, studentLng, classroomLat, classroomLng) <= radiusMeters;
}
