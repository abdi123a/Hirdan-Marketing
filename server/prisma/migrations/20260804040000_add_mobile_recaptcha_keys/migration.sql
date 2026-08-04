-- Application-type reCAPTCHA keys for the native mobile apps
ALTER TABLE `agency_settings`
  ADD COLUMN `recaptcha_android_site_key` VARCHAR(191) NULL,
  ADD COLUMN `recaptcha_ios_site_key` VARCHAR(191) NULL,
  ADD COLUMN `recaptcha_enterprise_project_id` VARCHAR(191) NULL;
