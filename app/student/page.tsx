"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, errorMessage, scoreLabel } from "@/app/components/api";
import { Loading, Shell } from "@/app/components/shell";

type Tab = "overview" | "profile" | "browse" | "applications";
type Me = { userId: string; fullName: string | null; role: "student"; email: string };
type Profile = { studentId: string; email: string; fullName: string | null; university: string | null; degree: string | null; graduationYear: number | null; bio: string | null; skills: string[] };
type Skill = { skill_id: number; name: string; proficiency?: number | null };
type Job = { job_id: string; title: string; description: string; job_type: string; location: string | null; is_remote: boolean; application_deadline: string | null; company_name: string; requiredSkills: string[] };
type Recommendation = { jobId: string; title: string; companyName: string; requiredSkills: string[]; similarityScore: number };
type Application = { application_id: string; job_id: string; title: string; company_name: string; status: string; applied_at: string; cover_note: string | null };

export default function StudentPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null); const [profile, setProfile] = useState<Profile | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]); const [mySkills, setMySkills] = useState<Skill[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]); const [recommendations, setRecommendations] = useState<Recommendation[]>([]); const [applications, setApplications] = useState<Application[]>([]);
  const [tab, setTab] = useState<Tab>("overview"); const [search, setSearch] = useState(""); const [busy, setBusy] = useState(true); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState({ university: "", degree: "", graduationYear: "", bio: "" });
  const [skillValues, setSkillValues] = useState<Record<number, number | null | undefined>>({});

  async function refreshApplications() { const data = await apiFetch<{ applications: Application[] }>("/api/students/me/applications"); setApplications(data.applications); }
  async function load() {
    try {
      const current = await apiFetch<Me>("/api/auth/me");
      if (current.role !== "student") { router.replace("/recruiter"); return; }
      const [profileData, skillsData, skillCatalog, jobData, applicationData] = await Promise.all([
        apiFetch<Profile>("/api/students/me/profile"), apiFetch<{ skills: Skill[] }>("/api/students/me/skills"), apiFetch<{ skills: Skill[] }>("/api/skills"), apiFetch<{ jobs: Job[] }>("/api/jobs"), apiFetch<{ applications: Application[] }>("/api/students/me/applications"),
      ]);
      setMe(current); setProfile(profileData); setMySkills(skillsData.skills); setAllSkills(skillCatalog.skills); setJobs(jobData.jobs); setApplications(applicationData.applications);
      setProfileForm({ university: profileData.university ?? "", degree: profileData.degree ?? "", graduationYear: profileData.graduationYear?.toString() ?? "", bio: profileData.bio ?? "" });
      const values: Record<number, number | null> = {}; for (const skill of skillsData.skills) values[skill.skill_id] = skill.proficiency ?? null; setSkillValues(values);
      try { const matches = await apiFetch<{ jobs: Recommendation[] }>(`/api/students/${current.userId}/semantic-match`); setRecommendations(matches.jobs); } catch (e) { setError(`Recommendations unavailable: ${errorMessage(e)}`); }
    } catch (e) { const message = errorMessage(e); if (message === "Authentication required") router.replace("/login"); else setError(message); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  const filteredJobs = useMemo(() => { const query = search.toLowerCase(); return jobs.filter((job) => !query || `${job.title} ${job.company_name} ${job.requiredSkills.join(" ")}`.toLowerCase().includes(query)); }, [jobs, search]);
  const appliedIds = new Set(applications.map((application) => application.job_id));
  async function apply(jobId: string) { setMessage(""); setError(""); try { await apiFetch("/api/students/me/applications", { method: "POST", body: JSON.stringify({ jobId }) }); setMessage("Application submitted."); await refreshApplications(); } catch (e) { setError(errorMessage(e)); } }
  async function saveProfile(event: React.FormEvent) { event.preventDefault(); setMessage(""); setError(""); try { const response = await apiFetch<{ embeddingSync: string }>("/api/students/me/profile", { method: "PATCH", body: JSON.stringify({ ...profileForm, graduationYear: profileForm.graduationYear ? Number(profileForm.graduationYear) : null }) }); setMessage(response.embeddingSync === "failed" ? "Profile saved, but recommendation sync failed." : "Profile saved and recommendations refreshed."); await load(); } catch (e) { setError(errorMessage(e)); } }
  async function saveSkills(event: React.FormEvent) { event.preventDefault(); setMessage(""); setError(""); try { const selected = Object.entries(skillValues).filter(([, value]) => value !== undefined).map(([skillId, proficiency]) => ({ skillId: Number(skillId), proficiency })); const response = await apiFetch<{ embeddingSync: string }>("/api/students/me/skills", { method: "PUT", body: JSON.stringify({ skills: selected }) }); setMessage(response.embeddingSync === "failed" ? "Skills saved, but recommendation sync failed." : "Skills saved and recommendations refreshed."); await load(); } catch (e) { setError(errorMessage(e)); } }

  if (busy) return <Loading />;
  if (!me || !profile) return <div className="auth-page"><div className="auth-card"><div className="notice notice-error">{error || "Unable to load your student workspace."}</div></div></div>;
  return <Shell name={me.fullName} role="student"><div className="page-heading"><div className="heading-copy"><div className="eyebrow">Student workspace</div><h1>Find work that fits.</h1><p>Semantic recommendations based on your profile, education, and skills.</p></div><span className="pill pill-green">Student account</span></div>
    <div className="tabs">{(["overview", "profile", "browse", "applications"] as Tab[]).map((item) => <button key={item} className={`tab ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item === "overview" ? "Recommended" : item === "applications" ? "My applications" : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {message && <div className="notice notice-success" style={{ marginBottom: 16 }}>{message}</div>}{error && <div className="notice notice-error" style={{ marginBottom: 16 }}>{error}</div>}
    {tab === "overview" && <section className="stack"><div className="row between"><div><h2>Recommended jobs</h2><p className="muted small">Top matches ranked by semantic similarity. Scores are similarity indicators, not hiring probabilities.</p></div><button className="button button-secondary" onClick={() => void load()}>Refresh</button></div><div className="grid grid-2">{recommendations.length ? recommendations.map((job) => <JobCard key={job.jobId} job={{ job_id: job.jobId, title: job.title, company_name: job.companyName, requiredSkills: job.requiredSkills } as Job} score={job.similarityScore} applied={appliedIds.has(job.jobId)} onApply={apply} />) : <div className="card empty">No recommendations yet. Update your profile and skills to build your matches.</div>}</div></section>}
    {tab === "profile" && <section className="grid grid-2"><form className="card stack" onSubmit={saveProfile}><div><h2>Your profile</h2><p className="muted small">Keep your education and background current.</p></div><div className="field"><label>Full name</label><input className="input" value={profile.fullName ?? ""} disabled /></div><div className="form-grid"><div className="field"><label>University</label><input className="input" value={profileForm.university} onChange={(e) => setProfileForm({ ...profileForm, university: e.target.value })} /></div><div className="field"><label>Degree</label><input className="input" value={profileForm.degree} onChange={(e) => setProfileForm({ ...profileForm, degree: e.target.value })} /></div><div className="field"><label>Graduation year</label><input className="input" type="number" value={profileForm.graduationYear} onChange={(e) => setProfileForm({ ...profileForm, graduationYear: e.target.value })} /></div><div className="field full"><label>Bio</label><textarea className="textarea" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} /></div></div><button className="button button-primary">Save profile</button></form><form className="card stack" onSubmit={saveSkills}><div><h2>Skills</h2><p className="muted small">Select skills and optionally add a proficiency from 1 to 5.</p></div><div className="stack">{allSkills.map((skill) => { const selected = skillValues[skill.skill_id] !== undefined; return <div className="skill-option" key={skill.skill_id}><input type="checkbox" checked={selected} onChange={(e) => setSkillValues({ ...skillValues, [skill.skill_id]: e.target.checked ? 3 : undefined })} /><span>{skill.name}</span>{selected && <input className="input" type="number" min={1} max={5} value={skillValues[skill.skill_id] ?? ""} onChange={(e) => setSkillValues({ ...skillValues, [skill.skill_id]: Number(e.target.value) })} />}</div>; })}</div><button className="button button-primary">Save skills</button></form></section>}
    {tab === "browse" && <section className="stack"><div className="row between"><div><h2>Browse open jobs</h2><p className="muted small">Search the live MySQL job catalogue.</p></div><input className="input" style={{ maxWidth: 300 }} placeholder="Search title, company, skill…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="grid grid-2">{filteredJobs.length ? filteredJobs.map((job) => <JobCard key={job.job_id} job={job} applied={appliedIds.has(job.job_id)} onApply={apply} />) : <div className="card empty">No open jobs match your search.</div>}</div></section>}
    {tab === "applications" && <section className="card"><h2>My applications</h2><p className="muted small" style={{ marginBottom: 18 }}>Track the latest status from recruiters.</p>{applications.length ? <div className="table-wrap"><table><thead><tr><th>Role</th><th>Company</th><th>Status</th><th>Applied</th></tr></thead><tbody>{applications.map((application) => <tr key={application.application_id}><td><strong>{application.title}</strong></td><td>{application.company_name}</td><td><span className={`pill ${application.status === "selected" ? "pill-green" : application.status === "rejected" ? "pill-red" : "pill-amber"}`}>{application.status}</span></td><td className="muted">{new Date(application.applied_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <div className="empty">You have not applied to any jobs yet.</div>}</section>}
  </Shell>;
}

function JobCard({ job, score, applied, onApply }: { job: Job; score?: number; applied: boolean; onApply: (id: string) => void }) {
  return <article className="card stack"><div className="row between"><div><h3>{job.title}</h3><p className="muted small">{job.company_name}</p></div>{score !== undefined && <span className="score">{scoreLabel(score)}</span>}</div>{job.description && <p>{job.description}</p>}<div className="skill-list">{(job.requiredSkills ?? []).map((skill) => <span className="pill" key={skill}>{skill}</span>)}</div><div className="row between"><span className="muted small">{job.location ?? (job.is_remote ? "Remote" : "Location not specified")}</span><button className="button button-primary" disabled={applied} onClick={() => onApply(job.job_id)}>{applied ? "Applied" : "Apply"}</button></div></article>;
}
