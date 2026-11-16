import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

interface CompanyRow extends RowDataPacket { company_id: string; name: string; }

export async function GET(): Promise<NextResponse> {
  const [companies] = await db.execute<CompanyRow[]>("SELECT company_id, name FROM companies ORDER BY name");
  return NextResponse.json({ companies });
}
