import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { normalizeEmail, setSession } from "@/lib/auth";

interface UserRow extends RowDataPacket {
  user_id: string;
  email: string;
  password_hash: string;
  role: "student" | "recruiter" | "admin";
  full_name: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const [users] = await db.execute<UserRow[]>(
    "SELECT user_id, email, password_hash, role, full_name FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  const user = users[0];
  if (!user || user.role === "admin" || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({
    userId: user.user_id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  });
  setSession(response, user.user_id, user.role);
  return response;
}
