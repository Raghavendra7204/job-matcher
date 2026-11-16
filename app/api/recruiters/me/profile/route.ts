import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole } from "@/lib/auth";

interface RecruiterProfileRow extends RowDataPacket {
  recruiter_id: string;
  email: string;
  full_name: string | null;
  designation: string | null;
  company_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "recruiter");
  if (!isSession(auth)) return auth;
  const [rows] = await db.execute<RecruiterProfileRow[]>(
    `SELECT r.recruiter_id, u.email, u.full_name, r.designation,
            c.company_id, c.name AS company_name, c.website, c.industry
     FROM recruiters r
     JOIN users u ON u.user_id = r.recruiter_id
     JOIN companies c ON c.company_id = r.company_id
     WHERE r.recruiter_id = ? LIMIT 1`,
    [auth.userId]
  );
  if (rows.length === 0) return NextResponse.json({ error: "Recruiter profile not found" }, { status: 404 });
  const profile = rows[0];
  return NextResponse.json({
    recruiterId: profile.recruiter_id,
    email: profile.email,
    fullName: profile.full_name,
    designation: profile.designation,
    company: {
      companyId: profile.company_id,
      name: profile.company_name,
      website: profile.website,
      industry: profile.industry,
    },
  });
}
