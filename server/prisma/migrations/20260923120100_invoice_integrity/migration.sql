-- AlterTable
ALTER TABLE `proformas` ADD COLUMN `converted_invoice_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `deposits` ADD COLUMN `invoice_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `proformas_converted_invoice_id_key` ON `proformas`(`converted_invoice_id`);

-- CreateIndex
CREATE INDEX `deposits_invoice_id_idx` ON `deposits`(`invoice_id`);

-- AddForeignKey
ALTER TABLE `proformas` ADD CONSTRAINT `proformas_converted_invoice_id_fkey` FOREIGN KEY (`converted_invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: link existing invoice-derived ledger deposits to their invoice.
-- deposit-sync.ts has always written descriptions of the form
-- "Payment for Invoice <number> (ID: <invoice uuid>)"; only rows whose
-- embedded id matches an existing invoice are linked (so the FK holds).
UPDATE `deposits` d
  JOIN `invoices` i
    ON i.`id` = SUBSTRING(d.`description`, LOCATE('(ID: ', d.`description`) + 5, 36)
SET d.`invoice_id` = i.`id`
WHERE d.`invoice_id` IS NULL
  AND LOCATE('(ID: ', d.`description`) > 0;
