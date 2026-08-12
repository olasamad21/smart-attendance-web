export async function getCurrentPosition(): Promise<{latitude: number, longitude: number}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject(new Error('Location access denied. Please enable location in browser settings.'));
        else if (err.code === 3) reject(new Error('Location request timed out. Please try again.'));
        else reject(new Error('Location unavailable. Please check your device GPS.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
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
