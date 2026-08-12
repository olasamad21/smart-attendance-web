import { getCourseById, getEnrolledStudents } from "@/lib/firebase/courses.service";
import { getSessionsForCourse } from "@/lib/firebase/sessions.service";
import { getCourseAttendanceOverview } from "@/lib/firebase/attendance.service";
import TopAppBar from "@/components/layout/TopAppBar";
import { Course, UserProfile, Session, AttendanceRecord } from "@/types";

export default async function EnrolledStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  // fetch data
  const [course, students, sessions, attendanceRecords] = await Promise.all([
    getCourseById(courseId),
    getEnrolledStudents(courseId),
    getSessionsForCourse(courseId),
    getCourseAttendanceOverview(courseId),
  ]);

  const totalSessions = sessions.length;

  // Calculate attendance per student
  const studentsWithAttendance = students.map((student) => {
    // get records for this student
    const studentRecords = attendanceRecords.filter(
      (r) => r.studentId === student.userId
    );
    // attended sessions
    const attendedSessions = studentRecords.filter(
      (r) =>
        (r.totalScore ?? 0) > 0 ||
        r.phase1Status === "present" ||
        r.phase2Status === "present" ||
        r.remark?.toLowerCase() === "present" ||
        r.remark?.toLowerCase() === "late"
    ).length;

    const rate =
      totalSessions > 0
        ? Math.round((attendedSessions / totalSessions) * 100)
        : 0;

    return {
      ...student,
      attendedSessions,
      attendanceRate: rate,
    };
  });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopAppBar title="Enrolled Students" showBack />
      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="p-4 md:p-6 border-b border-outline-variant">
            <h2 className="text-xl font-semibold text-on-surface">
              {course?.courseCode} - Students
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {students.length} student{students.length !== 1 ? "s" : ""} enrolled
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface text-sm">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium whitespace-nowrap">Matric No</th>
                  <th className="p-4 font-medium">Department</th>
                  <th className="p-4 font-medium whitespace-nowrap">Date Enrolled</th>
                  <th className="p-4 font-medium whitespace-nowrap">Attendance %</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {studentsWithAttendance.map((student) => {
                  let dateStr = "N/A";
                  if (student.enrolledAt) {
                    const d = student.enrolledAt?.toDate
                      ? student.enrolledAt.toDate()
                      : new Date(student.enrolledAt);
                    if (!isNaN(d.getTime())) {
                      dateStr = d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    }
                  }

                  return (
                    <tr
                      key={student.userId}
                      className="border-b border-outline-variant hover:bg-surface-container-lowest transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-medium text-on-surface whitespace-nowrap">
                          {student.name || "Unknown"}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {student.email}
                        </div>
                      </td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {student.matricNumber || "N/A"}
                      </td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {student.department || "N/A"}
                      </td>
                      <td className="p-4 text-on-surface-variant whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden w-16 md:w-24">
                            <div
                              className={`h-full rounded-full ${
                                student.attendanceRate >= 75
                                  ? "bg-primary"
                                  : student.attendanceRate >= 50
                                  ? "bg-tertiary"
                                  : "bg-error"
                              }`}
                              style={{ width: `${student.attendanceRate}%` }}
                            />
                          </div>
                          <span className="font-medium text-on-surface whitespace-nowrap">
                            {student.attendanceRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {studentsWithAttendance.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-on-surface-variant"
                    >
                      No students enrolled yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
