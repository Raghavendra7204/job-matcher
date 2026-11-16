-- Job Matcher DBMS SQL demonstrations
-- Read-only examples for MySQL 8.0.
-- Run with: mysql -u <user> -p job_matcher < docs/sql-demonstrations.sql
USE job_matcher;

-- 1. Basic SELECT with WHERE: currently open jobs.
SELECT job_id, title, status, application_deadline FROM jobs WHERE status = 'open';

-- 2. INNER JOIN: jobs and the companies that posted them.
SELECT j.title, c.name AS company_name
FROM jobs AS j
INNER JOIN recruiters AS r ON r.recruiter_id = j.recruiter_id
INNER JOIN companies AS c ON c.company_id = r.company_id
ORDER BY c.name, j.title;

-- 3. LEFT JOIN: include students even when they have no recorded skills.
SELECT s.student_id, u.full_name, sk.name AS skill_name, ss.proficiency
FROM students AS s
INNER JOIN users AS u ON u.user_id = s.student_id
LEFT JOIN student_skills AS ss ON ss.student_id = s.student_id
LEFT JOIN skills AS sk ON sk.skill_id = ss.skill_id
ORDER BY u.full_name, sk.name;

-- 4. Join across six tables: applications with student, job, and company data.
SELECT a.application_id, u.full_name AS student_name, j.title, c.name AS company_name, a.status
FROM applications AS a
INNER JOIN students AS s ON s.student_id = a.student_id
INNER JOIN users AS u ON u.user_id = s.student_id
INNER JOIN jobs AS j ON j.job_id = a.job_id
INNER JOIN recruiters AS r ON r.recruiter_id = j.recruiter_id
INNER JOIN companies AS c ON c.company_id = r.company_id
ORDER BY a.applied_at DESC;

-- 5. GROUP BY: number of jobs posted by each company.
SELECT c.company_id, c.name, COUNT(j.job_id) AS job_count
FROM companies AS c
LEFT JOIN recruiters AS r ON r.company_id = c.company_id
LEFT JOIN jobs AS j ON j.recruiter_id = r.recruiter_id
GROUP BY c.company_id, c.name
ORDER BY job_count DESC, c.name;

-- 6. HAVING: companies with at least one application.
SELECT c.name, COUNT(a.application_id) AS application_count
FROM companies AS c
INNER JOIN recruiters AS r ON r.company_id = c.company_id
INNER JOIN jobs AS j ON j.recruiter_id = r.recruiter_id
INNER JOIN applications AS a ON a.job_id = j.job_id
GROUP BY c.company_id, c.name
HAVING COUNT(a.application_id) > 0
ORDER BY application_count DESC;

-- 7. COUNT: application totals by current status.
SELECT status, COUNT(*) AS application_count
FROM applications
GROUP BY status
ORDER BY application_count DESC;

-- 8. AVG aggregate: average stored match score by job.
SELECT j.job_id, j.title, AVG(a.match_score) AS average_match_score
FROM jobs AS j
LEFT JOIN applications AS a ON a.job_id = j.job_id
GROUP BY j.job_id, j.title
ORDER BY average_match_score DESC;

-- 9. ORDER BY: highest stored application match scores first.
SELECT application_id, job_id, student_id, match_score, status
FROM applications
ORDER BY match_score DESC, applied_at ASC;

-- 10. Subquery: jobs whose application count is above the overall average.
SELECT j.job_id, j.title
FROM jobs AS j
WHERE (SELECT COUNT(*) FROM applications AS a WHERE a.job_id = j.job_id) >
      (SELECT AVG(application_count)
       FROM (SELECT COUNT(*) AS application_count FROM applications GROUP BY job_id) AS totals);

-- 11. Stored procedure: skill-overlap candidates for a seeded job.
CALL match_students_for_job('j1111111-1111-1111-1111-111111111111');

-- 12. Trigger inspection: verify the job and application trigger definitions.
SHOW TRIGGERS LIKE 'jobs';
SHOW TRIGGERS LIKE 'applications';

-- 13. Trigger audit data: application status changes are recorded here.
SELECT application_id, old_status, new_status, changed_at
FROM application_status_log
ORDER BY changed_at DESC;

-- 14. Index inspection: verify relational and FULLTEXT indexes.
SHOW INDEX FROM jobs;
SHOW INDEX FROM applications;

-- 15. Query plan inspection: review a common job listing query.
EXPLAIN
SELECT j.job_id, j.title, c.name AS company_name
FROM jobs AS j
INNER JOIN recruiters AS r ON r.recruiter_id = j.recruiter_id
INNER JOIN companies AS c ON c.company_id = r.company_id
WHERE j.status = 'open'
  AND (j.application_deadline IS NULL OR j.application_deadline >= CURDATE())
ORDER BY j.created_at DESC;
