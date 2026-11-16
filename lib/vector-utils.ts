export interface StudentProfileData {
  bio?: string | null;
  university?: string | null;
  degree?: string | null;
  graduationYear?: number | null;
  projects?: string[] | string | null;
  projectExperience?: string[] | string | null;
  experience?: string[] | string | null;
  skills?: Array<string | { name?: string | null }> | string[] | string | null;
}

export interface JobDescriptionData {
  title?: string | null;
  description?: string | null;
  location?: string | null;
  isRemote?: boolean | null;
  jobType?: string | null;
  requiredSkills?: Array<string | { name?: string | null }> | string[] | string | null;
  skills?: Array<string | { name?: string | null }> | string[] | string | null;
}

function compact(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function listText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item : item && typeof item === "object"
          ? compact((item as { name?: unknown }).name)
          : ""
      )
      .filter(Boolean)
      .join(", ");
  }

  return compact(value);
}

export function formatStudentProfileText(studentData: StudentProfileData): string {
  const projectExperience =
    studentData.projectExperience ?? studentData.projects ?? studentData.experience;

  return [
    "Student Profile",
    `Bio: ${compact(studentData.bio) || "Not provided"}`,
    `University: ${compact(studentData.university) || "Not provided"}`,
    `Degree: ${compact(studentData.degree) || "Not provided"}`,
    studentData.graduationYear
      ? `Graduation Year: ${studentData.graduationYear}`
      : "Graduation Year: Not provided",
    `Project Experience: ${listText(projectExperience) || "Not provided"}`,
    `Skills: ${listText(studentData.skills) || "Not provided"}`,
  ].join("\n");
}

export function formatJobDescriptionText(jobData: JobDescriptionData): string {
  const skills = jobData.requiredSkills ?? jobData.skills;
  const location =
    jobData.location && jobData.location.trim()
      ? jobData.location.trim()
      : jobData.isRemote
        ? "Remote"
        : "Not specified";

  return [
    "Job Description",
    `Title: ${compact(jobData.title) || "Not provided"}`,
    `Description: ${compact(jobData.description) || "Not provided"}`,
    `Location: ${location}`,
    `Job Type: ${compact(jobData.jobType) || "Not provided"}`,
    `Required Skills: ${listText(skills) || "Not provided"}`,
  ].join("\n");
}
