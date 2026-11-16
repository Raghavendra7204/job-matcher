import { ChromaClient, type Collection } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import {
  formatJobDescriptionText,
  formatStudentProfileText,
  type JobDescriptionData,
  type StudentProfileData,
} from "@/lib/vector-utils";

export const CHROMA_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const CHROMA_EMBEDDING_DIMENSIONS = 384;
export const CHROMA_DISTANCE_METRIC = "cosine" as const;
const chromaUrl = new URL(process.env.CHROMA_URL ?? "http://localhost:8000");

export const chromaClient = new ChromaClient({
  host: chromaUrl.hostname,
  port: Number(chromaUrl.port || (chromaUrl.protocol === "https:" ? 443 : 80)),
  ssl: chromaUrl.protocol === "https:",
});

// Both collections must use the same local 384-dimensional model. Keeping
// the embedding function in this module also prevents accidental drift
// between writes and queries.
export const embeddingFunction = new DefaultEmbeddingFunction({
  modelName: CHROMA_EMBEDDING_MODEL,
  dtype: "fp32",
});

const collectionOptions = {
  embeddingFunction,
  metadata: {
    "hnsw:space": CHROMA_DISTANCE_METRIC,
    embedding_model: CHROMA_EMBEDDING_MODEL,
    embedding_dimensions: CHROMA_EMBEDDING_DIMENSIONS,
  },
};

let studentCollectionPromise: Promise<Collection> | undefined;
let jobCollectionPromise: Promise<Collection> | undefined;

export async function getStudentEmbeddingCollection(): Promise<Collection> {
  studentCollectionPromise ??= chromaClient.getOrCreateCollection({
    name: "student_embeddings",
    ...collectionOptions,
  });
  return studentCollectionPromise;
}

export async function getJobEmbeddingCollection(): Promise<Collection> {
  jobCollectionPromise ??= chromaClient.getOrCreateCollection({
    name: "job_embeddings",
    ...collectionOptions,
  });
  return jobCollectionPromise;
}

export async function upsertStudentEmbedding(
  studentId: string,
  profileData: StudentProfileData
): Promise<void> {
  const collection = await getStudentEmbeddingCollection();
  await collection.upsert({
    ids: [studentId],
    documents: [formatStudentProfileText(profileData)],
    metadatas: [{ student_id: studentId }],
  });
}

export async function upsertJobEmbedding(
  jobId: string,
  jobData: JobDescriptionData
): Promise<void> {
  const collection = await getJobEmbeddingCollection();
  await collection.upsert({
    ids: [jobId],
    documents: [formatJobDescriptionText(jobData)],
    metadatas: [{ job_id: jobId }],
  });
}
