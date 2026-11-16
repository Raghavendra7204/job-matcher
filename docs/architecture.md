# Job Matcher architecture

```text
Student / Recruiter browser
            |
            v
     Next.js 15 frontend
            |
            v
     Next.js API routes
        /          \
       v            v
 MySQL 8.0      ChromaDB
structured      vector search
records         embeddings
```

## System responsibilities

The App Router pages provide `/login`, `/register`, `/student`, and
`/recruiter`. They call the existing API routes and never store session tokens
in localStorage.

MySQL stores identities, profiles, companies, jobs, skills, applications, and
application status history. Constraints, indexes, and triggers enforce the
relational rules. MySQL is the source of truth for structured data.

ChromaDB stores embeddings in two collections:

- `student_embeddings`: IDs equal `students.student_id`
- `job_embeddings`: IDs equal `jobs.job_id`

Both use `Xenova/all-MiniLM-L6-v2`, 384 dimensions, and cosine distance.

Registration creates the user/profile rows in a MySQL transaction. Login uses
bcrypt verification and creates a seven-day HMAC-signed HTTP-only cookie.
Protected routes validate the cookie, enforce the role, and perform recruiter
ownership checks.

Student profile/skill changes refresh the student embedding. Job creation and
updates refresh the job embedding. Application changes do not touch embeddings
because they do not change the meaning of a profile or job.

For student-to-job matching, the API retrieves the student's vector from
ChromaDB, queries `job_embeddings`, filters IDs through MySQL for open and
eligible jobs, and enriches results with company and required-skill data.
Recruiter-to-student matching performs the inverse operation after verifying
job ownership.

MySQL provides transactions, constraints, joins, and audit history; ChromaDB
provides semantic nearest-neighbor retrieval.
