# Testing record

This document distinguishes final-phase verification from earlier functional
testing.

## Final-phase checks

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run check:mysql` | Passed; MySQL 8.0.46, `job_matcher` |
| `npm run check:chroma` | Passed; 6 student and 8 job records in the current database |
| `npm run build` | Passed; all App Router pages and API routes generated |
| `node scripts/verify-sql-demonstrations.mjs` | Executed successfully against the existing database |
| `node scripts/verify-db-integrity.mjs` | Duplicate, CHECK, FK, and orphan checks passed |

The demonstrations in [sql-demonstrations.sql](./sql-demonstrations.sql) cover
joins, outer joins, grouping, `HAVING`, aggregates, ordering, subqueries, the
stored procedure, index inspection, and `EXPLAIN`.

## Earlier-phase functional verification

The Phase 3 smoke test used disposable records and cleaned them up:

- Student and recruiter registration, login, session persistence, and logout
- Role restrictions and ownership checks
- Student profile and skill updates
- Job listing and application submission
- Duplicate application prevention (`409`)
- Recruiter job creation and update
- Recruiter application listing and status update
- Student and recruiter semantic matching with five ordered results
- Cross-user and cross-recruiter access rejection

## Integrity evidence

The schema inspection confirms primary keys, foreign keys, unique constraints,
status/proficiency/stipend checks, application triggers, job validation
triggers, junction-table relationships, and the duplicate application key.
The demonstration procedure and `EXPLAIN` statements are read-only.

No seed records or existing user-created records were reset during final
verification. Temporary smoke-test users, jobs, applications, companies, and
their Chroma vectors were removed using unique test prefixes.

The original seed contains seven jobs. The current database contains one
additional user-created TechCorp job, so the live Chroma job collection has
eight records. That record was intentionally preserved.

## Known warning

The production build emits a non-blocking webpack warning from the ChromaDB
package about a dynamic dependency. It does not prevent compilation or
runtime connectivity.
