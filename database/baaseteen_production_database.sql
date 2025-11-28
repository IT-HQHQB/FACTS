-- =====================================================
-- BAASEETEN CASE MANAGEMENT SYSTEM - PRODUCTION DATABASE
-- =====================================================
-- This is a comprehensive SQL file containing all database schema,
-- tables, data, and migrations for the Baaseteen Case Management System.
-- 
-- Created: 2024
-- Version: 1.0.0
-- Description: Complete production database setup for Baaseteen CMS
-- =====================================================

-- Step 1: Create Database
-- =====================================================
CREATE DATABASE IF NOT EXISTS baaseteen_cms;
USE baaseteen_cms;

-- Step 2: Core Tables
-- =====================================================

-- Users table for all system users
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL,
    jamiat JSON,
    jamaat JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Applicants table
CREATE TABLE applicants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    its_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    marital_status ENUM('single', 'married', 'divorced', 'widowed'),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    mauze VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Cases table
CREATE TABLE cases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_number VARCHAR(50) UNIQUE NOT NULL,
    applicant_id INT NOT NULL,
    case_type ENUM('baaseteen', 'shnd', 'ces') NOT NULL,
    status ENUM(
        'draft',
        'assigned',
        'in_counseling',
        'cover_letter_generated',
        'submitted_to_welfare',
        'welfare_approved',
        'welfare_rejected',
        'executive_approved',
        'executive_rejected',
        'finance_disbursement'
    ) DEFAULT 'draft',
    assigned_dcm_id INT,
    assigned_counselor_id INT,
    estimated_end_date DATE,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_submission_date TIMESTAMP NULL,
    executive_approval_date TIMESTAMP NULL,
    manzoori_receipt_date TIMESTAMP NULL,
    first_disbursement_date TIMESTAMP NULL,
    completion_date TIMESTAMP NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(id),
    FOREIGN KEY (assigned_dcm_id) REFERENCES users(id),
    FOREIGN KEY (assigned_counselor_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Counseling forms table
CREATE TABLE counseling_forms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    -- Personal Details
    personal_details JSON,
    -- Family Details
    family_details JSON,
    -- Assessment
    assessment JSON,
    -- Upliftment Plan
    upliftment_plan JSON,
    -- Financial Requirements
    financial_requirements JSON,
    -- Outcomes
    outcomes JSON,
    -- Declaration
    declaration JSON,
    -- Form completion status
    is_complete BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- Cover letters table
CREATE TABLE cover_letters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    file_path VARCHAR(500),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by INT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- Status history and audit logs
CREATE TABLE status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by INT NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Comments and notes
CREATE TABLE case_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    comment_type ENUM('general', 'rejection', 'approval', 'note') DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- File attachments
CREATE TABLE case_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INT,
    uploaded_by INT NOT NULL,
    stage VARCHAR(50), -- registration, file_preparation, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    case_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'success', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Step 3: Role-Based Access Control (RBAC) Tables
-- =====================================================

-- Create roles table with enhanced permissions
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create role_permissions table for granular permissions
CREATE TABLE role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    permission VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (role_id, permission, resource, action)
);

-- Create user_roles table for user-role assignments
CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_role (user_id, role_id)
);

-- Step 4: Master Data Tables
-- =====================================================

-- Case Types table
CREATE TABLE case_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Statuses table
CREATE TABLE statuses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6B7280',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    is_final BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Education Levels table
CREATE TABLE education_levels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Executive Levels table
CREATE TABLE executive_levels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    level_number INT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Occupations table
CREATE TABLE occupations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Relations table
CREATE TABLE relations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Step 5: Jamiat and Jamaat Master Tables
-- =====================================================

-- Create Jamiat table (Parent table)
CREATE TABLE jamiat (
    id INT PRIMARY KEY AUTO_INCREMENT,
    jamiat_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create Jamaat table (Child table with reference to Jamiat)
CREATE TABLE jamaat (
    id INT PRIMARY KEY AUTO_INCREMENT,
    jamiat_id INT NOT NULL,
    jamaat_id VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    FOREIGN KEY (jamiat_id) REFERENCES jamiat(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_jamaat_id (jamiat_id, jamaat_id)
);

-- Step 6: Workflow Management Tables
-- =====================================================

-- Create workflow_stages table to store global workflow stages
CREATE TABLE workflow_stages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    stage_name VARCHAR(100) NOT NULL,
    stage_key VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    can_create_case BOOLEAN DEFAULT FALSE,
    can_fill_case BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sort_order (sort_order),
    INDEX idx_is_active (is_active),
    INDEX idx_stage_key (stage_key)
);

-- Create workflow_stage_roles table to map roles to workflow stages
CREATE TABLE workflow_stage_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workflow_stage_id INT NOT NULL,
    role_id INT NOT NULL,
    can_approve BOOLEAN DEFAULT FALSE,
    can_review BOOLEAN DEFAULT FALSE,
    can_view BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_stage_id) REFERENCES workflow_stages(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_stage_role (workflow_stage_id, role_id),
    INDEX idx_workflow_stage_id (workflow_stage_id),
    INDEX idx_role_id (role_id)
);

-- Create workflow_stage_users table to map specific users to workflow stages
CREATE TABLE workflow_stage_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    workflow_stage_id INT NOT NULL,
    user_id INT NOT NULL,
    can_approve BOOLEAN DEFAULT FALSE,
    can_review BOOLEAN DEFAULT FALSE,
    can_view BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_stage_id) REFERENCES workflow_stages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_stage_user (workflow_stage_id, user_id),
    INDEX idx_workflow_stage_id (workflow_stage_id),
    INDEX idx_user_id (user_id)
);

-- Step 7: Business Assets and Products/Services Tables
-- =====================================================

-- Create products_services table
CREATE TABLE products_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create assessment_products_services table
CREATE TABLE assessment_products_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    product_service_id INT NOT NULL,
    quantity INT DEFAULT 1,
    estimated_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_service_id) REFERENCES products_services(id) ON DELETE CASCADE
);

-- Step 8: Family Member Tables
-- =====================================================

-- Create family_members table
CREATE TABLE family_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    relation_id INT,
    age INT,
    gender ENUM('male', 'female', 'other'),
    occupation_id INT,
    education_level_id INT,
    monthly_income DECIMAL(10,2) DEFAULT 0,
    is_earning_member BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (relation_id) REFERENCES relations(id) ON DELETE SET NULL,
    FOREIGN KEY (occupation_id) REFERENCES occupations(id) ON DELETE SET NULL,
    FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON DELETE SET NULL
);

-- Step 9: Welfare Checklist Tables
-- =====================================================

-- Welfare Checklist Categories table
CREATE TABLE IF NOT EXISTS welfare_checklist_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(200) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sort_order (sort_order),
    INDEX idx_is_active (is_active)
);

-- Welfare Checklist Items table
CREATE TABLE IF NOT EXISTS welfare_checklist_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    form_section VARCHAR(50) NOT NULL,
    checklist_detail TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_compulsory BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES welfare_checklist_categories(id) ON DELETE CASCADE,
    INDEX idx_category_id (category_id),
    INDEX idx_sort_order (sort_order),
    INDEX idx_is_active (is_active)
);

-- Welfare Checklist Responses table
CREATE TABLE IF NOT EXISTS welfare_checklist_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    checklist_item_id INT NOT NULL,
    properly_filled ENUM('Y', 'N') NOT NULL,
    comments TEXT,
    overall_remarks TEXT NULL,
    filled_by INT NOT NULL,
    filled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (checklist_item_id) REFERENCES welfare_checklist_items(id) ON DELETE CASCADE,
    FOREIGN KEY (filled_by) REFERENCES users(id),
    UNIQUE KEY unique_case_item (case_id, checklist_item_id),
    INDEX idx_case_id (case_id),
    INDEX idx_checklist_item_id (checklist_item_id),
    INDEX idx_filled_by (filled_by)
);

-- Step 10: Payment Schedules Tables
-- =====================================================

-- Create payment_schedules table
CREATE TABLE IF NOT EXISTS payment_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    payment_type ENUM('qardan_hasana', 'enayat') NOT NULL,
    year_number INT NOT NULL COMMENT 'Year 1, 2, 3, 4, or 5',
    disbursement_year YEAR NOT NULL,
    disbursement_month INT NOT NULL COMMENT 'Month number (1-12)',
    disbursement_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    repayment_months INT NULL COMMENT 'Number of repayment months (only for QH)',
    repayment_start_year YEAR NULL COMMENT 'Year when repayment starts (only for QH)',
    repayment_start_month INT NULL COMMENT 'Month when repayment starts (only for QH)',
    is_disbursed BOOLEAN DEFAULT FALSE COMMENT 'Whether the payment has been confirmed/disbursed',
    disbursed_date DATE NULL COMMENT 'Actual date when amount was disbursed',
    disbursed_by INT NULL COMMENT 'User who confirmed the disbursement',
    disbursed_at TIMESTAMP NULL COMMENT 'Timestamp when disbursement was confirmed',
    created_by INT NOT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id),
    FOREIGN KEY (disbursed_by) REFERENCES users(id),
    INDEX idx_case_id (case_id),
    INDEX idx_payment_type (payment_type),
    INDEX idx_year (year_number, disbursement_year),
    INDEX idx_is_disbursed (is_disbursed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create payment_schedule_repayments table for storing calculated repayments
CREATE TABLE IF NOT EXISTS payment_schedule_repayments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    payment_schedule_id INT NOT NULL,
    repayment_year YEAR NOT NULL,
    repayment_month INT NOT NULL COMMENT 'Month number (1-12)',
    repayment_amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_schedule_id) REFERENCES payment_schedules(id) ON DELETE CASCADE,
    INDEX idx_schedule_id (payment_schedule_id),
    INDEX idx_year_month (repayment_year, repayment_month),
    UNIQUE KEY unique_schedule_month (payment_schedule_id, repayment_year, repayment_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 11: Cover Letter Forms Table
-- =====================================================

CREATE TABLE IF NOT EXISTS cover_letter_forms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL UNIQUE,
    applicant_details JSON,
    counsellor_details JSON,
    financial_overview JSON,
    proposed_upliftment_plan TEXT,
    financial_assistance JSON,
    non_financial_assistance TEXT,
    projected_income JSON,
    case_management_comments TEXT,
    executive_approval JSON,
    is_complete BOOLEAN DEFAULT FALSE,
    submitted_by INT,
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_case_id (case_id),
    INDEX idx_is_complete (is_complete),
    INDEX idx_submitted_at (submitted_at)
);

-- Step 12: Counseling Form Stage Permissions Table
-- =====================================================

CREATE TABLE IF NOT EXISTS counseling_form_stage_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    stage_key VARCHAR(50) NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    can_read BOOLEAN DEFAULT FALSE,
    can_update BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_stage (role_id, stage_key),
    INDEX idx_role_id (role_id),
    INDEX idx_stage_key (stage_key)
);

-- Step 13: Migrations - User and Applicant Enhancements
-- =====================================================

-- Add its_number to users table
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'users' 
                    AND COLUMN_NAME = 'its_number');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE users ADD COLUMN its_number VARCHAR(50) NULL COMMENT ''ITS number for user identification'' AFTER phone', 
                   'SELECT "Column its_number already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add photo to users table
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'users' 
                    AND COLUMN_NAME = 'photo');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE users ADD COLUMN photo LONGTEXT NULL COMMENT ''Base64 encoded image data'' AFTER phone', 
                   'SELECT "Column photo already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add photo to applicants table
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'applicants' 
                    AND COLUMN_NAME = 'photo');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE applicants ADD COLUMN photo LONGTEXT NULL COMMENT ''Base64 encoded image data'' AFTER email', 
                   'SELECT "Column photo already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 14: Migrations - Workflow Stages Enhancements
-- =====================================================

-- Add associated_statuses to workflow_stages
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND COLUMN_NAME = 'associated_statuses');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stages ADD COLUMN associated_statuses JSON NULL COMMENT ''JSON array of case statuses that trigger this workflow stage''', 
                   'SELECT "Column associated_statuses already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add case_type_id to workflow_stages
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND COLUMN_NAME = 'case_type_id');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stages ADD COLUMN case_type_id INT NULL AFTER sort_order', 
                   'SELECT "Column case_type_id already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.table_constraints 
                   WHERE constraint_schema = DATABASE() 
                   AND table_name = 'workflow_stages' 
                   AND constraint_name = 'workflow_stages_ibfk_case_type');

SET @sqlstmt := IF(@fk_exists = 0, 
                   'ALTER TABLE workflow_stages ADD CONSTRAINT workflow_stages_ibfk_case_type FOREIGN KEY (case_type_id) REFERENCES case_types(id) ON DELETE SET NULL', 
                   'SELECT "Foreign key already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND INDEX_NAME = 'idx_case_type_id');

SET @sqlstmt := IF(@idx_exists = 0, 
                   'CREATE INDEX idx_case_type_id ON workflow_stages(case_type_id)', 
                   'SELECT "Index idx_case_type_id already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add workflow progression fields
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND COLUMN_NAME = 'next_stage_id');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stages ADD COLUMN next_stage_id INT NULL AFTER sort_order', 
                   'SELECT "Column next_stage_id already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND COLUMN_NAME = 'auto_advance_on_approve');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stages ADD COLUMN auto_advance_on_approve BOOLEAN DEFAULT TRUE AFTER next_stage_id', 
                   'SELECT "Column auto_advance_on_approve already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND COLUMN_NAME = 'requires_comments_on_reject');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stages ADD COLUMN requires_comments_on_reject BOOLEAN DEFAULT TRUE AFTER auto_advance_on_approve', 
                   'SELECT "Column requires_comments_on_reject already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.table_constraints 
                   WHERE constraint_schema = DATABASE() 
                   AND table_name = 'workflow_stages' 
                   AND constraint_name = 'workflow_stages_ibfk_next_stage');

SET @sqlstmt := IF(@fk_exists = 0, 
                   'ALTER TABLE workflow_stages ADD CONSTRAINT workflow_stages_ibfk_next_stage FOREIGN KEY (next_stage_id) REFERENCES workflow_stages(id) ON DELETE SET NULL', 
                   'SELECT "Foreign key already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add can_reject to workflow_stage_roles and workflow_stage_users
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stage_roles' 
                    AND COLUMN_NAME = 'can_reject');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stage_roles ADD COLUMN can_reject BOOLEAN DEFAULT FALSE AFTER can_approve', 
                   'SELECT "Column can_reject already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stage_users' 
                    AND COLUMN_NAME = 'can_reject');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stage_users ADD COLUMN can_reject BOOLEAN DEFAULT FALSE AFTER can_approve', 
                   'SELECT "Column can_reject already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add can_edit and can_delete to workflow_stage_roles
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stage_roles' 
                    AND COLUMN_NAME = 'can_edit');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stage_roles ADD COLUMN can_edit BOOLEAN DEFAULT FALSE COMMENT ''Can edit/update data in this workflow stage'', ADD COLUMN can_delete BOOLEAN DEFAULT FALSE COMMENT ''Can delete data in this workflow stage''', 
                   'SELECT "Columns already exist"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add can_edit and can_delete to workflow_stage_users
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stage_users' 
                    AND COLUMN_NAME = 'can_edit');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stage_users ADD COLUMN can_edit BOOLEAN DEFAULT FALSE COMMENT ''Can edit/update data in this workflow stage'', ADD COLUMN can_delete BOOLEAN DEFAULT FALSE COMMENT ''Can delete data in this workflow stage''', 
                   'SELECT "Columns already exist"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add SLA fields to workflow_stages
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND COLUMN_NAME = 'sla_value');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE workflow_stages ADD COLUMN sla_value DECIMAL(10,2) NULL AFTER associated_statuses, ADD COLUMN sla_unit ENUM(''hours'', ''days'', ''business_days'', ''weeks'', ''months'') NULL AFTER sla_value, ADD COLUMN sla_warning_value DECIMAL(10,2) NULL AFTER sla_unit, ADD COLUMN sla_warning_unit ENUM(''hours'', ''days'', ''business_days'', ''weeks'', ''months'') NULL AFTER sla_warning_value', 
                   'SELECT "SLA columns already exist"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'workflow_stages' 
                    AND INDEX_NAME = 'idx_sla_value');

SET @sqlstmt := IF(@idx_exists = 0, 
                   'CREATE INDEX idx_sla_value ON workflow_stages(sla_value)', 
                   'SELECT "Index idx_sla_value already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 15: Migrations - Cases Table Enhancements
-- =====================================================

-- Update cases status enum to include all workflow statuses
ALTER TABLE cases 
MODIFY COLUMN status ENUM(
  'draft',
  'assigned',
  'in_counseling',
  'cover_letter_generated',
  'submitted_to_welfare',
  'welfare_approved',
  'welfare_rejected',
  'welfare_processing_rework',
  'submitted_to_zi',
  'submitted_to_zi_review',
  'zi_approved',
  'zi_rejected',
  'submitted_to_kg_review',
  'submitted_to_operations_lead',
  'submitted_to_cover_letter',
  'submitted_to_executive_1',
  'executive_1_approved',
  'submitted_to_executive_2',
  'executive_2_approved',
  'submitted_to_executive_3',
  'executive_3_approved',
  'submitted_to_executive_4',
  'executive_4_approved',
  'executive_approved',
  'executive_rejected',
  'finance_disbursement'
) DEFAULT 'draft';

-- Add SLA tracking fields to cases
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'cases' 
                    AND COLUMN_NAME = 'current_stage_entered_at');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE cases ADD COLUMN current_stage_entered_at TIMESTAMP NULL, ADD COLUMN sla_status ENUM(''on_time'', ''warning'', ''breached'') DEFAULT ''on_time'', ADD COLUMN sla_breached_at TIMESTAMP NULL, ADD COLUMN sla_warning_sent_at TIMESTAMP NULL, ADD COLUMN sla_breach_notification_sent_at TIMESTAMP NULL', 
                   'SELECT "SLA columns already exist"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add current_workflow_stage_id to cases if it doesn't exist
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'cases' 
                    AND COLUMN_NAME = 'current_workflow_stage_id');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE cases ADD COLUMN current_workflow_stage_id INT NULL, ADD FOREIGN KEY (current_workflow_stage_id) REFERENCES workflow_stages(id) ON DELETE SET NULL', 
                   'SELECT "Column current_workflow_stage_id already exists"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 16: Migrations - Financial Assistance Tables
-- =====================================================

-- Note: These tables should be created if they don't exist in the base schema
-- Create financial_assistance table if it doesn't exist
CREATE TABLE IF NOT EXISTS financial_assistance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    case_id INT NOT NULL,
    assistance_type ENUM('qardan_hasana', 'enayat', 'other') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    INDEX idx_case_id (case_id)
);

-- Add non-financial assistance columns to financial_assistance
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'financial_assistance' 
                    AND COLUMN_NAME = 'non_financial_mentoring');

SET @sqlstmt := IF(@col_exists = 0, 
                   'ALTER TABLE financial_assistance ADD COLUMN non_financial_mentoring TEXT NULL COMMENT ''Non-financial help: Mentoring'', ADD COLUMN non_financial_skill_development TEXT NULL COMMENT ''Non-financial help: Skill Development'', ADD COLUMN non_financial_sourcing_support TEXT NULL COMMENT ''Non-financial help: Sourcing Support'', ADD COLUMN non_financial_sales_market_access TEXT NULL COMMENT ''Non-financial help: Sales/Market Access'', ADD COLUMN non_financial_other_solar TEXT NULL COMMENT ''Non-financial help: Other / Solar''', 
                   'SELECT "Non-financial columns already exist"');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create financial_assistance_qh_repayment_schedule table
CREATE TABLE IF NOT EXISTS financial_assistance_qh_repayment_schedule (
    id INT PRIMARY KEY AUTO_INCREMENT,
    financial_assistance_id INT NOT NULL,
    year1 DECIMAL(15, 2) NULL,
    year2 DECIMAL(15, 2) NULL,
    year3 DECIMAL(15, 2) NULL,
    year4 DECIMAL(15, 2) NULL,
    year5 DECIMAL(15, 2) NULL,
    month1 INT NULL COMMENT 'Number of months for Year 1 (any positive number)',
    month2 INT NULL COMMENT 'Number of months for Year 2 (any positive number)',
    month3 INT NULL COMMENT 'Number of months for Year 3 (any positive number)',
    month4 INT NULL COMMENT 'Number of months for Year 4 (any positive number)',
    month5 INT NULL COMMENT 'Number of months for Year 5 (any positive number)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (financial_assistance_id) REFERENCES financial_assistance(id) ON DELETE CASCADE,
    INDEX idx_financial_assistance_id (financial_assistance_id)
);

-- Create financial_assistance_enayat_repayment_schedule table
CREATE TABLE IF NOT EXISTS financial_assistance_enayat_repayment_schedule (
    id INT PRIMARY KEY AUTO_INCREMENT,
    financial_assistance_id INT NOT NULL,
    enayat_name VARCHAR(50) NOT NULL COMMENT 'Name of the Enayat entry (e.g., "Enayat 1", "Enayat 2")',
    year1 DECIMAL(15, 2) NULL COMMENT 'Repayment amount for Year 1',
    year2 DECIMAL(15, 2) NULL COMMENT 'Repayment amount for Year 2',
    year3 DECIMAL(15, 2) NULL COMMENT 'Repayment amount for Year 3',
    year4 DECIMAL(15, 2) NULL COMMENT 'Repayment amount for Year 4',
    year5 DECIMAL(15, 2) NULL COMMENT 'Repayment amount for Year 5',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (financial_assistance_id) REFERENCES financial_assistance(id) ON DELETE CASCADE,
    INDEX idx_financial_assistance_id (financial_assistance_id),
    INDEX idx_enayat_name (enayat_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 17: Insert Default Data
-- =====================================================

-- Insert default admin user
INSERT INTO users (username, email, password_hash, full_name, role) 
VALUES ('admin', 'admin@baaseteen.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin')
ON DUPLICATE KEY UPDATE username = username;

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('case_completion_months', '60', 'Number of months from first disbursement to case completion'),
('email_notifications_enabled', 'true', 'Enable email notifications for status changes'),
('file_upload_max_size', '10485760', 'Maximum file upload size in bytes (10MB)'),
('allowed_file_types', 'pdf,doc,docx,jpg,jpeg,png', 'Allowed file types for uploads')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- Insert default roles with comprehensive permissions
INSERT INTO roles (name, display_name, description, permissions) VALUES
('admin', 'System Administrator', 'Full system access with all permissions', JSON_OBJECT(
    'users', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'cases', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'applicants', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'counseling_forms', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'cover_letters', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'notifications', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'reports', JSON_ARRAY('read'),
    'roles', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'dashboard', JSON_ARRAY('read')
)),
('dcm', 'Deputy Case Manager', 'Manages assigned cases and counseling forms', JSON_OBJECT(
    'users', JSON_ARRAY('read'),
    'cases', JSON_ARRAY('read', 'update'),
    'applicants', JSON_ARRAY('read'),
    'counseling_forms', JSON_ARRAY('create', 'read', 'update'),
    'cover_letters', JSON_ARRAY('create', 'read'),
    'notifications', JSON_ARRAY('read'),
    'reports', JSON_ARRAY('read'),
    'dashboard', JSON_ARRAY('read')
)),
('counselor', 'Counselor', 'Assists with counseling and case management', JSON_OBJECT(
    'users', JSON_ARRAY('read'),
    'cases', JSON_ARRAY('read'),
    'applicants', JSON_ARRAY('read'),
    'counseling_forms', JSON_ARRAY('read', 'update'),
    'cover_letters', JSON_ARRAY('read'),
    'notifications', JSON_ARRAY('read'),
    'dashboard', JSON_ARRAY('read')
)),
('welfare_reviewer', 'Welfare Department Reviewer', 'Reviews and approves cases', JSON_OBJECT(
    'users', JSON_ARRAY('read'),
    'cases', JSON_ARRAY('read', 'update'),
    'applicants', JSON_ARRAY('read'),
    'counseling_forms', JSON_ARRAY('read'),
    'cover_letters', JSON_ARRAY('read'),
    'notifications', JSON_ARRAY('read'),
    'reports', JSON_ARRAY('read'),
    'dashboard', JSON_ARRAY('read')
)),
('executive', 'Executive', 'Final approval authority for cases', JSON_OBJECT(
    'users', JSON_ARRAY('read'),
    'cases', JSON_ARRAY('read', 'update'),
    'applicants', JSON_ARRAY('read'),
    'counseling_forms', JSON_ARRAY('read'),
    'cover_letters', JSON_ARRAY('read'),
    'notifications', JSON_ARRAY('read'),
    'reports', JSON_ARRAY('read'),
    'dashboard', JSON_ARRAY('read')
)),
('finance', 'Finance Department', 'Handles financial disbursements', JSON_OBJECT(
    'users', JSON_ARRAY('read'),
    'cases', JSON_ARRAY('read', 'update'),
    'applicants', JSON_ARRAY('read'),
    'counseling_forms', JSON_ARRAY('read'),
    'cover_letters', JSON_ARRAY('read'),
    'notifications', JSON_ARRAY('read'),
    'reports', JSON_ARRAY('read'),
    'dashboard', JSON_ARRAY('read')
))
ON DUPLICATE KEY UPDATE name = name;

-- Insert granular permissions for each role
INSERT INTO role_permissions (role_id, permission, resource, action) VALUES
-- Admin permissions
(1, 'users.create', 'users', 'create'),
(1, 'users.read', 'users', 'read'),
(1, 'users.update', 'users', 'update'),
(1, 'users.delete', 'users', 'delete'),
(1, 'cases.create', 'cases', 'create'),
(1, 'cases.read', 'cases', 'read'),
(1, 'cases.update', 'cases', 'update'),
(1, 'cases.delete', 'cases', 'delete'),
(1, 'roles.create', 'roles', 'create'),
(1, 'roles.read', 'roles', 'read'),
(1, 'roles.update', 'roles', 'update'),
(1, 'roles.delete', 'roles', 'delete'),
-- DCM permissions
(2, 'users.read', 'users', 'read'),
(2, 'cases.read', 'cases', 'read'),
(2, 'cases.update', 'cases', 'update'),
(2, 'counseling_forms.create', 'counseling_forms', 'create'),
(2, 'counseling_forms.read', 'counseling_forms', 'read'),
(2, 'counseling_forms.update', 'counseling_forms', 'update'),
(2, 'cover_letters.create', 'cover_letters', 'create'),
(2, 'cover_letters.read', 'cover_letters', 'read'),
-- Counselor permissions
(3, 'users.read', 'users', 'read'),
(3, 'cases.read', 'cases', 'read'),
(3, 'counseling_forms.read', 'counseling_forms', 'read'),
(3, 'counseling_forms.update', 'counseling_forms', 'update'),
(3, 'cover_letters.read', 'cover_letters', 'read'),
-- Welfare Reviewer permissions
(4, 'users.read', 'users', 'read'),
(4, 'cases.read', 'cases', 'read'),
(4, 'cases.update', 'cases', 'update'),
(4, 'counseling_forms.read', 'counseling_forms', 'read'),
(4, 'cover_letters.read', 'cover_letters', 'read'),
-- Executive permissions
(5, 'users.read', 'users', 'read'),
(5, 'cases.read', 'cases', 'read'),
(5, 'cases.update', 'cases', 'update'),
(5, 'counseling_forms.read', 'counseling_forms', 'read'),
(5, 'cover_letters.read', 'cover_letters', 'read'),
-- Finance permissions
(6, 'users.read', 'users', 'read'),
(6, 'cases.read', 'cases', 'read'),
(6, 'cases.update', 'cases', 'update'),
(6, 'counseling_forms.read', 'counseling_forms', 'read'),
(6, 'cover_letters.read', 'cover_letters', 'read')
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Insert case types data
INSERT INTO case_types (name, description, sort_order) VALUES
('baaseteen', 'Baaseteen case type', 1),
('shnd', 'SHND case type', 2),
('ces', 'CES case type', 3),
('medical', 'Medical assistance cases', 4),
('education', 'Educational support cases', 5),
('financial', 'Financial assistance cases', 6),
('housing', 'Housing support cases', 7),
('other', 'Other types of cases', 8)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert statuses data
INSERT INTO statuses (name, description, color, sort_order, is_final) VALUES
('draft', 'Case is in draft state', '#6B7280', 1, FALSE),
('assigned', 'Case has been assigned to DCM and counselor', '#3B82F6', 2, FALSE),
('in_counseling', 'Case is currently in counseling phase', '#F59E0B', 3, FALSE),
('cover_letter_generated', 'Cover letter has been generated', '#8B5CF6', 4, FALSE),
('submitted_to_welfare', 'Case submitted to welfare department', '#06B6D4', 5, FALSE),
('welfare_approved', 'Case approved by welfare department', '#10B981', 6, FALSE),
('welfare_rejected', 'Case rejected by welfare department', '#EF4444', 7, FALSE),
('welfare_processing_rework', 'Welfare is processing rework from Executive', '#F59E0B', 8, FALSE),
('submitted_to_executive_1', 'Case submitted to Executive Management 1', '#3B82F6', 9, FALSE),
('executive_1_approved', 'Case approved by Executive Management 1', '#10B981', 10, FALSE),
('submitted_to_executive_2', 'Case submitted to Executive Management 2', '#3B82F6', 11, FALSE),
('executive_2_approved', 'Case approved by Executive Management 2', '#10B981', 12, FALSE),
('submitted_to_executive_3', 'Case submitted to Executive Management 3', '#3B82F6', 13, FALSE),
('executive_3_approved', 'Case approved by Executive Management 3', '#10B981', 14, FALSE),
('submitted_to_executive_4', 'Case submitted to Executive Management 4', '#3B82F6', 15, FALSE),
('executive_4_approved', 'Case approved by Executive Management 4', '#10B981', 16, FALSE),
('finance_disbursement', 'Finance disbursement completed', '#059669', 17, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Insert education levels data
INSERT INTO education_levels (name, description) VALUES
('Illiterate', 'Cannot read or write'),
('Primary (1-5)', 'Primary school education'),
('Middle (6-8)', 'Middle school education'),
('Secondary (9-10)', 'Secondary school education'),
('Higher Secondary (11-12)', 'Higher secondary education'),
('Diploma', 'Diploma course'),
('Graduate', 'Bachelor degree'),
('Post Graduate', 'Master degree'),
('PhD', 'Doctorate degree'),
('Professional Degree', 'Professional qualification (CA, CS, etc.)'),
('Technical Training', 'Technical or vocational training'),
('Religious Education', 'Madrasa or religious education'),
('Other', 'Other education qualification')
ON DUPLICATE KEY UPDATE name = name;

-- Insert executive levels data
INSERT INTO executive_levels (name, description, level_number, sort_order) VALUES
('Executive Level 1', 'First level executive approval', 1, 1),
('Executive Level 2', 'Second level executive approval', 2, 2),
('Executive Level 3', 'Third level executive approval', 3, 3),
('Executive Level 4', 'Fourth level executive approval', 4, 4)
ON DUPLICATE KEY UPDATE name = name;

-- Insert occupations data
INSERT INTO occupations (name, description) VALUES
('Unemployed', 'Currently not employed'),
('Student', 'Currently studying'),
('Housewife', 'Homemaker'),
('Business Owner', 'Owns and operates a business'),
('Employee - Private', 'Works in private sector'),
('Employee - Government', 'Works in government sector'),
('Employee - Public Sector', 'Works in public sector undertaking'),
('Self Employed', 'Works independently'),
('Daily Wage Worker', 'Works on daily wage basis'),
('Farmer', 'Agricultural work'),
('Laborer', 'Manual labor work'),
('Professional', 'Professional services (Doctor, Engineer, etc.)'),
('Teacher', 'Teaching profession'),
('Retired', 'Retired from work'),
('Other', 'Other occupation')
ON DUPLICATE KEY UPDATE name = name;

-- Insert relations data
INSERT INTO relations (name, description) VALUES
('Father', 'Father'),
('Mother', 'Mother'),
('Son', 'Son'),
('Daughter', 'Daughter'),
('Brother', 'Brother'),
('Sister', 'Sister'),
('Husband', 'Husband'),
('Wife', 'Wife'),
('Father-in-law', 'Father-in-law'),
('Mother-in-law', 'Mother-in-law'),
('Son-in-law', 'Son-in-law'),
('Daughter-in-law', 'Daughter-in-law'),
('Brother-in-law', 'Brother-in-law'),
('Sister-in-law', 'Sister-in-law'),
('Grandfather', 'Grandfather'),
('Grandmother', 'Grandmother'),
('Grandson', 'Grandson'),
('Granddaughter', 'Granddaughter'),
('Uncle', 'Uncle'),
('Aunt', 'Aunt'),
('Nephew', 'Nephew'),
('Niece', 'Niece'),
('Cousin', 'Cousin'),
('Other', 'Other relation')
ON DUPLICATE KEY UPDATE name = name;

-- Insert sample jamiat data
INSERT INTO jamiat (jamiat_id, name, is_active, created_by) VALUES
('1', 'Mumbai', TRUE, 1),
('2', 'Delhi', TRUE, 1),
('3', 'Bangalore', TRUE, 1),
('4', 'Chennai', TRUE, 1),
('5', 'Kolkata', TRUE, 1)
ON DUPLICATE KEY UPDATE jamiat_id = VALUES(jamiat_id);

-- Insert sample jamaat data
INSERT INTO jamaat (jamiat_id, jamaat_id, name, is_active, created_by) VALUES
(1, '10', 'BADRI MOHALLA (MUMBAI)', TRUE, 1),
(1, '11', 'MUMBAI CENTRAL', TRUE, 1),
(1, '12', 'MUMBAI NORTH', TRUE, 1),
(2, '20', 'DELHI CENTRAL', TRUE, 1),
(2, '21', 'DELHI NORTH', TRUE, 1),
(3, '30', 'BANGALORE CENTRAL', TRUE, 1),
(3, '31', 'BANGALORE SOUTH', TRUE, 1),
(4, '40', 'CHENNAI CENTRAL', TRUE, 1),
(5, '50', 'KOLKATA CENTRAL', TRUE, 1)
ON DUPLICATE KEY UPDATE jamaat_id = VALUES(jamaat_id);

-- Insert default counseling form stage permissions
INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'personal',
    'Personal Details',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'family',
    'Family Details',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'assessment',
    'Assessment',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'financial',
    'Financial Assistance',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'growth',
    'Economic Growth',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'declaration',
    'Declaration',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

INSERT IGNORE INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
SELECT 
    r.id,
    'attachments',
    'Attachments',
    FALSE,
    FALSE
FROM roles r
WHERE r.is_active = 1;

-- Step 18: Create Workflow Stages
-- =====================================================

-- Insert workflow stages (these will be populated by application logic)
-- The stages will be created and linked via the setup_workflow_chain logic

-- Step 19: Setup Workflow Chain
-- =====================================================

-- Create missing workflow stages
INSERT INTO workflow_stages (stage_name, stage_key, description, sort_order, associated_statuses, is_active)
SELECT 'KG Review', 'kg_review', 'Khidmat Guzar review and approval', 6, JSON_ARRAY('submitted_to_kg_review'), TRUE
WHERE NOT EXISTS (SELECT 1 FROM workflow_stages WHERE stage_key = 'kg_review');

INSERT INTO workflow_stages (stage_name, stage_key, description, sort_order, associated_statuses, is_active)
SELECT 'Operations Lead', 'operations_lead', 'Operation Lead review and approval', 7, JSON_ARRAY('submitted_to_operations_lead'), TRUE
WHERE NOT EXISTS (SELECT 1 FROM workflow_stages WHERE stage_key = 'operations_lead');

-- Create cover letter stage
INSERT INTO workflow_stages (stage_name, stage_key, description, sort_order, associated_statuses, is_active)
SELECT 'Cover Letter', 'cover_letter', 'Cover letter form completion stage', 8, JSON_ARRAY('submitted_to_cover_letter'), TRUE
WHERE NOT EXISTS (SELECT 1 FROM workflow_stages WHERE stage_key = 'cover_letter');

-- Update ZI stage associated statuses
UPDATE workflow_stages 
SET associated_statuses = JSON_ARRAY('submitted_to_zi', 'submitted_to_zi_review')
WHERE (stage_key LIKE '%zi%' OR stage_key LIKE '%zonal%')
  AND is_active = TRUE;

-- Setup workflow chain (next_stage_id relationships)
UPDATE workflow_stages ws1
SET next_stage_id = (SELECT id FROM workflow_stages ws2 WHERE (ws2.stage_key LIKE '%zi%' OR ws2.stage_key LIKE '%zonal%') AND ws2.is_active = TRUE LIMIT 1)
WHERE ws1.stage_key LIKE '%welfare%' 
  AND ws1.stage_key LIKE '%review%'
  AND ws1.is_active = TRUE
  AND ws1.next_stage_id IS NULL;

UPDATE workflow_stages ws1
SET next_stage_id = (SELECT id FROM workflow_stages ws2 WHERE ws2.stage_key = 'kg_review' AND ws2.is_active = TRUE LIMIT 1)
WHERE (ws1.stage_key LIKE '%zi%' OR ws1.stage_key LIKE '%zonal%')
  AND ws1.is_active = TRUE
  AND ws1.next_stage_id IS NULL;

UPDATE workflow_stages ws1
SET next_stage_id = (SELECT id FROM workflow_stages ws2 WHERE ws2.stage_key = 'operations_lead' AND ws2.is_active = TRUE LIMIT 1)
WHERE ws1.stage_key = 'kg_review'
  AND ws1.is_active = TRUE
  AND ws1.next_stage_id IS NULL;

UPDATE workflow_stages ws1
SET next_stage_id = (SELECT id FROM workflow_stages ws2 WHERE ws2.stage_key = 'cover_letter' AND ws2.is_active = TRUE LIMIT 1)
WHERE ws1.stage_key = 'operations_lead' AND ws1.is_active = TRUE;

UPDATE workflow_stages ws1
SET next_stage_id = (SELECT id FROM workflow_stages ws2 WHERE (ws2.stage_key LIKE '%executive%' OR ws2.stage_key LIKE '%executive_approval%') AND ws2.is_active = TRUE LIMIT 1)
WHERE ws1.stage_key = 'cover_letter' AND ws1.is_active = TRUE;

UPDATE workflow_stages ws1
SET next_stage_id = (SELECT id FROM workflow_stages ws2 WHERE ws2.stage_key LIKE '%executive%' AND ws2.is_active = TRUE ORDER BY ws2.sort_order LIMIT 1)
WHERE ws1.stage_key = 'operations_lead'
  AND ws1.is_active = TRUE
  AND ws1.next_stage_id IS NULL;

-- Step 20: Create Indexes for Performance
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Cases table indexes
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_applicant_id ON cases(applicant_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_dcm ON cases(assigned_dcm_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_counselor ON cases(assigned_counselor_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON cases(created_by);

-- Applicants table indexes
CREATE INDEX IF NOT EXISTS idx_applicants_its_number ON applicants(its_number);
CREATE INDEX IF NOT EXISTS idx_applicants_email ON applicants(email);
CREATE INDEX IF NOT EXISTS idx_applicants_phone ON applicants(phone);

-- Role management indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- Jamiat and Jamaat indexes
CREATE INDEX IF NOT EXISTS idx_jamiat_id ON jamiat(jamiat_id);
CREATE INDEX IF NOT EXISTS idx_jamiat_name ON jamiat(name);
CREATE INDEX IF NOT EXISTS idx_jamiat_active ON jamiat(is_active);
CREATE INDEX IF NOT EXISTS idx_jamaat_jamiat_id ON jamaat(jamiat_id);
CREATE INDEX IF NOT EXISTS idx_jamaat_id ON jamaat(jamaat_id);
CREATE INDEX IF NOT EXISTS idx_jamaat_name ON jamaat(name);
CREATE INDEX IF NOT EXISTS idx_jamaat_active ON jamaat(is_active);

-- Master data indexes
CREATE INDEX IF NOT EXISTS idx_case_types_name ON case_types(name);
CREATE INDEX IF NOT EXISTS idx_case_types_active ON case_types(is_active);
CREATE INDEX IF NOT EXISTS idx_statuses_name ON statuses(name);
CREATE INDEX IF NOT EXISTS idx_statuses_active ON statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_education_levels_name ON education_levels(name);
CREATE INDEX IF NOT EXISTS idx_education_levels_active ON education_levels(is_active);
CREATE INDEX IF NOT EXISTS idx_executive_levels_name ON executive_levels(name);
CREATE INDEX IF NOT EXISTS idx_executive_levels_active ON executive_levels(is_active);
CREATE INDEX IF NOT EXISTS idx_occupations_name ON occupations(name);
CREATE INDEX IF NOT EXISTS idx_occupations_active ON occupations(is_active);
CREATE INDEX IF NOT EXISTS idx_relations_name ON relations(name);
CREATE INDEX IF NOT EXISTS idx_relations_active ON relations(is_active);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_stages_stage_key ON workflow_stages(stage_key);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_active ON workflow_stages(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_roles_stage_id ON workflow_stage_roles(workflow_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_roles_role_id ON workflow_stage_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_users_stage_id ON workflow_stage_users(workflow_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_users_user_id ON workflow_stage_users(user_id);

-- Step 21: Assign admin role to existing admin user
-- =====================================================
INSERT INTO user_roles (user_id, role_id, assigned_by, is_active)
SELECT u.id, r.id, u.id, 1
FROM users u, roles r
WHERE u.role = 'admin' AND r.name = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Your Baaseteen Case Management System database is now ready!
-- 
-- Database Features:
-- 1. Complete user management with RBAC
-- 2. Case management with workflow stages
-- 3. Applicant and counseling form management
-- 4. File attachment and notification system
-- 5. Jamiat and Jamaat master data
-- 6. Comprehensive audit trails
-- 7. Performance optimized with proper indexes
-- 8. Payment schedules and disbursement tracking
-- 9. Welfare checklist management
-- 10. Cover letter forms
-- 11. SLA tracking
-- 
-- Default Admin User:
-- Username: admin
-- Email: admin@baaseteen.com
-- Password: password (hashed)
-- 
-- You can now:
-- 1. Start the backend server
-- 2. Access the frontend application
-- 3. Login with admin credentials
-- 4. Begin managing cases and users
-- 
-- =====================================================

