import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole, validId } from "@/lib/auth";
import { syncJobEmbedding } from "@/lib/embedding-sync";

interface RouteContext { params: Promise<{ id: string }>; }

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = requireRole(request, "recruiter");
  if (!isSession(auth)) return auth;
  const { id: jobId } = await context.params;
  if (!validId(jobId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const allowed: Record<string, string> = {
    title: "title", description: "description", jobType: "job_type", location: "location",
    isRemote: "is_remote", minStipend: "min_stipend", maxStipend: "max_stipend",
    applicationDeadline: "application_deadline", status: "status",
  };
  const fields: string[] = [];
  const values: Array<string | number | boolean | null> = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (!(key in body)) continue;
    const value = body[key];
    if (["title", "description", "jobType", "location", "applicationDeadline", "status"].includes(key) && value !== null && typeof value !== "string") return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    if (key === "isRemote" && typeof value !== "boolean") return NextResponse.json({ error: "isRemote must be boolean" }, { status: 400 });
    if (["minStipend", "maxStipend"].includes(key) && value !== null && !Number.isFinite(Number(value))) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    const dbValue = key === "title" || key === "description" || key === "location"
      ? (value as string | null)?.trim() ?? null
      : typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null
        ? value
        : null;
    fields.push(`${column} = ?`);
    values.push(dbValue);
  }
  if (fields.length === 0 && !("requiredSkillIds" in body)) return NextResponse.json({ error: "No job fields supplied" }, { status: 400 });
  if (body.jobType !== undefined && !["full-time", "part-time", "internship", "contract"].includes(String(body.jobType))) return NextResponse.json({ error: "Invalid jobType" }, { status: 400 });
  if (body.status !== undefined && !["open", "closed", "expired"].includes(String(body.status))) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [owned] = await connection.execute<{ job_id: string }[] & ResultSetHeader>(
      "SELECT job_id FROM jobs WHERE job_id = ? AND recruiter_id = ? FOR UPDATE",
      [jobId, auth.userId]
    );
    if (owned.length === 0) { await connection.rollback(); return NextResponse.json({ error: "Job not found" }, { status: 404 }); }
    if (fields.length > 0) {
      values.push(jobId);
      await connection.execute<ResultSetHeader>(`UPDATE jobs SET ${fields.join(", ")} WHERE job_id = ?`, values);
    }
    if ("requiredSkillIds" in body) {
      if (!Array.isArray(body.requiredSkillIds)) { await connection.rollback(); return NextResponse.json({ error: "requiredSkillIds must be an array" }, { status: 400 }); }
      const ids = body.requiredSkillIds.map(Number);
      if (ids.length !== new Set(ids).size || ids.some((id) => !Number.isInteger(id) || id < 1)) { await connection.rollback(); return NextResponse.json({ error: "Invalid requiredSkillIds" }, { status: 400 }); }
      await connection.execute<ResultSetHeader>("DELETE FROM job_skills WHERE job_id = ?", [jobId]);
      for (const skillId of ids) await connection.execute<ResultSetHeader>("INSERT INTO job_skills (job_id, skill_id, is_required) VALUES (?, ?, TRUE)", [jobId, skillId]);
    }
    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    if ((error as { code?: string }).code === "ER_NO_REFERENCED_ROW_2") return NextResponse.json({ error: "One or more skills do not exist" }, { status: 400 });
    console.error("Job update failed", error);
    return NextResponse.json({ error: "Unable to update job" }, { status: 500 });
  } finally { connection.release(); }

  let embeddingSync: "ok" | "failed" = "ok";
  try { await syncJobEmbedding(jobId); } catch (error) { embeddingSync = "failed"; console.error("Job embedding sync failed", error); }
  return NextResponse.json({ jobId, embeddingSync }, { status: embeddingSync === "failed" ? 503 : 200 });
}
