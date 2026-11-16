import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole } from "@/lib/auth";

interface JobRow extends RowDataPacket {
  job_id: string;
  title: string;
  description: string;
  job_type: string;
  location: string | null;
  is_remote: boolean;
  application_deadline: string | null;
  company_name: string;
  required_skills: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;
  const [jobs] = await db.execute<JobRow[]>(
    `SELECT j.job_id, j.title, j.description, j.job_type, j.location, j.is_remote,
            j.application_deadline, c.name AS company_name,
            GROUP_CONCAT(CASE WHEN js.is_required = TRUE THEN sk.name END
              ORDER BY sk.name SEPARATOR ', ') AS required_skills
     FROM jobs j
     JOIN recruiters r ON r.recruiter_id = j.recruiter_id
     JOIN companies c ON c.company_id = r.company_id
     LEFT JOIN job_skills js ON js.job_id = j.job_id
     LEFT JOIN skills sk ON sk.skill_id = js.skill_id
     WHERE j.status = 'open'
       AND (j.application_deadline IS NULL OR j.application_deadline >= CURDATE())
     GROUP BY j.job_id, j.title, j.description, j.job_type, j.location,
              j.is_remote, j.application_deadline, c.name
     ORDER BY j.created_at DESC`,
  );
  return NextResponse.json({ jobs: jobs.map((job) => ({ ...job, requiredSkills: job.required_skills ? job.required_skills.split(", ") : [] })) });
}
