import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const url = process.env.CHROMA_URL ?? "http://localhost:8000";
const chromaUrl = new URL(url);
const embeddingFunction = new DefaultEmbeddingFunction({
  modelName: "Xenova/all-MiniLM-L6-v2",
  dtype: "fp32",
});
const client = new ChromaClient({
  host: chromaUrl.hostname,
  port: Number(chromaUrl.port || (chromaUrl.protocol === "https:" ? 443 : 80)),
  ssl: chromaUrl.protocol === "https:",
});

const collectionOptions = {
  embeddingFunction,
  metadata: {
    "hnsw:space": "cosine",
    embedding_model: "Xenova/all-MiniLM-L6-v2",
    embedding_dimensions: 384,
  },
};

const studentCollection = await client.getOrCreateCollection({
  name: "student_embeddings",
  ...collectionOptions,
});
const jobCollection = await client.getOrCreateCollection({
  name: "job_embeddings",
  ...collectionOptions,
});

console.log("ChromaDB connectivity OK", {
  url,
  studentCollection: await studentCollection.count(),
  jobCollection: await jobCollection.count(),
  embeddingModel: "Xenova/all-MiniLM-L6-v2",
  dimensions: 384,
  metric: "cosine",
});
