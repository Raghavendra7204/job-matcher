-- Job Matcher database schema: MySQL 8 / InnoDB
--
-- This script is safe to run repeatedly against the job_matcher database:
-- it creates missing tables and replaces only the project-owned routines and
-- triggers. It never drops tables or deletes application data.

CREATE DATABASE IF NOT EXISTS job_matcher
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;
USE job_matcher;

CREATE TABLE IF NOT EXISTS users (
    user_id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_role CHECK (role IN ('student', 'recruiter', 'admin'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
    company_id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    website VARCHAR(255),
    industry VARCHAR(100),
    KEY idx_companies_industry (industry)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recruiters (
    recruiter_id CHAR(36) PRIMARY KEY,
    company_id CHAR(36) NOT NULL,
    designation VARCHAR(100),
    CONSTRAINT fk_recruiter_user FOREIGN KEY (recruiter_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_recruiter_company FOREIGN KEY (company_id)
        REFERENCES companies(company_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
    student_id CHAR(36) PRIMARY KEY,
    university VARCHAR(255),
    degree VARCHAR(255),
    graduation_year SMALLINT,
    bio TEXT,
    profile_embedding JSON,
    CONSTRAINT fk_student_user FOREIGN KEY (student_id)
        REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jobs (
    job_id CHAR(36) PRIMARY KEY,
    recruiter_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    job_type VARCHAR(50) NOT NULL DEFAULT 'full-time',
    location VARCHAR(255),
    is_remote BOOLEAN NOT NULL DEFAULT FALSE,
    min_stipend DECIMAL(12,2),
    max_stipend DECIMAL(12,2),
    application_deadline DATE,
    description_embedding JSON,
    search_vector TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_jobs_recruiter (recruiter_id),
    KEY idx_jobs_status_deadline (status, application_deadline),
    KEY idx_jobs_type_location (job_type, location),
    FULLTEXT KEY ft_jobs_search (search_vector),
    CONSTRAINT chk_jobs_type CHECK (
        job_type IN ('full-time', 'part-time', 'internship', 'contract')
    ),
    CONSTRAINT chk_jobs_status CHECK (status IN ('open', 'closed', 'expired')),
    CONSTRAINT chk_jobs_stipend CHECK (
        min_stipend IS NULL OR max_stipend IS NULL OR min_stipend <= max_stipend
    ),
    CONSTRAINT fk_job_recruiter FOREIGN KEY (recruiter_id)
        REFERENCES recruiters(recruiter_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
    application_id CHAR(36) PRIMARY KEY,
    job_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'applied',
    cover_note TEXT,
    match_score DECIMAL(5,2),
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_application_job_student (job_id, student_id),
    KEY idx_applications_status (status),
    KEY idx_applications_student (student_id, applied_at),
    CONSTRAINT chk_application_status CHECK (
        status IN ('applied', 'shortlisted', 'selected', 'rejected')
    ),
    CONSTRAINT chk_application_match_score CHECK (
        match_score IS NULL OR match_score BETWEEN 0 AND 100
    ),
    CONSTRAINT fk_app_job FOREIGN KEY (job_id)
        REFERENCES jobs(job_id) ON DELETE CASCADE,
    CONSTRAINT fk_app_student FOREIGN KEY (student_id)
        REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS application_status_log (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    application_id CHAR(36) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_status_log_application (application_id, changed_at),
    CONSTRAINT chk_status_log_old CHECK (
        old_status IS NULL OR old_status IN ('applied', 'shortlisted', 'selected', 'rejected')
    ),
    CONSTRAINT chk_status_log_new CHECK (
        new_status IN ('applied', 'shortlisted', 'selected', 'rejected')
    ),
    CONSTRAINT fk_log_application FOREIGN KEY (application_id)
        REFERENCES applications(application_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_skills (
    student_id CHAR(36) NOT NULL,
    skill_id INT NOT NULL,
    proficiency SMALLINT,
    PRIMARY KEY (student_id, skill_id),
    KEY idx_student_skills_skill (skill_id),
    CONSTRAINT chk_student_skill_proficiency CHECK (
        proficiency IS NULL OR proficiency BETWEEN 1 AND 5
    ),
    CONSTRAINT fk_ss_student FOREIGN KEY (student_id)
        REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_ss_skill FOREIGN KEY (skill_id)
        REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_skills (
    job_id CHAR(36) NOT NULL,
    skill_id INT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (job_id, skill_id),
    KEY idx_job_skills_skill (skill_id),
    CONSTRAINT fk_js_job FOREIGN KEY (job_id)
        REFERENCES jobs(job_id) ON DELETE CASCADE,
    CONSTRAINT fk_js_skill FOREIGN KEY (skill_id)
        REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB;

DELIMITER //

DROP PROCEDURE IF EXISTS match_students_for_job//
DROP TRIGGER IF EXISTS trg_jobs_before_insert//
DROP TRIGGER IF EXISTS trg_jobs_before_update//
DROP TRIGGER IF EXISTS trg_applications_after_insert//
DROP TRIGGER IF EXISTS trg_applications_after_update//
DROP TRIGGER IF EXISTS trg_applications_before_insert//

CREATE TRIGGER trg_jobs_before_insert
BEFORE INSERT ON jobs FOR EACH ROW
BEGIN
    SET NEW.title = TRIM(NEW.title);
    SET NEW.search_vector = CONCAT_WS(' ', NULLIF(TRIM(NEW.title), ''), NULLIF(TRIM(NEW.description), ''));
    IF NEW.title = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Job title cannot be blank';
    END IF;
    IF NEW.application_deadline IS NOT NULL AND NEW.application_deadline < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application deadline cannot be in the past';
    END IF;
END//

CREATE TRIGGER trg_jobs_before_update
BEFORE UPDATE ON jobs FOR EACH ROW
BEGIN
    SET NEW.title = TRIM(NEW.title);
    SET NEW.search_vector = CONCAT_WS(' ', NULLIF(TRIM(NEW.title), ''), NULLIF(TRIM(NEW.description), ''));
    IF NEW.title = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Job title cannot be blank';
    END IF;
    IF NEW.application_deadline IS NOT NULL AND NEW.application_deadline < CURDATE()
       AND NEW.status <> 'expired' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application deadline cannot be in the past';
    END IF;
END//

CREATE TRIGGER trg_applications_after_insert
AFTER INSERT ON applications FOR EACH ROW
BEGIN
    INSERT INTO application_status_log (application_id, old_status, new_status)
    VALUES (NEW.application_id, NULL, NEW.status);
END//

CREATE TRIGGER trg_applications_after_update
AFTER UPDATE ON applications FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO application_status_log (application_id, old_status, new_status)
        VALUES (NEW.application_id, OLD.status, NEW.status);
    END IF;
END//

CREATE PROCEDURE match_students_for_job(IN p_job_id CHAR(36))
READS SQL DATA
BEGIN
    SELECT
        u.user_id AS student_id,
        u.full_name,
        u.email,
        s.university,
        s.degree,
        s.graduation_year,
        COUNT(DISTINCT ss.skill_id) AS matched_required_skills
    FROM students s
    JOIN users u ON u.user_id = s.student_id
    JOIN student_skills ss ON ss.student_id = s.student_id
    JOIN job_skills js
        ON js.skill_id = ss.skill_id
       AND js.job_id = p_job_id
       AND js.is_required = TRUE
    GROUP BY
        u.user_id, u.full_name, u.email, s.university,
        s.degree, s.graduation_year
    ORDER BY matched_required_skills DESC, u.full_name;
END//

CREATE TRIGGER trg_applications_before_insert
BEFORE INSERT ON applications
FOR EACH ROW
BEGIN
    DECLARE v_job_status VARCHAR(20);
    DECLARE v_deadline DATE;

    -- Fetch the job status and deadline associated with the application
    SELECT status, application_deadline 
    INTO v_job_status, v_deadline
    FROM jobs 
    WHERE job_id = NEW.job_id;

    -- Check if the job exists
    IF v_job_status IS NULL THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot apply: The specified job posting does not exist.';
    END IF;

    -- Check if the job is open
    IF v_job_status <> 'open' THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot apply: This job posting is closed or no longer accepting applications.';
    END IF;

    -- Check if the application deadline has passed
    IF v_deadline IS NOT NULL AND v_deadline < CURDATE() THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot apply: The application deadline for this job has passed.';
    END IF;
END//

DELIMITER ;
