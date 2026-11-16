import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole, validId } from "@/lib/auth";

interface RouteContext { params: Promise<{ id: string }>; }

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const auth = requireRole(request, "recruiter");
  if (!isSession(auth)) return auth;
  const { id: applicationId } = await context.params;
  if (!validId(applicationId)) return NextResponse.json({ error: "Invalid application ID" }, { status: 400 });
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const status = body.status;
  if (!["applied", "shortlisted", "selected", "rejected"].includes(String(status))) return NextResponse.json({ error: "Invalid application status" }, { status: 400 });

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE applications a
     JOIN jobs j ON j.job_id = a.job_id
     SET a.status = ?
     WHERE a.application_id = ? AND j.recruiter_id = ?`,
    [String(status), applicationId, auth.userId]
  );
  if (result.affectedRows === 0) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({ applicationId, status });
}
