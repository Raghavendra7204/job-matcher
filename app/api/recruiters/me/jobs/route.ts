import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole } from "@/lib/auth";
import { syncJobEmbedding } from "@/lib/embedding-sync";

interface JobRow extends RowDataPacket {
  job_id: string;
  title: string;
  description: string;
  job_type: string;
  location: string | null;
  is_remote: boolean;
  min_stipend: number | null;
  max_stipend: number | null;
  application_deadline: string | null;
  status: string;
  required_skills: string | null;
}

function parseSkills(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const skillIds = value.map(Number);
  return skillIds.length === new Set(skillIds).size && skillIds.every((id) => Number.isInteger(id) && id > 0)
    ? skillIds
    : null;
}

function parseJobBody(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const jobType = typeof body.jobType === "string" ? body.jobType : "full-time";
  const location = body.location === null || body.location === undefined ? null : typeof body.location === "string" ? body.location.trim() : undefined;
  const isRemote = typeof body.isRemote === "boolean" ? body.isRemote : false;
  const minStipend = body.minStipend === null || body.minStipend === undefined ? null : Number(body.minStipend);
  const maxStipend = body.maxStipend === null || body.maxStipend === undefined ? null : Number(body.maxStipend);
  const deadline = body.applicationDeadline === null || body.applicationDeadline === undefined ? null : body.applicationDeadline;
  const requiredSkillIds = parseSkills(body.requiredSkillIds ?? []);
  if (!title || title.length > 255 || !description || description.length > 10000) return { error: "Valid title and description are required" };
  if (!["full-time", "part-time", "internship", "contract"].includes(jobType)) return { error: "Invalid jobType" };
  if (location === undefined || (typeof deadline !== "string" && deadline !== null) || (minStipend !== null && !Number.isFinite(minStipend)) || (maxStipend !== null && !Number.isFinite(maxStipend)) || (minStipend !== null && maxStipend !== null && minStipend > maxStipend)) return { error: "Invalid job fields" };
  if (!requiredSkillIds) return { error: "requiredSkillIds must be an array of positive integers" };
  return { title, description, jobType, location, isRemote, minStipend, maxStipend, deadline, requiredSkillIds };
}

async function loadRecruiterJobs(recruiterId: string): Promise<JobRow[]> {
  const [jobs] = await db.execute<JobRow[]>(
    `SELECT j.job_id, j.title, j.description, j.job_type, j.location, j.is_remote,
            j.min_stipend, j.max_stipend, j.application_deadline, j.status,
            GROUP_CONCAT(CASE WHEN js.is_required = TRUE THEN sk.name END
              ORDER BY sk.name SEPARATOR ', ') AS required_skills
     FROM jobs j
     LEFT JOIN job_skills js ON js.job_id = j.job_id
     LEFT JOIN skills sk ON sk.skill_id = js.skill_id
     WHERE j.recruiter_id = ?
     GROUP BY j.job_id, j.title, j.description, j.job_type, j.location, j.is_remote,
              j.min_stipend, j.max_stipend, j.application_deadline, j.status
     ORDER BY j.created_at DESC`,
    [recruiterId]
  );
  return jobs;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "recruiter");
  if (!isSession(auth)) return auth;
  const jobs = await loadRecruiterJobs(auth.userId);
  return NextResponse.json({ jobs: jobs.map((job) => ({ ...job, requiredSkills: job.required_skills ? job.required_skills.split(", ") : [] })) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "recruiter");
  if (!isSession(auth)) return auth;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = parseJobBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [recruiters] = await db.execute<{ company_id: string }[] & RowDataPacket[]>(
    "SELECT company_id FROM recruiters WHERE recruiter_id = ? LIMIT 1",
    [auth.userId]
  );
  if (recruiters.length === 0) return NextResponse.json({ error: "Recruiter profile not found" }, { status: 404 });

  const jobId = randomUUID();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      `INSERT INTO jobs (job_id, recruiter_id, title, description, job_type, location,
                         is_remote, min_stipend, max_stipend, application_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, auth.userId, parsed.title, parsed.description, parsed.jobType, parsed.location, parsed.isRemote, parsed.minStipend, parsed.maxStipend, parsed.deadline]
    );
    for (const skillId of parsed.requiredSkillIds) {
      await connection.execute<ResultSetHeader>(
        "INSERT INTO job_skills (job_id, skill_id, is_required) VALUES (?, ?, TRUE)",
        [jobId, skillId]
      );
    }
    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    if ((error as { code?: string }).code === "ER_NO_REFERENCED_ROW_2") return NextResponse.json({ error: "One or more skills do not exist" }, { status: 400 });
    console.error("Job creation failed", error);
    return NextResponse.json({ error: "Unable to create job" }, { status: 500 });
  } finally { connection.release(); }

  let embeddingSync: "ok" | "failed" = "ok";
  try { await syncJobEmbedding(jobId); } catch (error) { embeddingSync = "failed"; console.error("Job embedding sync failed", error); }
  return NextResponse.json({ jobId, embeddingSync }, { status: embeddingSync === "failed" ? 503 : 201 });
}
