import fs from "node:fs/promises";
import mysql from "mysql2/promise";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();
const source = await fs.readFile("docs/sql-demonstrations.sql", "utf8");
const statements = source
  .split(/\r?\n/u)
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: false,
});

try {
  for (let index = 0; index < statements.length; index += 1) {
    const [result] = await db.query(statements[index]);
    const rows = Array.isArray(result) ? result.length : undefined;
    console.log(`SQL demonstration ${index + 1}/${statements.length}: OK${rows === undefined ? "" : ` (${rows} rows)`}`);
  }
  console.log("SQL demonstrations verified without data changes.");
} finally {
  await db.end();
}
