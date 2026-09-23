-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `billing_period` VARCHAR(16) NULL;

-- AlterTable
ALTER TABLE `accounts` ADD COLUMN `opening_balance` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `recurring_expense_id` VARCHAR(191) NULL,
    ADD COLUMN `recurring_period` VARCHAR(16) NULL;

-- AlterTable
ALTER TABLE `account_transfers` ADD COLUMN `to_amount` INTEGER NULL;

-- Backfill: existing transfers were same-amount copies.
UPDATE `account_transfers` SET `to_amount` = `amount` WHERE `to_amount` IS NULL;

-- Backfill: mark existing auto-generated subscription invoices with the
-- calendar month (UTC) they were issued in, so the next billing run does not
-- bill that month again. The old job could create duplicates for the same
-- (subscription, month); only ONE row per group (lowest id) receives the key,
-- the rest stay NULL (MySQL unique indexes allow repeated NULLs), so the
-- unique index below cannot fail on existing data. Duplicates are left in
-- place for a human to void — deleting invoices here would be unsafe.
UPDATE `invoices` i
JOIN (
    SELECT MIN(`id`) AS `id`
    FROM `invoices`
    WHERE `subscription_id` IS NOT NULL AND `auto_generated` = 1
    GROUP BY `subscription_id`, DATE_FORMAT(`date`, '%Y-%m')
) pick ON pick.`id` = i.`id`
SET i.`billing_period` = DATE_FORMAT(i.`date`, '%Y-%m');

-- CreateIndex
CREATE INDEX `invoices_status_due_date_idx` ON `invoices`(`status`, `due_date`);

-- CreateIndex
CREATE UNIQUE INDEX `invoices_subscription_id_billing_period_key` ON `invoices`(`subscription_id`, `billing_period`);

-- CreateIndex
-- New columns are all NULL, so this cannot conflict with existing rows.
CREATE UNIQUE INDEX `expenses_recurring_expense_id_recurring_period_key` ON `expenses`(`recurring_expense_id`, `recurring_period`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_recurring_expense_id_fkey` FOREIGN KEY (`recurring_expense_id`) REFERENCES `recurring_expenses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
