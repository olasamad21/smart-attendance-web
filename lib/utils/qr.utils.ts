export function buildQRPayload(sessionId: string, token: string, courseId: string) {
  return JSON.stringify({ sessionId, token, courseId });
}
