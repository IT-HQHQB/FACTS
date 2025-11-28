-- Add Enayat repayment schedule table and non-financial assistance columns to financial_assistance
-- Migration: add_enayat_and_non_financial_to_financial_assistance.sql

-- Create financial_assistance_enayat_repayment_schedule table
-- This table stores Enayat repayment schedules similar to QH repayment schedules
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

-- Add non-financial assistance columns to financial_assistance table
ALTER TABLE financial_assistance
ADD COLUMN non_financial_mentoring TEXT NULL COMMENT 'Non-financial help: Mentoring',
ADD COLUMN non_financial_skill_development TEXT NULL COMMENT 'Non-financial help: Skill Development',
ADD COLUMN non_financial_sourcing_support TEXT NULL COMMENT 'Non-financial help: Sourcing Support',
ADD COLUMN non_financial_sales_market_access TEXT NULL COMMENT 'Non-financial help: Sales/Market Access',
ADD COLUMN non_financial_other_solar TEXT NULL COMMENT 'Non-financial help: Other / Solar';

