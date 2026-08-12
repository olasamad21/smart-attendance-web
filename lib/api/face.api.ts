const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function enrollFace(userId: string, base64Image: string): Promise<{success: boolean, message?: string, error?: string}> {
  const response = await fetch(`${API_URL}/api/face/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, image: base64Image }),
  });
  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.detail || 'Enrollment failed' };
  }
  return await response.json();
}

export async function verifyFace(userId: string, base64Image: string): Promise<{matched: boolean, confidence: number, error?: string}> {
  const response = await fetch(`${API_URL}/api/face/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, image: base64Image }),
  });
  if (!response.ok) {
    const error = await response.json();
    return { matched: false, confidence: 0, error: error.detail || 'Verification failed' };
  }
  return await response.json();
}

export async function checkFaceEnrolled(userId: string): Promise<{enrolled: boolean}> {
  const response = await fetch(`${API_URL}/api/face/status/${userId}`);
  if (!response.ok) return { enrolled: false };
  return await response.json();
}

export async function deleteFace(userId: string): Promise<{success: boolean}> {
  const response = await fetch(`${API_URL}/api/face/delete/${userId}`, { method: 'DELETE' });
  if (!response.ok) return { success: false };
  return await response.json();
}
