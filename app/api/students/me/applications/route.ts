import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole, validId } from "@/lib/auth";

interface ApplicationRow extends RowDataPacket {
  application_id: string;
  job_id: string;
  title: string;
  company_name: string;
  status: string;
  match_score: number | null;
  cover_note: string | null;
  applied_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;
  const [applications] = await db.execute<ApplicationRow[]>(
    `SELECT a.application_id, a.job_id, j.title, c.name AS company_name,
            a.status, a.match_score, a.cover_note, a.applied_at
     FROM applications a
     JOIN jobs j ON j.job_id = a.job_id
     JOIN recruiters r ON r.recruiter_id = j.recruiter_id
     JOIN companies c ON c.company_id = r.company_id
     WHERE a.student_id = ? ORDER BY a.applied_at DESC`,
    [auth.userId]
  );
  return NextResponse.json({ applications });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!validId(body.jobId)) return NextResponse.json({ error: "Valid jobId is required" }, { status: 400 });
  const coverNote = body.coverNote === undefined || body.coverNote === null ? null : body.coverNote;
  if (coverNote !== null && (typeof coverNote !== "string" || coverNote.length > 5000)) {
    return NextResponse.json({ error: "coverNote must be at most 5000 characters" }, { status: 400 });
  }

  try {
    await db.execute<ResultSetHeader>(
      "INSERT INTO applications (application_id, job_id, student_id, cover_note) VALUES (?, ?, ?, ?)",
      [randomUUID(), body.jobId, auth.userId, coverNote]
    );
    return NextResponse.json({ message: "Application submitted" }, { status: 201 });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    const message = String((error as { sqlMessage?: string }).sqlMessage ?? "");
    if (code === "ER_DUP_ENTRY") return NextResponse.json({ error: "You have already applied to this job" }, { status: 409 });
    if (code === "45000" || message.includes("Cannot apply")) return NextResponse.json({ error: message || "Job is not accepting applications" }, { status: 400 });
    console.error("Application submission failed", error);
    return NextResponse.json({ error: "Unable to submit application" }, { status: 500 });
  }
}
