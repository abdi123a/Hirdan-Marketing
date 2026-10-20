-- iPhones that added a business card to Apple Wallet, so card edits can be pushed to them.
CREATE TABLE `wallet_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `push_token` VARCHAR(191) NOT NULL,
    `card_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallet_registrations_device_id_card_id_key`(`device_id`, `card_id`),
    INDEX `wallet_registrations_card_id_idx`(`card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `wallet_registrations` ADD CONSTRAINT `wallet_registrations_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `business_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
