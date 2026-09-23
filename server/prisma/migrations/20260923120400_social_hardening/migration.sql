-- Social publishing hardening.
--
-- 1. Server-side OAuth state (single-use, bound to the initiating user, holds
--    the PKCE verifier and Meta account-picker sessions).
-- 2. One destination per (post, social account). The publish routes never
--    intend duplicates; a duplicate row would publish the same post to the same
--    account twice.

-- CreateTable
CREATE TABLE `social_oauth_states` (
    `id` VARCHAR(64) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `platform` VARCHAR(32) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `code_verifier` TEXT NULL,
    `payload_enc` LONGTEXT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_oauth_states_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Data safety: remove duplicate destinations before adding the unique index.
-- Per (post_id, social_account_id) keep the most meaningful row: a published
-- one (with a platform post id / hand-linked import) over an in-flight one over
-- a queued/failed one; ties broken by id so the result is deterministic.
-- (Double-nested derived table: MySQL refuses to DELETE from a table that the
-- same statement also reads unless the read is materialized.)
DELETE d FROM `social_post_destinations` d
JOIN (
    SELECT `id` FROM (
        SELECT `id`,
               ROW_NUMBER() OVER (
                   PARTITION BY `post_id`, `social_account_id`
                   ORDER BY (`status` = 'PUBLISHED') DESC,
                            (`platform_post_id` IS NOT NULL) DESC,
                            (`imported_post_id` IS NOT NULL) DESC,
                            (`status` = 'PUBLISHING') DESC,
                            `published_at` DESC,
                            `id` ASC
               ) AS rn
        FROM `social_post_destinations`
    ) ranked
    WHERE ranked.rn > 1
) dup ON dup.`id` = d.`id`;

-- CreateIndex
CREATE UNIQUE INDEX `social_post_destinations_post_id_social_account_id_key` ON `social_post_destinations`(`post_id`, `social_account_id`);
