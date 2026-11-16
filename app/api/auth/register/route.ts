import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { setSession, normalizeEmail, validatePassword, type AppRole } from "@/lib/auth";
import { syncStudentEmbedding } from "@/lib/embedding-sync";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const role = body.role;
  if (!email || !password || !fullName || fullName.length > 255) {
    return NextResponse.json({ error: "Valid email, password, and fullName are required" }, { status: 400 });
  }
  if (role !== "student" && role !== "recruiter") {
    return NextResponse.json({ error: "Role must be student or recruiter" }, { status: 400 });
  }

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await db.getConnection();
  let companyId: string | null = null;

  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute<[{ user_id: string }] & ResultSetHeader>(
      "SELECT user_id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }

    await connection.execute<ResultSetHeader>(
      "INSERT INTO users (user_id, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)",
      [userId, email, passwordHash, role, fullName]
    );

    if (role === "student") {
      await connection.execute<ResultSetHeader>(
        "INSERT INTO students (student_id) VALUES (?)",
        [userId]
      );
    } else {
      const requestedCompanyId = typeof body.companyId === "string" ? body.companyId : null;
      const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
      if (requestedCompanyId) {
        const [companies] = await connection.execute<{ company_id: string }[] & ResultSetHeader>(
          "SELECT company_id FROM companies WHERE company_id = ? LIMIT 1",
          [requestedCompanyId]
        );
        if (companies.length === 0) {
          await connection.rollback();
          return NextResponse.json({ error: "Company not found" }, { status: 400 });
        }
        companyId = requestedCompanyId;
      } else if (companyName) {
        companyId = randomUUID();
        await connection.execute<ResultSetHeader>(
          "INSERT INTO companies (company_id, name, website, industry) VALUES (?, ?, ?, ?)",
          [
            companyId,
            companyName,
            typeof body.website === "string" ? body.website.trim() : null,
            typeof body.industry === "string" ? body.industry.trim() : null,
          ]
        );
      } else {
        await connection.rollback();
        return NextResponse.json({ error: "companyId or companyName is required" }, { status: 400 });
      }

      await connection.execute<ResultSetHeader>(
        "INSERT INTO recruiters (recruiter_id, company_id, designation) VALUES (?, ?, ?)",
        [userId, companyId, typeof body.designation === "string" ? body.designation.trim() : null]
      );
    }

    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    const code = (error as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Email or company name is already registered" }, { status: 409 });
    }
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Unable to register account" }, { status: 500 });
  } finally {
    connection.release();
  }

  const response = NextResponse.json({ userId, email, fullName, role }, { status: 201 });
  setSession(response, userId, role as AppRole);
  if (role === "student") {
    try {
      await syncStudentEmbedding(userId);
    } catch (error) {
      console.error("Student registration embedding sync failed", error);
      response.headers.set("X-Embedding-Sync", "failed");
    }
  }
  return response;
}
