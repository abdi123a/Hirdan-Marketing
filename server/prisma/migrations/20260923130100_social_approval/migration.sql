-- Social post approval workflow: who submitted / approved / rejected a post.

-- AlterTable
ALTER TABLE `social_posts` ADD COLUMN `approved_at` DATETIME(3) NULL,
    ADD COLUMN `approved_by_id` VARCHAR(191) NULL,
    ADD COLUMN `rejected_at` DATETIME(3) NULL,
    ADD COLUMN `rejected_by_id` VARCHAR(191) NULL,
    ADD COLUMN `rejection_reason` TEXT NULL,
    ADD COLUMN `submitted_at` DATETIME(3) NULL,
    ADD COLUMN `submitted_by_id` VARCHAR(191) NULL;

-- Backfill: posts that were already scheduled or went through the publishing
-- engine before approval existed count as approved, so retries and the
-- scheduler keep working for them. Drafts and posts awaiting approval stay
-- unapproved. approved_by_id stays NULL: nobody recorded who scheduled them.
UPDATE `social_posts`
SET `approved_at` = `updated_at`
WHERE `approved_at` IS NULL
  AND `status` IN ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIAL', 'FAILED');

-- Posts already waiting for approval: treat their last edit as the submission.
UPDATE `social_posts`
SET `submitted_at` = `updated_at`
WHERE `submitted_at` IS NULL
  AND `status` = 'AWAITING_APPROVAL';
