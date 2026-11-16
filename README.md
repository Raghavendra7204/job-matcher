# Job Matcher

Job Matcher is a DBMS Level 3 project connecting students with recruiters using
structured relational data and semantic similarity search.

## Features

- Student and recruiter registration/login with bcrypt password hashing
- HTTP-only cookie sessions and role-based authorization
- Student profiles, skills, job browsing, applications, and status tracking
- Recruiter company profiles, job posting/editing, candidate matching, and
  application review
- Bidirectional semantic matching using ChromaDB
- MySQL constraints, foreign keys, indexes, triggers, full-text indexing, and
  a skill-overlap stored procedure

## Technology stack

- Next.js 15, React 19, TypeScript
- MySQL 8.0 for relational data
- ChromaDB for vector storage and similarity search
- `Xenova/all-MiniLM-L6-v2`, 384-dimensional embeddings, cosine distance

## Windows setup

Requirements: Node.js 20+, MySQL 8.0, and Python 3.10+.

```cmd
npm install
copy .env.example .env.local
```

Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_DATABASE`, `CHROMA_URL`, and a long random `SESSION_SECRET` in
`.env.local`. Never commit that file.

## Initialize MySQL

```cmd
mysql -u root -p < schema.sql
mysql -u root -p job_matcher < seed_data.sql
```

The schema creates missing objects without dropping tables. The seed uses
upserts and is safe to rerun for local development.

## Start ChromaDB

```cmd
python -m venv .venv
.venv\Scripts\activate
python -m pip install chromadb
chroma run --path .\chroma_data --host localhost --port 8000
```

Backfill existing records:

```cmd
npm run embeddings:backfill
```

## Run and verify

```cmd
npm run check:mysql
npm run check:chroma
npm run typecheck
npm run dev
```

Open `http://localhost:3000/login`.

Production verification:

```cmd
npm run build
npm start
```

## Development accounts

Seed accounts use the intentionally non-secret local password `ChangeMe123!`.
Example accounts include `emily@mit.edu` and `alice@techcorp.com`. Use these
only in a local development database.

## SQL demonstrations

```cmd
mysql -u root -p job_matcher < docs\sql-demonstrations.sql
```

To verify the same demonstrations statement-by-statement without changing
data:

```cmd
node scripts\verify-sql-demonstrations.mjs
```

Verify relational integrity using rollback-only constraint tests:

```cmd
node scripts\verify-db-integrity.mjs
```

See also:

- [Database schema](docs/database-schema.md)
- [Architecture](docs/architecture.md)
- [Testing record](docs/testing.md)
- [Local development](docs/local-development.md)
