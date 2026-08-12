export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: 'lecturer' | 'student';
  department?: string;
  level?: string;
  matricNumber?: string;
  createdAt: any;
}

export interface Course {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  enrollmentKey?: string;
  lecturerId: string;
  lecturerName: string;
  defaultDuration: number;
  phase1Marks?: number;
  phase2Marks?: number;
  marksEdited?: boolean;
  createdAt: any;
}

export interface Enrollment {
  enrollmentId: string;
  courseId: string;
  studentId: string;
  enrolledAt: any;
}

export interface Classroom {
  classroomId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface Session {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  lecturerId: string;
  classroomId: string;
  classroomName: string;
  classroomLat: number;
  classroomLng: number;
  classroomRadius: number;
  phase1Duration: number;
  phase2Duration: number;
  status: 'phase1_open' | 'waiting' | 'phase2_open' | 'ended';
  phase1Start: any;
  phase1End: any;
  phase2Start: any;
  phase2End: any;
  createdAt: any;
  // Legacy fields
  startTime?: any;
  endTime?: any | null;
  isActive?: boolean;
  qrToken?: string;
  qrTokenExpiresAt?: any;
  duration?: number;
}

export interface AttendanceRecord {
  attendanceId: string;
  sessionId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  matricNumber: string;
  phase1Score: number;
  phase1Status: 'present' | 'failed' | 'absent';
  phase1Time: any;
  phase2Score: number;
  phase2Status: 'present' | 'failed' | 'absent';
  phase2Time: any | null;
  phase2Confidence?: number;
  phase2GpsDistance?: number;
  totalScore: number;
  remark: string;
  timestamp: any;
  faceMatchConfidence?: number;
  gpsDistance?: number;
}

export interface AttendanceSummary {
  studentId: string;
  studentName: string;
  matricNumber: string;
  totalSessions: number;
  attendedSessions: number;
  percentage: number;
}
