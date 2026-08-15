-- Additive: per-line-item discount applicability (defaults keep existing behavior)
ALTER TABLE `invoice_items` ADD COLUMN `discountable` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `proforma_items` ADD COLUMN `discountable` BOOLEAN NOT NULL DEFAULT true;
