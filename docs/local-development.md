# Local development foundation

## Environment

Copy `.env.example` to `.env.local` and replace the MySQL password with the
password for your local MySQL account. Never commit `.env.local`.

Set `SESSION_SECRET` to a long random value. The local fallback is intended
only for development; production requires this variable.

The seed accounts intentionally share the non-secret development password
`ChangeMe123!`. Use these accounts only in a disposable local database.

Example accounts:

- Student: `emily@mit.edu`
- Recruiter: `alice@techcorp.com`
- Admin: `admin1@platform.com`

## MySQL

Run the scripts with the MySQL 8 client from PowerShell:

```powershell
mysql -u root -p < schema.sql
mysql -u root -p job_matcher < seed_data.sql
```

The schema creates missing objects and does not drop tables. The seed uses
primary-key upserts and can be rerun without duplicate rows.

## ChromaDB

Install/run ChromaDB separately, for example in a Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install chromadb
chroma run --path .\chroma_data --host localhost --port 8000
```

The application uses the local `Xenova/all-MiniLM-L6-v2` embedding model,
which produces 384-dimensional vectors, and cosine distance for both
collections.

## Verification and app

```powershell
npm install
npm run check:mysql
npm run check:chroma
npm run embeddings:backfill
npm run typecheck
npm run dev
```

For a disposable end-to-end backend smoke test, with Next.js already running:

```powershell
node scripts/phase3-smoke.mjs
```

Connectivity checks report an error if the corresponding service is not
running; they do not create application records.

## Semantic matching endpoints

After backfill, the two local-development endpoints are:

```text
GET /api/students/{student_id}/semantic-match
GET /api/jobs/{job_id}/semantic-match
```

Both return cosine-derived `similarityScore` values using `1 - distance`.
They return only public matching fields and do not expose email addresses.
Role-based authorization must be added before exposing either route beyond
local development.
