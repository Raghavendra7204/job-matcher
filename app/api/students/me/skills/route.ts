import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { isSession, requireRole } from "@/lib/auth";
import { syncStudentEmbedding } from "@/lib/embedding-sync";

interface SkillRow extends RowDataPacket {
  skill_id: number;
  name: string;
  proficiency: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;
  const [skills] = await db.execute<SkillRow[]>(
    `SELECT sk.skill_id, sk.name, ss.proficiency
     FROM student_skills ss
     JOIN skills sk ON sk.skill_id = ss.skill_id
     WHERE ss.student_id = ? ORDER BY sk.name`,
    [auth.userId]
  );
  return NextResponse.json({ skills });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = requireRole(request, "student");
  if (!isSession(auth)) return auth;

  let body: { skills?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.skills)) {
    return NextResponse.json({ error: "skills must be an array" }, { status: 400 });
  }

  const normalized: Array<{ skillId: number; proficiency: number | null }> = [];
  const seen = new Set<number>();
  for (const item of body.skills) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Each skill must be an object" }, { status: 400 });
    }
    const skillId = Number((item as { skillId?: unknown }).skillId);
    const proficiencyValue = (item as { proficiency?: unknown }).proficiency;
    const proficiency = proficiencyValue === null || proficiencyValue === undefined
      ? null
      : Number(proficiencyValue);
    if (!Number.isInteger(skillId) || skillId < 1 || seen.has(skillId)) {
      return NextResponse.json({ error: "Each skillId must be a unique positive integer" }, { status: 400 });
    }
    if (proficiency !== null && (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 5)) {
      return NextResponse.json({ error: "proficiency must be between 1 and 5" }, { status: 400 });
    }
    seen.add(skillId);
    normalized.push({ skillId, proficiency });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      "DELETE FROM student_skills WHERE student_id = ?",
      [auth.userId]
    );
    for (const skill of normalized) {
      await connection.execute<ResultSetHeader>(
        "INSERT INTO student_skills (student_id, skill_id, proficiency) VALUES (?, ?, ?)",
        [auth.userId, skill.skillId, skill.proficiency]
      );
    }
    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    if ((error as { code?: string }).code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json({ error: "One or more skills do not exist" }, { status: 400 });
    }
    console.error("Student skills update failed", error);
    return NextResponse.json({ error: "Unable to update skills" }, { status: 500 });
  } finally {
    connection.release();
  }

  let embeddingSync: "ok" | "failed" = "ok";
  try {
    await syncStudentEmbedding(auth.userId);
  } catch (error) {
    embeddingSync = "failed";
    console.error("Student skills embedding sync failed", error);
  }
  return NextResponse.json(
    { skills: normalized, embeddingSync },
    { status: embeddingSync === "failed" ? 503 : 200 }
  );
}
