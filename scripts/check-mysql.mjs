import mysql from "mysql2/promise";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? "job_matcher",
  connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS ?? 10000),
});

try {
  const [rows] = await connection.query("SELECT VERSION() AS version, DATABASE() AS database_name");
  console.log("MySQL connectivity OK", rows[0]);
} finally {
  await connection.end();
}
