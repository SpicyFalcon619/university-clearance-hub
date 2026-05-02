-- =====================================================================
-- UIU Clearance System — MySQL Schema (XAMPP / MariaDB / MySQL 8+)
-- Phase 1: Migrated from Supabase (PostgreSQL) to raw MySQL.
--
-- Type mapping notes (Postgres -> MySQL):
--   uuid                  -> CHAR(36)        (generated in PHP via uniqid/ramsey or UUID())
--   timestamptz           -> DATETIME        (store UTC from PHP)
--   text                  -> TEXT
--   boolean               -> TINYINT(1)
--   ENUM (app_role, etc.) -> native MySQL ENUM(...)
--   RLS policies          -> NOT portable; enforce in PHP session/role checks
--   Triggers (recompute   -> Re-implemented as MySQL triggers below where
--    status, seed dept,    feasible. Notification creation is also done
--    new user profile)     in PHP after the relevant action for clarity.
--
-- Run this once in phpMyAdmin (XAMPP) to create the database.
-- =====================================================================

DROP DATABASE IF EXISTS uiu_clearance;
CREATE DATABASE uiu_clearance
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE uiu_clearance;

-- ---------------------------------------------------------------------
-- USERS  (replaces Supabase auth.users)
-- Passwords are stored as PHP password_hash() bcrypt strings.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
CREATE TABLE profiles (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  full_name   VARCHAR(255) NOT NULL DEFAULT '',
  email       VARCHAR(255) NOT NULL DEFAULT '',
  student_id  VARCHAR(50)  NULL,
  course      VARCHAR(255) NULL,
  batch       VARCHAR(50)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- DEPARTMENTS
-- ---------------------------------------------------------------------
CREATE TABLE departments (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- USER_ROLES  (separate table — never store role on profiles)
-- ---------------------------------------------------------------------
CREATE TABLE user_roles (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  user_id       CHAR(36) NOT NULL,
  role          ENUM('student','dept_admin','master_admin') NOT NULL,
  department_id CHAR(36) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_role_dept (user_id, role, department_id),
  CONSTRAINT fk_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_roles_dept
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- APPLICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE applications (
  id                       CHAR(36) NOT NULL PRIMARY KEY,
  student_id               CHAR(36) NOT NULL,
  course                   VARCHAR(255) NOT NULL,
  batch                    VARCHAR(50)  NOT NULL,
  reason                   TEXT NULL,
  is_emergency             TINYINT(1) NOT NULL DEFAULT 0,
  emergency_justification  TEXT NULL,
  overall_status ENUM('not_started','in_progress','action_required','completed')
                           NOT NULL DEFAULT 'in_progress',
  certificate_ref          VARCHAR(255) NULL,
  certificate_issued_at    DATETIME NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_student (student_id),
  CONSTRAINT fk_app_student
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- DEPARTMENT_STATUS  (one row per (application, department))
-- ---------------------------------------------------------------------
CREATE TABLE department_status (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  department_id  CHAR(36) NOT NULL,
  status         ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  comments       TEXT NULL,
  reviewed_by    CHAR(36) NULL,
  reviewed_at    DATETIME NULL,
  undo_deadline  DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_dept (application_id, department_id),
  CONSTRAINT fk_ds_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_ds_dept FOREIGN KEY (department_id)  REFERENCES departments(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ds_user FOREIGN KEY (reviewed_by)    REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- DOCUMENTS  (file_path points to /uploads on the PHP server)
-- ---------------------------------------------------------------------
CREATE TABLE documents (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  department_id  CHAR(36) NULL,
  uploaded_by    CHAR(36) NOT NULL,
  file_name      VARCHAR(512) NOT NULL,
  file_path      VARCHAR(1024) NOT NULL,
  mime_type      VARCHAR(255) NULL,
  size_bytes     INT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_dept FOREIGN KEY (department_id)  REFERENCES departments(id)  ON DELETE SET NULL,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploaded_by)    REFERENCES users(id)        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- AUDIT_LOG
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  actor_id       CHAR(36) NULL,
  application_id CHAR(36) NULL,
  department_id  CHAR(36) NULL,
  action         VARCHAR(100) NOT NULL,
  comments       TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_app (application_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id)       REFERENCES users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_audit_app   FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_dept  FOREIGN KEY (department_id)  REFERENCES departments(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  user_id        CHAR(36) NOT NULL,
  application_id CHAR(36) NULL,
  title          VARCHAR(255) NOT NULL,
  body           TEXT NULL,
  `read`         TINYINT(1) NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_notif_app  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- TRIGGERS
-- Re-implements the Postgres recompute_app_status() + seed_dept_status()
-- behavior. Notifications on status changes are emitted in PHP for
-- clarity (so messages can be richer / localized).
-- =====================================================================

DELIMITER $$

-- When a new application is created, seed department_status rows for
-- every active department.
CREATE TRIGGER trg_app_after_insert
AFTER INSERT ON applications
FOR EACH ROW
BEGIN
  INSERT INTO department_status (id, application_id, department_id, status)
  SELECT UUID(), NEW.id, d.id, 'pending'
  FROM departments d
  WHERE d.active = 1;
END$$

-- Recompute applications.overall_status whenever a department row changes.
CREATE TRIGGER trg_ds_after_update
AFTER UPDATE ON department_status
FOR EACH ROW
BEGIN
  DECLARE v_total INT DEFAULT 0;
  DECLARE v_approved INT DEFAULT 0;
  DECLARE v_denied INT DEFAULT 0;

  SELECT COUNT(*),
         SUM(status = 'approved'),
         SUM(status = 'denied')
  INTO v_total, v_approved, v_denied
  FROM department_status
  WHERE application_id = NEW.application_id;

  UPDATE applications
  SET overall_status = CASE
        WHEN v_denied   > 0                          THEN 'action_required'
        WHEN v_total    > 0 AND v_approved = v_total THEN 'completed'
        ELSE 'in_progress'
      END
  WHERE id = NEW.application_id;
END$$

DELIMITER ;

-- =====================================================================
-- SEED DATA
-- A few starter departments + a master admin you can log in with.
-- Default master-admin credentials:
--   email:    admin@uiu.ac.bd
--   password: Admin@123      (bcrypt hash below — change after first login)
-- =====================================================================

INSERT INTO departments (id, name, description, active) VALUES
  (UUID(), 'Library',           'Return all borrowed books and clear dues', 1),
  (UUID(), 'Accounts',          'Settle outstanding tuition and fees',     1),
  (UUID(), 'Registrar Office',  'Verify academic records',                 1),
  (UUID(), 'IT Services',       'Return university-issued IT equipment',   1),
  (UUID(), 'Department Office', 'Departmental no-dues clearance',          1);

SET @admin_id = UUID();
INSERT INTO users (id, email, password_hash) VALUES
  (@admin_id, 'admin@uiu.ac.bd',
   '$2y$10$E2nQH4pQHk9c7wbq3oJp1uYwS6mC3l8O6m6QvCk8p3v0i7T0Z9b0W');

INSERT INTO profiles (id, full_name, email)
  VALUES (@admin_id, 'UIU Master Admin', 'admin@uiu.ac.bd');

INSERT INTO user_roles (id, user_id, role)
  VALUES (UUID(), @admin_id, 'master_admin');
