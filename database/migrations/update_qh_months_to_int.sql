-- Update month columns from TINYINT to INT to support larger month values (e.g., 36, 24, 18)
-- Migration: update_qh_months_to_int.sql

-- Alter month columns to INT to support values > 127
ALTER TABLE financial_assistance_qh_repayment_schedule
MODIFY COLUMN month1 INT NULL COMMENT 'Number of months for Year 1 (any positive number)',
MODIFY COLUMN month2 INT NULL COMMENT 'Number of months for Year 2 (any positive number)',
MODIFY COLUMN month3 INT NULL COMMENT 'Number of months for Year 3 (any positive number)',
MODIFY COLUMN month4 INT NULL COMMENT 'Number of months for Year 4 (any positive number)',
MODIFY COLUMN month5 INT NULL COMMENT 'Number of months for Year 5 (any positive number)';


