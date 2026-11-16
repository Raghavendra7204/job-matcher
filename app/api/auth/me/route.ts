import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface UserRow extends RowDataPacket {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const [users] = await db.execute<UserRow[]>(
    "SELECT user_id, email, full_name, role FROM users WHERE user_id = ? LIMIT 1",
    [session.userId]
  );
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 401 });
  return NextResponse.json({ userId: users[0].user_id, email: users[0].email, fullName: users[0].full_name, role: users[0].role });
}
