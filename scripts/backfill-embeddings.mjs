import mysql from "mysql2/promise";
import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const embeddingModel = "Xenova/all-MiniLM-L6-v2";
const embeddingDimensions = 384;
const distanceMetric = "cosine";

const db = await mysql.createPool({
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? "job_matcher",
  waitForConnections: true,
  connectionLimit: 4,
  connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS ?? 10000),
});

const chromaUrl = new URL(process.env.CHROMA_URL ?? "http://localhost:8000");
const chroma = new ChromaClient({
  host: chromaUrl.hostname,
  port: Number(chromaUrl.port || (chromaUrl.protocol === "https:" ? 443 : 80)),
  ssl: chromaUrl.protocol === "https:",
});
const embeddingFunction = new DefaultEmbeddingFunction({
  modelName: embeddingModel,
  dtype: "fp32",
});
const collectionOptions = {
  embeddingFunction,
  metadata: {
    "hnsw:space": distanceMetric,
    embedding_model: embeddingModel,
    embedding_dimensions: embeddingDimensions,
  },
};

function formatStudentProfileText(student) {
  return [
    "Student Profile",
    `Bio: ${student.bio?.trim() || "Not provided"}`,
    `University: ${student.university?.trim() || "Not provided"}`,
    `Degree: ${student.degree?.trim() || "Not provided"}`,
    student.graduation_year
      ? `Graduation Year: ${student.graduation_year}`
      : "Graduation Year: Not provided",
    "Project Experience: Not provided",
    `Skills: ${student.skills?.trim() || "Not provided"}`,
  ].join("\n");
}

function formatJobDescriptionText(job) {
  const location = job.location?.trim() || (job.is_remote ? "Remote" : "Not specified");
  return [
    "Job Description",
    `Title: ${job.title?.trim() || "Not provided"}`,
    `Description: ${job.description?.trim() || "Not provided"}`,
    `Location: ${location}`,
    `Job Type: ${job.job_type?.trim() || "Not provided"}`,
    `Required Skills: ${job.required_skills?.trim() || "Not provided"}`,
  ].join("\n");
}

try {
  const [students] = await db.query(`
    SELECT
      s.student_id,
      s.university,
      s.degree,
      s.graduation_year,
      s.bio,
      GROUP_CONCAT(sk.name ORDER BY sk.name SEPARATOR ', ') AS skills
    FROM students s
    LEFT JOIN student_skills ss ON ss.student_id = s.student_id
    LEFT JOIN skills sk ON sk.skill_id = ss.skill_id
    GROUP BY s.student_id, s.university, s.degree, s.graduation_year, s.bio
    ORDER BY s.student_id
  `);

  const [jobs] = await db.query(`
    SELECT
      j.job_id,
      j.title,
      j.description,
      j.location,
      j.is_remote,
      j.job_type,
      GROUP_CONCAT(
        CASE WHEN js.is_required = TRUE THEN sk.name END
        ORDER BY sk.name SEPARATOR ', '
      ) AS required_skills
    FROM jobs j
    LEFT JOIN job_skills js ON js.job_id = j.job_id
    LEFT JOIN skills sk ON sk.skill_id = js.skill_id
    GROUP BY j.job_id, j.title, j.description, j.location, j.is_remote, j.job_type
    ORDER BY j.job_id
  `);

  const studentCollection = await chroma.getOrCreateCollection({
    name: "student_embeddings",
    ...collectionOptions,
  });
  const jobCollection = await chroma.getOrCreateCollection({
    name: "job_embeddings",
    ...collectionOptions,
  });

  if (students.length > 0) {
    await studentCollection.upsert({
      ids: students.map((student) => student.student_id),
      documents: students.map(formatStudentProfileText),
      metadatas: students.map((student) => ({
        student_id: student.student_id,
        embedding_model: embeddingModel,
        embedding_dimensions: embeddingDimensions,
      })),
    });
  }

  if (jobs.length > 0) {
    await jobCollection.upsert({
      ids: jobs.map((job) => job.job_id),
      documents: jobs.map(formatJobDescriptionText),
      metadatas: jobs.map((job) => ({
        job_id: job.job_id,
        embedding_model: embeddingModel,
        embedding_dimensions: embeddingDimensions,
      })),
    });
  }

  console.log("Embedding backfill complete", {
    studentsProcessed: students.length,
    jobsProcessed: jobs.length,
    studentCollectionCount: await studentCollection.count(),
    jobCollectionCount: await jobCollection.count(),
    embeddingModel,
    embeddingDimensions,
    distanceMetric,
  });
} finally {
  await db.end();
}
