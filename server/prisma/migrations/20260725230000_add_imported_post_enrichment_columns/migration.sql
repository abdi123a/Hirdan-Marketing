-- Add the TikTok enrichment columns to `imported_posts`.
--
-- These four fields were added to the ImportedPost model in schema.prisma
-- (commit dadc87f) without an accompanying migration, so `migrate deploy` left
-- production on the old table shape. The generated client selects every scalar
-- column, so each importedPost query asked MySQL for `thumbnail_url` and got
-- "Unknown column" back — surfacing as a 500 on the analytics endpoints.
--
-- Purely additive: every column is nullable or defaulted, so existing rows stay
-- valid and no data is read, moved or dropped.

-- AlterTable
ALTER TABLE `imported_posts` ADD COLUMN `thumbnail_url` TEXT NULL,
    ADD COLUMN `is_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `verified_at` DATETIME(3) NULL,
    ADD COLUMN `verification_source` VARCHAR(191) NULL;
