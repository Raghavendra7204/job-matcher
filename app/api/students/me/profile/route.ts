import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole } from "@/lib/auth";
import { syncStudentEmbedding } from "@/lib/embedding-sync";

interface ProfileRow extends RowDataPacket {
  student_id: string;
  email: string;
  full_name: string | null;
  university: string | null;
  degree: string | null;
  graduation_year: number | null;
  bio: string | null;
  skills: string | null;
}

async function loadProfile(studentId: string): Promise<ProfileRow | undefined> {
  const [rows] = await db.execute<ProfileRow[]>(
    `SELECT s.student_id, u.email, u.full_name, s.university, s.degree,
            s.graduation_year, s.bio,
            GROUP_CONCAT(sk.name ORDER BY sk.name SEPARATOR ', ') AS skills
     FROM students s
     JOIN users u ON u.user_id = s.student_id
     LEFT JOIN student_skills ss ON ss.student_id = s.student_id
     LEFT JOIN skills sk ON sk.skill_id = ss.skill_id
     WHERE s.student_id = ?
     GROUP BY s.student_id, u.email, u.full_name, s.university, s.degree,
              s.graduation_year, s.bio`,
    [studentId]
  );
  return rows[0];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;
  const profile = await loadProfile(auth.userId);
  if (!profile) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  return NextResponse.json({
    studentId: profile.student_id,
    email: profile.email,
    fullName: profile.full_name,
    university: profile.university,
    degree: profile.degree,
    graduationYear: profile.graduation_year,
    bio: profile.bio,
    skills: profile.skills ? profile.skills.split(", ") : [],
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  const stringFields = ["university", "degree", "bio"] as const;
  for (const field of stringFields) {
    if (field in body) {
      if (body[field] !== null && typeof body[field] !== "string") {
        return NextResponse.json({ error: `${field} must be a string or null` }, { status: 400 });
      }
      const value = body[field] === null ? null : (body[field] as string).trim();
      if (typeof value === "string" && value.length > 10000) {
        return NextResponse.json({ error: `${field} is too long` }, { status: 400 });
      }
      fields.push(`${field} = ?`);
      values.push(value);
    }
  }
  if ("graduationYear" in body) {
    const year = body.graduationYear;
    if (year !== null && (!Number.isInteger(year) || Number(year) < 1950 || Number(year) > 2200)) {
      return NextResponse.json({ error: "graduationYear must be a valid year" }, { status: 400 });
    }
    fields.push("graduation_year = ?");
    values.push(year === null ? null : Number(year));
  }
  if (fields.length === 0) return NextResponse.json({ error: "No profile fields supplied" }, { status: 400 });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    values.push(auth.userId);
    await connection.execute<ResultSetHeader>(
      `UPDATE students SET ${fields.join(", ")} WHERE student_id = ?`,
      values
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Student profile update failed", error);
    return NextResponse.json({ error: "Unable to update profile" }, { status: 500 });
  } finally {
    connection.release();
  }

  let embeddingSync: "ok" | "failed" = "ok";
  try {
    await syncStudentEmbedding(auth.userId);
  } catch (error) {
    embeddingSync = "failed";
    console.error("Student profile embedding sync failed", error);
  }
  const profile = await loadProfile(auth.userId);
  return NextResponse.json(
    { profile, embeddingSync },
    { status: embeddingSync === "failed" ? 503 : 200 }
  );
}
