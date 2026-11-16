"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage } from "@/app/components/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const user = await apiFetch<{ role: "student" | "recruiter" }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.replace(user.role === "student" ? "/student" : "/recruiter");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <div className="auth-page"><div className="auth-card">
    <div className="brand"><span className="brand-mark">JM</span>Job Matcher</div>
    <h1>Welcome back</h1><p className="intro">Sign in to discover relevant opportunities or find the right candidates.</p>
    <form className="stack" onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <button className="button button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    <div className="auth-footer">New to Job Matcher? <Link className="link" href="/register">Create an account</Link></div>
  </div></div>;
}
