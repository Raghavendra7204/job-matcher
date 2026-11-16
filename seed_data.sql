-- Job Matcher development seed data for MySQL 8.
--
-- This script is safe to rerun: every entity uses an upsert keyed by its
-- primary key (or its declared unique key). It does not TRUNCATE or delete
-- existing records. All accounts use the intentionally non-secret local
-- development password documented in docs/local-development.md.
USE job_matcher;

-- ==========================================
-- 1. USERS TABLE (12 Users: 2 Admins, 4 Recruiters, 6 Students)
-- ==========================================
INSERT INTO users (user_id, email, password_hash, role, full_name) VALUES
-- Admins
('u0000000-0000-0000-0000-000000000001', 'admin1@platform.com', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'admin', 'System Admin'),
('u0000000-0000-0000-0000-000000000002', 'admin2@platform.com', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'admin', 'Super Admin'),
-- Recruiters
('u1111111-1111-1111-1111-111111111111', 'alice@techcorp.com', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'recruiter', 'Alice Johnson'),
('u1111111-1111-1111-1111-222222222222', 'bob@innovate.io', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'recruiter', 'Bob Smith'),
('u1111111-1111-1111-1111-333333333333', 'carol@cloudscale.net', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'recruiter', 'Carol Williams'),
('u1111111-1111-1111-1111-444444444444', 'david@fintech.com', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'recruiter', 'David Lee'),
-- Students
('u2222222-2222-2222-2222-111111111111', 'emily@mit.edu', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'student', 'Emily Davis'),
('u2222222-2222-2222-2222-222222222222', 'frank@stanford.edu', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'student', 'Frank Miller'),
('u2222222-2222-2222-2222-333333333333', 'grace@berkeley.edu', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'student', 'Grace Wilson'),
('u2222222-2222-2222-2222-444444444444', 'henry@cmu.edu', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'student', 'Henry Taylor'),
('u2222222-2222-2222-2222-555555555555', 'isabel@gatech.edu', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'student', 'Isabel Anderson'),
('u2222222-2222-2222-2222-666666666666', 'jack@cornell.edu', '$2b$12$KRKFtXUVaX083M2tePuBQOkyeMRxnTgNGjgiXC/W8/PFTGiRiisSC', 'student', 'Jack Thomas')
ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash), role = VALUES(role), full_name = VALUES(full_name);-- ==========================================
-- 2. COMPANIES TABLE (4 Companies)
-- ==========================================
INSERT INTO companies (company_id, name, website, industry) VALUES
('c1111111-1111-1111-1111-111111111111', 'TechCorp', 'https://techcorp.com', 'Enterprise Software'),
('c2222222-2222-2222-2222-222222222222', 'Innovate Labs', 'https://innovate.io', 'Artificial Intelligence'),
('c3333333-3333-3333-3333-333333333333', 'CloudScale Systems', 'https://cloudscale.net', 'Cloud Computing'),
('c4444444-4444-4444-4444-444444444444', 'FinTech Dynamics', 'https://fintech.com', 'Financial Services')
ON DUPLICATE KEY UPDATE name = VALUES(name), website = VALUES(website), industry = VALUES(industry);

-- ==========================================
-- 3. RECRUITERS TABLE (4 Recruiters mapped to Companies)
-- ==========================================
INSERT INTO recruiters (recruiter_id, company_id, designation) VALUES
('u1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Senior Talent Lead'),
('u1111111-1111-1111-1111-222222222222', 'c2222222-2222-2222-2222-222222222222', 'Tech Recruiter'),
('u1111111-1111-1111-1111-333333333333', 'c3333333-3333-3333-3333-333333333333', 'VP of University Relations'),
('u1111111-1111-1111-1111-444444444444', 'c4444444-4444-4444-4444-444444444444', 'Engineering Hiring Manager')
ON DUPLICATE KEY UPDATE company_id = VALUES(company_id), designation = VALUES(designation);

-- ==========================================
-- 4. STUDENTS TABLE (6 Students)
-- ==========================================
INSERT INTO students (student_id, university, degree, graduation_year, bio) VALUES
('u2222222-2222-2222-2222-111111111111', 'MIT', 'B.S. Computer Science', 2027, 'Interested in distributed backend systems and database internals.'),
('u2222222-2222-2222-2222-222222222222', 'Stanford University', 'M.S. Artificial Intelligence', 2027, 'Focusing on Machine Learning models and Python microservices.'),
('u2222222-2222-2222-2222-333333333333', 'UC Berkeley', 'B.S. Electrical Engineering & CS', 2027, 'Full-stack developer passionate about React, Node.js, and UX design.'),
('u2222222-2222-2222-2222-444444444444', 'Carnegie Mellon', 'B.S. Computer Engineering', 2028, 'DevOps enthusiast with hands-on Docker and Kubernetes skills.'),
('u2222222-2222-2222-2222-555555555555', 'Georgia Tech', 'M.S. Cybersecurity', 2027, 'Passionate about secure REST API architecture and network security.'),
('u2222222-2222-2222-2222-666666666666', 'Cornell University', 'B.S. Data Science', 2027, 'Data analyst skilled in SQL, Pandas, PyTorch, and visualization.')
ON DUPLICATE KEY UPDATE university = VALUES(university), degree = VALUES(degree), graduation_year = VALUES(graduation_year), bio = VALUES(bio);

-- ==========================================
-- 5. SKILLS TABLE (8 Skills)
-- ==========================================
INSERT INTO skills (skill_id, name) VALUES
(1, 'MySQL'),
(2, 'Python'),
(3, 'React'),
(4, 'Docker'),
(5, 'Java'),
(6, 'TypeScript'),
(7, 'Machine Learning'),
(8, 'Kubernetes')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ==========================================
-- 6. JOBS TABLE (7 Jobs - All with future application deadlines)
-- ==========================================
INSERT INTO jobs (job_id, recruiter_id, title, description, job_type, location, is_remote, min_stipend, max_stipend, application_deadline, status) VALUES
('j1111111-1111-1111-1111-111111111111', 'u1111111-1111-1111-1111-111111111111', ' Backend Developer Intern ', 'Build scalable REST APIs using Python, MySQL, and Docker.', 'internship', 'San Francisco, CA', TRUE, 3000.00, 4500.00, '2027-06-30', 'open'),
('j1111111-1111-1111-1111-222222222222', 'u1111111-1111-1111-1111-222222222222', 'AI/ML Research Engineer', 'Train large-scale deep learning models in Python and PyTorch.', 'full-time', 'Palo Alto, CA', FALSE, 8000.00, 12000.00, '2027-08-15', 'open'),
('j1111111-1111-1111-1111-333333333333', 'u1111111-1111-1111-1111-333333333333', 'Cloud Infrastructure Intern', 'Maintain Kubernetes clusters and Docker automated pipelines.', 'internship', 'Seattle, WA', TRUE, 3500.00, 5000.00, '2027-05-30', 'open'),
('j1111111-1111-1111-1111-444444444444', 'u1111111-1111-1111-1111-444444444444', 'Frontend React Developer', 'Develop modern UI web components with TypeScript and React.', 'full-time', 'New York, NY', FALSE, 6000.00, 9000.00, '2027-07-01', 'open'),
('j1111111-1111-1111-1111-555555555555', 'u1111111-1111-1111-1111-111111111111', 'Java Systems Engineer', 'Design high-throughput banking systems using Java and MySQL.', 'full-time', 'Boston, MA', FALSE, 7000.00, 10000.00, '2027-09-01', 'open'),
('j1111111-1111-1111-1111-666666666666', 'u1111111-1111-1111-1111-222222222222', 'Data Science Co-Op', 'Perform quantitative analysis using Python and SQL database queries.', 'contract', 'Remote', TRUE, 2500.00, 3500.00, '2027-04-30', 'open'),
('j1111111-1111-1111-1111-777777777777', 'u1111111-1111-1111-1111-333333333333', 'Legacy Systems Engineer', 'Maintain legacy microservices.', 'full-time', 'Austin, TX', FALSE, 5000.00, 7000.00, '2027-12-31', 'closed')
ON DUPLICATE KEY UPDATE recruiter_id = VALUES(recruiter_id), title = VALUES(title), description = VALUES(description), job_type = VALUES(job_type), location = VALUES(location), is_remote = VALUES(is_remote), min_stipend = VALUES(min_stipend), max_stipend = VALUES(max_stipend), application_deadline = VALUES(application_deadline), status = VALUES(status);

-- ==========================================
-- 7. JOB_SKILLS TABLE (Mapping skills to jobs)
-- ==========================================
INSERT INTO job_skills (job_id, skill_id, is_required) VALUES
-- Job 1 (Backend Intern): Requires MySQL, Python, Docker
('j1111111-1111-1111-1111-111111111111', 1, TRUE),
('j1111111-1111-1111-1111-111111111111', 2, TRUE),
('j1111111-1111-1111-1111-111111111111', 4, FALSE),
-- Job 2 (AI/ML Engineer): Requires Python, ML
('j1111111-1111-1111-1111-222222222222', 2, TRUE),
('j1111111-1111-1111-1111-222222222222', 7, TRUE),
-- Job 3 (Cloud Intern): Requires Docker, Kubernetes
('j1111111-1111-1111-1111-333333333333', 4, TRUE),
('j1111111-1111-1111-1111-333333333333', 8, TRUE),
-- Job 4 (Frontend Dev): Requires React, TypeScript
('j1111111-1111-1111-1111-444444444444', 3, TRUE),
('j1111111-1111-1111-1111-444444444444', 6, TRUE),
-- Job 5 (Java Systems): Requires Java, MySQL
('j1111111-1111-1111-1111-555555555555', 5, TRUE),
('j1111111-1111-1111-1111-555555555555', 1, TRUE),
-- Job 6 (Data Science Co-Op): Requires Python, MySQL
('j1111111-1111-1111-1111-666666666666', 2, TRUE),
('j1111111-1111-1111-1111-666666666666', 1, TRUE)
ON DUPLICATE KEY UPDATE is_required = VALUES(is_required);

-- ==========================================
-- 8. STUDENT_SKILLS TABLE (Proficiencies rated 1-5)
-- ==========================================
INSERT INTO student_skills (student_id, skill_id, proficiency) VALUES
-- Emily: MySQL (5), Python (4), Docker (3)
('u2222222-2222-2222-2222-111111111111', 1, 5),
('u2222222-2222-2222-2222-111111111111', 2, 4),
('u2222222-2222-2222-2222-111111111111', 4, 3),
-- Frank: Python (5), ML (5)
('u2222222-2222-2222-2222-222222222222', 2, 5),
('u2222222-2222-2222-2222-222222222222', 7, 5),
-- Grace: React (5), TypeScript (4), Python (3)
('u2222222-2222-2222-2222-333333333333', 3, 5),
('u2222222-2222-2222-2222-333333333333', 6, 4),
('u2222222-2222-2222-2222-333333333333', 2, 3),
-- Henry: Docker (4), Kubernetes (4), MySQL (3)
('u2222222-2222-2222-2222-444444444444', 4, 4),
('u2222222-2222-2222-2222-444444444444', 8, 4),
('u2222222-2222-2222-2222-444444444444', 1, 3),
-- Isabel: Java (4), MySQL (4), Python (3)
('u2222222-2222-2222-2222-555555555555', 5, 4),
('u2222222-2222-2222-2222-555555555555', 1, 4),
('u2222222-2222-2222-2222-555555555555', 2, 3),
-- Jack: Python (4), MySQL (5), ML (3)
('u2222222-2222-2222-2222-666666666666', 2, 4),
('u2222222-2222-2222-2222-666666666666', 1, 5),
('u2222222-2222-2222-2222-666666666666', 7, 3)
ON DUPLICATE KEY UPDATE proficiency = VALUES(proficiency);

-- ==========================================
-- 9. APPLICATIONS TABLE
-- ==========================================
INSERT INTO applications (application_id, job_id, student_id, status, cover_note, match_score) VALUES
('a1111111-1111-1111-1111-111111111111', 'j1111111-1111-1111-1111-111111111111', 'u2222222-2222-2222-2222-111111111111', 'applied', 'Excited to apply for the Backend role!', 92.50),
('a1111111-1111-1111-1111-222222222222', 'j1111111-1111-1111-1111-222222222222', 'u2222222-2222-2222-2222-222222222222', 'applied', 'My research at Stanford heavily aligns with this ML position.', 98.00),
('a1111111-1111-1111-1111-333333333333', 'j1111111-1111-1111-1111-444444444444', 'u2222222-2222-2222-2222-333333333333', 'applied', 'Full-stack experience with modern Web UI frameworks.', 88.00),
('a1111111-1111-1111-1111-444444444444', 'j1111111-1111-1111-1111-333333333333', 'u2222222-2222-2222-2222-444444444444', 'applied', 'Love working with cloud infrastructure and containers.', 90.00),
('a1111111-1111-1111-1111-555555555555', 'j1111111-1111-1111-1111-555555555555', 'u2222222-2222-2222-2222-555555555555', 'applied', 'Strong enterprise Java background with MySQL focus.', 85.00),
('a1111111-1111-1111-1111-666666666666', 'j1111111-1111-1111-1111-666666666666', 'u2222222-2222-2222-2222-666666666666', 'applied', 'Experienced with pandas, SQL data manipulation.', 91.00)
ON DUPLICATE KEY UPDATE job_id = VALUES(job_id), student_id = VALUES(student_id), status = VALUES(status), cover_note = VALUES(cover_note), match_score = VALUES(match_score);
