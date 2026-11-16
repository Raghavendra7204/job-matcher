import { db } from "@/lib/db";
import { upsertJobEmbedding, upsertStudentEmbedding } from "@/lib/chroma";
import { RowDataPacket } from "mysql2";

interface StudentEmbeddingRow extends RowDataPacket {
  student_id: string;
  bio: string | null;
  university: string | null;
  degree: string | null;
  graduation_year: number | null;
  skills: string | null;
}

interface JobEmbeddingRow extends RowDataPacket {
  job_id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  job_type: string;
  required_skills: string | null;
}

export async function syncStudentEmbedding(studentId: string): Promise<void> {
  const [rows] = await db.execute<StudentEmbeddingRow[]>(
    `SELECT s.student_id, s.bio, s.university, s.degree, s.graduation_year,
            GROUP_CONCAT(sk.name ORDER BY sk.name SEPARATOR ', ') AS skills
     FROM students s
     LEFT JOIN student_skills ss ON ss.student_id = s.student_id
     LEFT JOIN skills sk ON sk.skill_id = ss.skill_id
     WHERE s.student_id = ?
     GROUP BY s.student_id, s.bio, s.university, s.degree, s.graduation_year`,
    [studentId]
  );
  const student = rows[0];
  if (!student) throw new Error("Student profile not found for embedding sync");

  await upsertStudentEmbedding(studentId, {
    bio: student.bio,
    university: student.university,
    degree: student.degree,
    graduationYear: student.graduation_year,
    skills: student.skills,
  });
}

export async function syncJobEmbedding(jobId: string): Promise<void> {
  const [rows] = await db.execute<JobEmbeddingRow[]>(
    `SELECT j.job_id, j.title, j.description, j.location, j.is_remote, j.job_type,
            GROUP_CONCAT(
              CASE WHEN js.is_required = TRUE THEN sk.name END
              ORDER BY sk.name SEPARATOR ', '
            ) AS required_skills
     FROM jobs j
     LEFT JOIN job_skills js ON js.job_id = j.job_id
     LEFT JOIN skills sk ON sk.skill_id = js.skill_id
     WHERE j.job_id = ?
     GROUP BY j.job_id, j.title, j.description, j.location, j.is_remote, j.job_type`,
    [jobId]
  );
  const job = rows[0];
  if (!job) throw new Error("Job not found for embedding sync");

  await upsertJobEmbedding(jobId, {
    title: job.title,
    description: job.description,
    location: job.location,
    isRemote: Boolean(job.is_remote),
    jobType: job.job_type,
    requiredSkills: job.required_skills,
  });
}
