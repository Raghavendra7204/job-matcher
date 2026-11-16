import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getJobEmbeddingCollection, getStudentEmbeddingCollection } from "@/lib/chroma";
import { isSession, requireRole } from "@/lib/auth";

interface JobRow extends RowDataPacket {
  job_id: string;
}

interface StudentRow extends RowDataPacket {
  student_id: string;
  full_name: string | null;
}

interface SkillRow extends RowDataPacket {
  student_id: string;
  name: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isValidId(value: string): boolean {
  return /^[A-Za-z0-9-]{1,64}$/u.test(value);
}

function similarityScore(distance: number): number {
  return Number((1 - distance).toFixed(4));
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const auth = requireRole(_request, "recruiter");
    if (!isSession(auth)) return auth;
    const { id: jobId } = await context.params;
    if (!isValidId(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const [jobs] = await db.execute<JobRow[]>(
      "SELECT job_id FROM jobs WHERE job_id = ? AND recruiter_id = ? LIMIT 1",
      [jobId, auth.userId]
    );
    if (jobs.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobCollection = await getJobEmbeddingCollection();
    const storedJob = await jobCollection.get({
      ids: [jobId],
      include: ["embeddings"],
    });
    const jobEmbedding = storedJob.embeddings?.[0];
    if (!jobEmbedding) {
      return NextResponse.json({ jobId, students: [] });
    }

    const studentCollection = await getStudentEmbeddingCollection();
    const studentCount = await studentCollection.count();
    if (studentCount === 0) {
      return NextResponse.json({ jobId, students: [] });
    }

    const matches = await studentCollection.query({
      queryEmbeddings: [jobEmbedding],
      nResults: studentCount,
    });
    const ids = matches.ids[0] ?? [];
    const distances = matches.distances?.[0] ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ jobId, students: [] });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [students] = await db.execute<StudentRow[]>(
      `SELECT s.student_id, u.full_name
       FROM students s
       JOIN users u ON u.user_id = s.student_id
       WHERE s.student_id IN (${placeholders})`,
      ids
    );
    const studentById = new Map(students.map((student) => [student.student_id, student]));

    const [skills] = await db.execute<SkillRow[]>(
      `SELECT ss.student_id, sk.name
       FROM student_skills ss
       JOIN skills sk ON sk.skill_id = ss.skill_id
       WHERE ss.student_id IN (${placeholders})
       ORDER BY ss.student_id, sk.name`,
      ids
    );
    const skillsByStudent = new Map<string, string[]>();
    for (const skill of skills) {
      const names = skillsByStudent.get(skill.student_id) ?? [];
      names.push(skill.name);
      skillsByStudent.set(skill.student_id, names);
    }

    const studentsResult = ids
      .map((id, index) => {
        const student = studentById.get(id);
        if (!student) return null;
        return {
          studentId: student.student_id,
          studentName: student.full_name,
          skills: skillsByStudent.get(student.student_id) ?? [],
          similarityScore: similarityScore(distances[index] ?? 1),
        };
      })
      .filter((student): student is NonNullable<typeof student> => student !== null)
      .slice(0, 5);

    return NextResponse.json({ jobId, students: studentsResult });
  } catch (error) {
    console.error("Semantic candidate match failed", error);
    return NextResponse.json(
      { error: "Unable to perform semantic candidate matching" },
      { status: 500 }
    );
  }
}
