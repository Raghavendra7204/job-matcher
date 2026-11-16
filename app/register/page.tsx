"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage } from "@/app/components/api";

type Company = { company_id: string; name: string };

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "recruiter">("student");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", companyName: "", companyId: "", designation: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function loadCompanies() {
    try { const data = await apiFetch<{ companies: Company[] }>("/api/companies"); setCompanies(data.companies); } catch { setCompanies([]); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    const body: Record<string, string> = { fullName: form.fullName, email: form.email, password: form.password, role };
    if (role === "recruiter") { if (form.companyId) body.companyId = form.companyId; else body.companyName = form.companyName; body.designation = form.designation; }
    try { await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(body) }); router.replace(role === "student" ? "/student" : "/recruiter"); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return <div className="auth-page"><div className="auth-card">
    <div className="brand"><span className="brand-mark">JM</span>Job Matcher</div>
    <h1>Create your account</h1><p className="intro">Join as a student looking for opportunities or a recruiter building a team.</p>
    <form className="stack" onSubmit={submit}>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="field"><label htmlFor="role">I am a</label><select className="select" id="role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="student">Student</option><option value="recruiter">Recruiter</option></select></div>
      <div className="field"><label htmlFor="fullName">Full name</label><input className="input" id="fullName" required value={form.fullName} onChange={set("fullName")} /></div>
      <div className="field"><label htmlFor="registerEmail">Email</label><input className="input" id="registerEmail" type="email" required value={form.email} onChange={set("email")} /></div>
      <div className="field"><label htmlFor="registerPassword">Password <span className="muted small">(8+ characters)</span></label><input className="input" id="registerPassword" type="password" minLength={8} required value={form.password} onChange={set("password")} /></div>
      {role === "recruiter" && <div className="form-grid"><div className="field full"><label htmlFor="companyChoice">Company</label><select className="select" id="companyChoice" value={form.companyId ? `existing:${form.companyId}` : "new"} onFocus={() => { if (!companies.length) void loadCompanies(); }} onChange={(e) => { const value = e.target.value; setForm({ ...form, companyId: value.startsWith("existing:") ? value.slice(9) : "", companyName: value === "new" ? form.companyName : "" }); }}><option value="new">Create a new company</option>{companies.map((company) => <option key={company.company_id} value={`existing:${company.company_id}`}>{company.name}</option>)}</select></div>{!form.companyId && <div className="field full"><label htmlFor="companyName">New company name</label><input className="input" id="companyName" required value={form.companyName} onChange={set("companyName")} /></div>}<div className="field full"><label htmlFor="designation">Designation</label><input className="input" id="designation" value={form.designation} onChange={set("designation")} /></div></div>}
      <button className="button button-primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
    <div className="auth-footer">Already registered? <Link className="link" href="/login">Sign in</Link></div>
  </div></div>;
}
