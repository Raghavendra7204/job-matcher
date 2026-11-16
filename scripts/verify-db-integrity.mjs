import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

async function rollbackTest(label, statement, values, expectedCodes) {
  await db.beginTransaction();
  try {
    await db.execute(statement, values);
    await db.rollback();
    console.log(`${label}: FAILED (statement unexpectedly succeeded)`);
    process.exitCode = 1;
  } catch (error) {
    await db.rollback();
    const code = error.code ?? String(error.errno);
    const passed = expectedCodes.includes(code);
    console.log(`${label}: ${passed ? "OK" : `FAILED (${code})`}`);
    if (!passed) process.exitCode = 1;
  }
}

try {
  await rollbackTest(
    "Duplicate application unique key",
    "INSERT INTO applications (application_id, job_id, student_id, status) VALUES (?, ?, ?, 'applied')",
    [randomUUID(), "j1111111-1111-1111-1111-111111111111", "u2222222-2222-2222-2222-111111111111"],
    ["ER_DUP_ENTRY", "1062"]
  );
  await rollbackTest(
    "Application status CHECK constraint",
    "INSERT INTO applications (application_id, job_id, student_id, status) VALUES (?, ?, ?, 'not-a-status')",
    [randomUUID(), "j1111111-1111-1111-1111-111111111111", "u2222222-2222-2222-2222-222222222222"],
    ["ER_CHECK_CONSTRAINT_VIOLATED", "3819"]
  );
  await rollbackTest(
    "Student-skill foreign key",
    "INSERT INTO student_skills (student_id, skill_id, proficiency) VALUES (?, ?, 3)",
    [randomUUID(), 1],
    ["ER_NO_REFERENCED_ROW_2", "1452"]
  );

  const orphanQueries = [
    ["Orphan student skills", "SELECT COUNT(*) AS count FROM student_skills ss LEFT JOIN students s ON s.student_id = ss.student_id WHERE s.student_id IS NULL"],
    ["Orphan job skills", "SELECT COUNT(*) AS count FROM job_skills js LEFT JOIN jobs j ON j.job_id = js.job_id WHERE j.job_id IS NULL"],
    ["Orphan applications", "SELECT COUNT(*) AS count FROM applications a LEFT JOIN jobs j ON j.job_id = a.job_id LEFT JOIN students s ON s.student_id = a.student_id WHERE j.job_id IS NULL OR s.student_id IS NULL"],
    ["Orphan status logs", "SELECT COUNT(*) AS count FROM application_status_log l LEFT JOIN applications a ON a.application_id = l.application_id WHERE a.application_id IS NULL"],
  ];
  for (const [label, query] of orphanQueries) {
    const [rows] = await db.query(query);
    const count = Number(rows[0].count);
    console.log(`${label}: ${count === 0 ? "OK" : `FAILED (${count})`}`);
    if (count !== 0) process.exitCode = 1;
  }
} finally {
  await db.end();
}
