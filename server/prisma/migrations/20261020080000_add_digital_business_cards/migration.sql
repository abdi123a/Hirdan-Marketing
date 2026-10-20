-- Digital business cards (CRM → Business Cards). Each card is a public page at
-- hirdan.cc/c/<slug> with its own copy of the person's details, optionally linked
-- to a team member. Visitors can save the contact or leave their details (card_leads).
CREATE TABLE `business_cards` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `member_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `photo_url` TEXT NULL,
    `bio` TEXT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `saves` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `business_cards_slug_key`(`slug`),
    INDEX `business_cards_member_id_idx`(`member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `card_leads` (
    `id` VARCHAR(191) NOT NULL,
    `card_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `card_leads_card_id_idx`(`card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `business_cards` ADD CONSTRAINT `business_cards_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `team_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `card_leads` ADD CONSTRAINT `card_leads_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `business_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
