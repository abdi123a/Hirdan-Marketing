-- AlterTable: Add follower growth delta tracking columns to account_insights_daily
ALTER TABLE `account_insights_daily`
    ADD COLUMN `new_follows` INT NULL,
    ADD COLUMN `unfollows` INT NULL;

-- CreateTable: social_ad_spend
CREATE TABLE `social_ad_spend` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `month` INT NOT NULL,
    `year` INT NOT NULL,
    `spend_cents` INT NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `paid_reach` INT NULL,
    `link_clicks` INT NULL,
    `paid_engagement` INT NULL,
    `messages_started` INT NULL,
    `notes` TEXT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_ad_spend_client_id_platform_month_year_key`(`client_id`, `platform`, `month`, `year`),
    INDEX `social_ad_spend_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: social_performance_reports
CREATE TABLE `social_performance_reports` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `month` INT NOT NULL,
    `year` INT NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_performance_reports_client_id_month_year_key`(`client_id`, `month`, `year`),
    INDEX `social_performance_reports_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: social_performance_report_sections
CREATE TABLE `social_performance_report_sections` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `order` INT NOT NULL,
    `content` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_performance_report_sections_report_id_key_key`(`report_id`, `key`),
    INDEX `social_performance_report_sections_report_id_order_idx`(`report_id`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: social_performance_report_versions
CREATE TABLE `social_performance_report_versions` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `snapshot_json` JSON NOT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_performance_report_versions_report_id_created_at_idx`(`report_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_ad_spend` ADD CONSTRAINT `social_ad_spend_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_performance_reports` ADD CONSTRAINT `social_performance_reports_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_performance_report_sections` ADD CONSTRAINT `social_performance_report_sections_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `social_performance_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_performance_report_versions` ADD CONSTRAINT `social_performance_report_versions_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `social_performance_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
