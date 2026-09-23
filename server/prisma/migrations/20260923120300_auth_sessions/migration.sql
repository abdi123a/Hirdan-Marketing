-- AlterTable
ALTER TABLE `users` ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `locked_until` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `refresh_tokens` ADD COLUMN `family_id` VARCHAR(36) NULL,
    ADD COLUMN `session_started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `used_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `refresh_tokens_family_id_idx` ON `refresh_tokens`(`family_id`);


-- Existing sessions: count the absolute lifetime from when they were issued.
UPDATE `refresh_tokens` SET `session_started_at` = `created_at`;
