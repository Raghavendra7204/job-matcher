import mysql from "mysql2/promise";

const mysqlPort = Number(process.env.MYSQL_PORT ?? 3306);

export const db = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "localhost",
  port: mysqlPort,
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? "job_matcher",
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS ?? 10000),
});
