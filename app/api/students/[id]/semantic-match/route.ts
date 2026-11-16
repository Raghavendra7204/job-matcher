import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getJobEmbeddingCollection, getStudentEmbeddingCollection } from "@/lib/chroma";
import { isSession, requireRole } from "@/lib/auth";

interface StudentRow extends RowDataPacket {
  student_id: string;
}

interface JobRow extends RowDataPacket {
  job_id: string;
  title: string;
  company_name: string;
}

interface SkillRow extends RowDataPacket {
  job_id: string;
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
    const auth = requireRole(_request, "student");
    if (!isSession(auth)) return auth;
    const { id: studentId } = await context.params;
    if (!isValidId(studentId)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
    }
    if (auth.userId !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [students] = await db.execute<StudentRow[]>(
      "SELECT student_id FROM students WHERE student_id = ? LIMIT 1",
      [studentId]
    );
    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const studentCollection = await getStudentEmbeddingCollection();
    const storedStudent = await studentCollection.get({
      ids: [studentId],
      include: ["embeddings"],
    });
    const studentEmbedding = storedStudent.embeddings?.[0];
    if (!studentEmbedding) {
      return NextResponse.json({ studentId, jobs: [] });
    }

    const jobCollection = await getJobEmbeddingCollection();
    const jobCount = await jobCollection.count();
    if (jobCount === 0) {
      return NextResponse.json({ studentId, jobs: [] });
    }

    const matches = await jobCollection.query({
      queryEmbeddings: [studentEmbedding],
      nResults: jobCount,
    });
    const ids = matches.ids[0] ?? [];
    const distances = matches.distances?.[0] ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ studentId, jobs: [] });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [jobs] = await db.execute<JobRow[]>(
      `SELECT j.job_id, j.title, c.name AS company_name
       FROM jobs j
       JOIN recruiters r ON r.recruiter_id = j.recruiter_id
       JOIN companies c ON c.company_id = r.company_id
       WHERE j.job_id IN (${placeholders})
         AND j.status = 'open'
         AND (j.application_deadline IS NULL OR j.application_deadline >= CURDATE())`,
      ids
    );
    const jobById = new Map(jobs.map((job) => [job.job_id, job]));
    const eligibleIds = ids.filter((id) => jobById.has(id));
    if (eligibleIds.length === 0) {
      return NextResponse.json({ studentId, jobs: [] });
    }

    const skillPlaceholders = eligibleIds.map(() => "?").join(",");
    const [skills] = await db.execute<SkillRow[]>(
      `SELECT js.job_id, s.name
       FROM job_skills js
       JOIN skills s ON s.skill_id = js.skill_id
       WHERE js.job_id IN (${skillPlaceholders}) AND js.is_required = TRUE
       ORDER BY js.job_id, s.name`,
      eligibleIds
    );
    const skillsByJob = new Map<string, string[]>();
    for (const skill of skills) {
      const names = skillsByJob.get(skill.job_id) ?? [];
      names.push(skill.name);
      skillsByJob.set(skill.job_id, names);
    }

    const jobsResult = ids
      .map((id, index) => {
        const job = jobById.get(id);
        if (!job) return null;
        return {
          jobId: job.job_id,
          title: job.title,
          companyName: job.company_name,
          requiredSkills: skillsByJob.get(job.job_id) ?? [],
          similarityScore: similarityScore(distances[index] ?? 1),
        };
      })
      .filter((job): job is NonNullable<typeof job> => job !== null)
      .slice(0, 5);

    return NextResponse.json({ studentId, jobs: jobsResult });
  } catch (error) {
    console.error("Semantic student job match failed", error);
    return NextResponse.json(
      { error: "Unable to perform semantic job matching" },
      { status: 500 }
    );
  }
}
