import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole, validId } from "@/lib/auth";

interface ApplicationRow extends RowDataPacket {
  application_id: string;
  student_id: string;
  student_name: string | null;
  status: string;
  cover_note: string | null;
  match_score: number | null;
  applied_at: string;
}

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = requireRole(request, "recruiter");
  if (!isSession(auth)) return auth;
  const { id: jobId } = await context.params;
  if (!validId(jobId)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  const [applications] = await db.execute<ApplicationRow[]>(
    `SELECT a.application_id, a.student_id, u.full_name AS student_name,
            a.status, a.cover_note, a.match_score, a.applied_at
     FROM applications a
     JOIN jobs j ON j.job_id = a.job_id
     JOIN users u ON u.user_id = a.student_id
     WHERE a.job_id = ? AND j.recruiter_id = ?
     ORDER BY a.applied_at DESC`,
    [jobId, auth.userId]
  );
  return NextResponse.json({ jobId, applications });
}
