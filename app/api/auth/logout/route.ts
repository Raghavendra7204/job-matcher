import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  clearSession(response);
  return response;
}
