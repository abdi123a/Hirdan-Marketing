-- First billing period a subscription may be auto-invoiced for ("YYYY-MM").
-- NULL for existing rows: the billing job derives it from created_at.
ALTER TABLE `subscriptions` ADD COLUMN `first_billing_period` VARCHAR(7) NULL;
