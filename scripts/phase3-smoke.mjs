import mysql from "mysql2/promise";
import { ChromaClient } from "chromadb";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();
const baseUrl = "http://localhost:3000";
const stamp = Date.now();
const studentEmail = `phase3.smoke.student.${stamp}@example.test`;
const recruiterEmail = `phase3.smoke.recruiter.${stamp}@example.test`;
const password = "Phase3Smoke!123";
const companyName = `Phase 3 Smoke Company ${stamp}`;
const mysqlConfig = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

function jar() { return { cookie: "" }; }

async function call(method, path, session, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(session.cookie ? { cookie: session.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.getSetCookie?.()[0];
  if (setCookie) session.cookie = setCookie.split(";", 1)[0];
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 200) }; }
  return { status: response.status, body: parsed };
}

const studentSession = jar();
const recruiterSession = jar();
let studentId;
let recruiterId;
let testJobId;
let testCompanyId;
const results = {};

try {
  results.unauthenticatedMe = (await call("GET", "/api/auth/me", jar())).status;
  const studentRegistration = await call("POST", "/api/auth/register", studentSession, { email: studentEmail, password, fullName: "Phase 3 Smoke Student", role: "student" });
  results.studentRegistration = studentRegistration.status;
  studentId = studentRegistration.body.userId;
  results.studentMe = (await call("GET", "/api/auth/me", studentSession)).status;
  results.profileUpdate = (await call("PATCH", "/api/students/me/profile", studentSession, { university: "Smoke University", degree: "B.S. Computer Science", graduationYear: 2028, bio: "Smoke test profile" })).status;
  results.skillsUpdate = (await call("PUT", "/api/students/me/skills", studentSession, { skills: [{ skillId: 1, proficiency: 5 }, { skillId: 2, proficiency: 4 }] })).status;
  results.jobList = (await call("GET", "/api/jobs", studentSession)).status;

  const recruiterRegistration = await call("POST", "/api/auth/register", recruiterSession, { email: recruiterEmail, password, fullName: "Phase 3 Smoke Recruiter", role: "recruiter", companyName, designation: "Smoke Recruiter" });
  results.recruiterRegistration = recruiterRegistration.status;
  recruiterId = recruiterRegistration.body.userId;
  testCompanyId = recruiterRegistration.body.companyId ?? undefined;
  results.recruiterProfile = (await call("GET", "/api/recruiters/me/profile", recruiterSession)).status;
  const jobCreation = await call("POST", "/api/recruiters/me/jobs", recruiterSession, { title: "Phase 3 Smoke Internship", description: "Build backend services with Python and MySQL.", jobType: "internship", location: "Remote", isRemote: true, requiredSkillIds: [1, 2] });
  results.jobCreation = jobCreation.status;
  testJobId = jobCreation.body.jobId;
  results.jobUpdate = (await call("PATCH", `/api/recruiters/me/jobs/${testJobId}`, recruiterSession, { title: "Phase 3 Updated Internship", requiredSkillIds: [2] })).status;
  results.recruiterJobs = (await call("GET", "/api/recruiters/me/jobs", recruiterSession)).status;

  const application = await call("POST", "/api/students/me/applications", studentSession, { jobId: testJobId, coverNote: "Smoke application" });
  results.application = application.status;
  results.duplicateApplication = (await call("POST", "/api/students/me/applications", studentSession, { jobId: testJobId })).status;
  results.studentApplications = (await call("GET", "/api/students/me/applications", studentSession)).status;
  const recruiterApplications = await call("GET", `/api/recruiters/me/jobs/${testJobId}/applications`, recruiterSession);
  results.recruiterApplications = recruiterApplications.status;
  const applicationId = recruiterApplications.body.applications?.[0]?.application_id;
  results.applicationStatusUpdate = (await call("PATCH", `/api/recruiters/me/applications/${applicationId}`, recruiterSession, { status: "shortlisted" })).status;

  results.studentSemantic = (await call("GET", `/api/students/${studentId}/semantic-match`, studentSession)).status;
  results.studentSemanticCount = (await call("GET", `/api/students/${studentId}/semantic-match`, studentSession)).body.jobs?.length ?? 0;
  results.studentOtherIdForbidden = (await call("GET", "/api/students/u2222222-2222-2222-2222-111111111111/semantic-match", studentSession)).status;
  results.recruiterSemantic = (await call("GET", `/api/jobs/${testJobId}/semantic-match`, recruiterSession)).status;
  results.recruiterOtherJobHidden = (await call("GET", "/api/jobs/j1111111-1111-1111-1111-111111111111/semantic-match", recruiterSession)).status;
  results.studentRoleOnRecruiterRoute = (await call("GET", "/api/recruiters/me/profile", studentSession)).status;
  results.logout = (await call("POST", "/api/auth/logout", studentSession)).status;
  results.afterLogout = (await call("GET", "/api/auth/me", studentSession)).status;
  console.log(JSON.stringify({ results, studentId, recruiterId, testJobId }, null, 2));
} finally {
  const db = await mysql.createConnection(mysqlConfig);
  const [users] = await db.query("SELECT user_id FROM users WHERE email IN (?, ?)", [studentEmail, recruiterEmail]);
  const userIds = users.map((user) => user.user_id);
  const [jobs] = await db.query("SELECT job_id FROM jobs WHERE recruiter_id IN (?)", [userIds.length ? userIds : ["__none__"]]);
  const chromaUrl = new URL(process.env.CHROMA_URL ?? "http://localhost:8000");
  const chroma = new ChromaClient({ host: chromaUrl.hostname, port: Number(chromaUrl.port || 80), ssl: chromaUrl.protocol === "https:" });
  try {
    if (studentId) await (await chroma.getCollection({ name: "student_embeddings" })).delete({ ids: [studentId] });
    if (jobs.length) await (await chroma.getCollection({ name: "job_embeddings" })).delete({ ids: jobs.map((job) => job.job_id) });
  } finally {
    if (userIds.length) await db.query("DELETE FROM users WHERE user_id IN (?)", [userIds]);
    if (testCompanyId) await db.query("DELETE FROM companies WHERE company_id = ?", [testCompanyId]);
    else await db.query("DELETE FROM companies WHERE name = ?", [companyName]);
    await db.end();
  }
}
