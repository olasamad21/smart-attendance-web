const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function enrollFace(userId: string, base64Image: string): Promise<{success: boolean, message?: string, error?: string}> {
  try {
    const response = await fetch(`${API_URL}/api/face/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, image: base64Image }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.detail || 'Enrollment failed' };
    }
    return await response.json();
  } catch (error: any) {
    return { success: false, error: 'Network error: ' + error.message };
  }
}

export async function verifyFace(
  userId: string, 
  base64Image: string, 
  sessionId: string, 
  lat: number, 
  lon: number
): Promise<{success: boolean, error_type?: string, message?: string}> {
  try {
    const response = await fetch(`${API_URL}/api/face/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_id: userId, 
        image: base64Image,
        session_id: sessionId,
        latitude: lat,
        longitude: lon
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // FastAPI slowapi returns 429 Too Many Requests
      if (response.status === 429) {
          return { success: false, error_type: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' };
      }
      return { success: false, error_type: 'API_ERROR', message: error.detail || 'Verification failed' };
    }
    return await response.json();
  } catch (error: any) {
    return { success: false, error_type: 'NETWORK_ERROR', message: 'Network error: ' + error.message };
  }
}

export async function checkFaceEnrolled(userId: string): Promise<{enrolled: boolean}> {
  try {
    const response = await fetch(`${API_URL}/api/face/status/${userId}`);
    if (!response.ok) return { enrolled: false };
    return await response.json();
  } catch {
    return { enrolled: false };
  }
}

export async function deleteFace(userId: string): Promise<{success: boolean}> {
  try {
    const response = await fetch(`${API_URL}/api/face/delete/${userId}`, { method: 'DELETE' });
    if (!response.ok) return { success: false };
    return await response.json();
  } catch {
    return { success: false };
  }
}
