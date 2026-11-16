import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface SkillRow extends RowDataPacket { skill_id: number; name: string; }

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!getSession(request)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [skills] = await db.execute<SkillRow[]>("SELECT skill_id, name FROM skills ORDER BY name");
  return NextResponse.json({ skills });
}
