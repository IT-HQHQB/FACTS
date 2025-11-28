-- Add months columns to financial_assistance_qh_repayment_schedule table
-- Migration: add_months_to_qh_repayment_schedule.sql

-- Add month columns to financial_assistance_qh_repayment_schedule table
ALTER TABLE financial_assistance_qh_repayment_schedule
ADD COLUMN month1 TINYINT NULL COMMENT 'Number of months for Year 1 (1-12)',
ADD COLUMN month2 TINYINT NULL COMMENT 'Number of months for Year 2 (1-12)',
ADD COLUMN month3 TINYINT NULL COMMENT 'Number of months for Year 3 (1-12)',
ADD COLUMN month4 TINYINT NULL COMMENT 'Number of months for Year 4 (1-12)',
ADD COLUMN month5 TINYINT NULL COMMENT 'Number of months for Year 5 (1-12)';


