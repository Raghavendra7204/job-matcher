"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api";

export function Shell({ children, name, role }: { children: React.ReactNode; name?: string | null; role: "student" | "recruiter" }) {
  const router = useRouter();
  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" href={role === "student" ? "/student" : "/recruiter"}><span className="brand-mark">JM</span>Job Matcher</Link>
      <div className="topbar-actions"><span className="user-chip">{name ?? "Signed in"} · {role}</span><button className="button button-ghost" onClick={logout}>Log out</button></div>
    </header>
    <main className="page-wrap">{children}</main>
  </div>;
}

export function Loading() { return <div className="card empty">Loading your workspace…</div>; }
