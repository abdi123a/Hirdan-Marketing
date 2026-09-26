-- Track when the transfer cleanup job removed a shared file from disk.
--
-- The hourly job used `is_deleted = 1` as its "already handled" marker, but
-- its own query selects `is_deleted = 1` rows too, so every soft-deleted or
-- expired transfer was re-fetched and re-marked forever (34 rows an hour on
-- production by 2026-09-26). A dedicated nullable timestamp lets the query
-- skip rows whose file is already gone, and keeps `deleted_at` meaning what
-- the user did rather than what the janitor did.
ALTER TABLE `shared_files` ADD COLUMN `file_purged_at` DATETIME(3) NULL;
