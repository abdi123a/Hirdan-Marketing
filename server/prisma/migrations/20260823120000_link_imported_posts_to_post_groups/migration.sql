-- Let a post group claim a natively-published video.
--
-- A post cross-published through the system is one social_posts row with a
-- destination per platform. TikTok cannot be one of them — we have no API
-- publish approval — so a video posted by hand in the TikTok app only ever
-- reaches the system as an imported_posts row from a Studio export, and shows
-- up as a second, unrelated item next to the Instagram/Facebook group it
-- actually belongs to.
--
-- This column lets the user attach that imported row to the group as a real
-- TikTok destination. Storing the imported_posts id (rather than re-deriving a
-- match from the video id on every read) makes the grouping explicit and
-- reversible, and it survives re-importing the export: the importer upserts on
-- (social_account_id, external_id), so the row id is stable and refreshed
-- metrics flow into the group with no re-linking.
--
-- The UNIQUE index is the guard that one imported video can never be counted
-- into two post groups.
--
-- ON DELETE CASCADE because a destination carrying this column exists solely to
-- represent that export row — nothing of ours was published there. If the row
-- goes (clearImportedData() deletes imported_posts wholesale), the destination
-- has nothing left to stand for: leaving it behind would keep a TikTok publish
-- on the post with no figures anywhere, and with the id nulled out the UI could
-- no longer tell it from a real publish, so the user could not remove it.
-- Cascading is exactly the unlink they would have asked for.
--
-- Purely additive: the column is nullable, so every existing row stays valid.

-- AlterTable
ALTER TABLE `social_post_destinations` ADD COLUMN `imported_post_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `social_post_destinations_imported_post_id_key` ON `social_post_destinations`(`imported_post_id`);

-- AddForeignKey
ALTER TABLE `social_post_destinations` ADD CONSTRAINT `social_post_destinations_imported_post_id_fkey` FOREIGN KEY (`imported_post_id`) REFERENCES `imported_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
