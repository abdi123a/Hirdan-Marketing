-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `password_reset_token` VARCHAR(512) NULL,
    `password_reset_expiry` DATETIME(3) NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'STAFF', 'CLIENT') NOT NULL DEFAULT 'CLIENT',
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_password_reset_token_key`(`password_reset_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `company` VARCHAR(191) NOT NULL,
    `type` ENUM('BUSINESS', 'INDIVIDUAL') NOT NULL DEFAULT 'BUSINESS',
    `website` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `industry` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'CHURNED') NOT NULL DEFAULT 'ACTIVE',
    `initials` VARCHAR(191) NULL,
    `invoice_generation_day` INTEGER NULL,
    `payment_reminder_delay` INTEGER NULL,
    `overdue_notice_delay` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `portal_access` JSON NULL,

    UNIQUE INDEX `clients_user_id_key`(`user_id`),
    INDEX `clients_email_idx`(`email`),
    INDEX `clients_company_idx`(`company`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_meetings` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `client_meetings_client_id_idx`(`client_id`),
    INDEX `client_meetings_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'ARCHIVED') NOT NULL DEFAULT 'IN_PROGRESS',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `budget` INTEGER NULL,
    `start_date` DATETIME(3) NULL,
    `due_date` DATETIME(3) NULL,
    `tags` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `projects_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_team_members` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,

    INDEX `project_team_members_member_id_fkey`(`member_id`),
    UNIQUE INDEX `project_team_members_project_id_member_id_key`(`project_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_DOCUMENTS', 'ACTIVE', 'ON_LEAVE', 'TERMINATED') NOT NULL DEFAULT 'DRAFT',
    `avatar` VARCHAR(191) NULL,
    `photo_url` LONGTEXT NULL,
    `hourly_rate` INTEGER NULL,
    `start_date` DATETIME(3) NULL,
    `bio` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `archived_at` DATETIME(3) NULL,
    `date_of_birth` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `national_id` VARCHAR(191) NULL,
    `national_id_type` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `home_address` TEXT NULL,
    `emergency_contact_name` VARCHAR(191) NULL,
    `emergency_contact_relation` VARCHAR(191) NULL,
    `emergency_contact_phone` VARCHAR(191) NULL,
    `employment_type` VARCHAR(191) NULL,
    `manager_id` VARCHAR(191) NULL,
    `work_location` VARCHAR(191) NULL,
    `is_hourly_mode` BOOLEAN NOT NULL DEFAULT false,
    `basic_salary` INTEGER NULL,
    `housing_allowance` INTEGER NULL,
    `transport_allowance` INTEGER NULL,
    `other_allowances` TEXT NULL,
    `bank_name` VARCHAR(191) NULL,
    `account_number` VARCHAR(191) NULL,
    `tax_id` VARCHAR(191) NULL,
    `payment_method` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'USD',

    UNIQUE INDEX `team_members_user_id_key`(`user_id`),
    UNIQUE INDEX `team_members_email_key`(`email`),
    INDEX `team_members_manager_id_idx`(`manager_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_files` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `category` ENUM('ID_DOC', 'CONTRACT', 'CV', 'CERTIFICATE', 'OTHER') NOT NULL,
    `label` VARCHAR(191) NULL,
    `file_url` LONGTEXT NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `uploaded_by` VARCHAR(191) NULL,

    INDEX `employee_files_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_activity` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `actionType` ENUM('CREATED', 'EDITED', 'STATUS_CHANGED', 'FILE_UPLOADED', 'FILE_DELETED', 'REACTIVATED', 'ARCHIVED') NOT NULL,
    `performed_by` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_activity_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_number` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `date` DATETIME(3) NOT NULL,
    `due_date` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `tax_rate` DOUBLE NULL,
    `discount` DOUBLE NULL,
    `discount_type` ENUM('PERCENTAGE', 'FIXED') NULL,
    `deposit` INTEGER NULL,
    `payment_method` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `show_signature` BOOLEAN NOT NULL DEFAULT true,
    `show_stamp` BOOLEAN NOT NULL DEFAULT true,
    `delivery_note_enabled` BOOLEAN NOT NULL DEFAULT false,
    `delivery_note_title` VARCHAR(191) NULL,
    `delivery_note_content` TEXT NULL,
    `subscription_id` VARCHAR(191) NULL,
    `auto_generated` BOOLEAN NOT NULL DEFAULT false,
    `payment_confirmation_sent_at` DATETIME(3) NULL,
    `reminder_sent_at` DATETIME(3) NULL,
    `overdue_sent_at` DATETIME(3) NULL,
    `due_soon_notified_at` DATETIME(3) NULL,

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    INDEX `invoices_client_id_idx`(`client_id`),
    INDEX `invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `invoice_items_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proformas` (
    `id` VARCHAR(191) NOT NULL,
    `proforma_number` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_PAID', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `date` DATETIME(3) NOT NULL,
    `due_date` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `tax_rate` DOUBLE NULL,
    `discount` DOUBLE NULL,
    `discount_type` ENUM('PERCENTAGE', 'FIXED') NULL,
    `deposit` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `show_signature` BOOLEAN NOT NULL DEFAULT true,
    `show_stamp` BOOLEAN NOT NULL DEFAULT true,
    `delivery_note_enabled` BOOLEAN NOT NULL DEFAULT false,
    `delivery_note_title` VARCHAR(191) NULL,
    `delivery_note_content` TEXT NULL,

    UNIQUE INDEX `proformas_proforma_number_key`(`proforma_number`),
    INDEX `proformas_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proforma_items` (
    `id` VARCHAR(191) NOT NULL,
    `proforma_id` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `proforma_items_proforma_id_idx`(`proforma_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NULL,
    `plan` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `billing_cycle` ENUM('MONTHLY', 'QUARTERLY', 'ANNUAL') NOT NULL DEFAULT 'MONTHLY',
    `start_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `end_date` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'TRIAL') NOT NULL DEFAULT 'ACTIVE',
    `features` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscriptions_client_id_idx`(`client_id`),
    INDEX `subscriptions_package_id_idx`(`package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `packages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` INTEGER NOT NULL,
    `features` TEXT NULL,
    `type` ENUM('SERVICE', 'SUBSCRIPTION', 'ONE_TIME') NOT NULL DEFAULT 'SUBSCRIPTION',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `base_price` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('AVAILABLE', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_services` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `service_id` VARCHAR(191) NOT NULL,

    INDEX `package_services_service_id_fkey`(`service_id`),
    UNIQUE INDEX `package_services_package_id_service_id_key`(`package_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(128) NOT NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NULL,
    `proforma_id` VARCHAR(191) NULL,
    `subscription_id` VARCHAR(191) NULL,
    `monthly_report_id` VARCHAR(191) NULL,
    `hr_document_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL DEFAULT (DATE_ADD(NOW(), INTERVAL 365 DAY)),
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `verification_tokens_token_key`(`token`),
    INDEX `verification_tokens_invoice_id_idx`(`invoice_id`),
    INDEX `verification_tokens_proforma_id_idx`(`proforma_id`),
    INDEX `verification_tokens_subscription_id_idx`(`subscription_id`),
    INDEX `verification_tokens_monthly_report_id_idx`(`monthly_report_id`),
    INDEX `verification_tokens_hr_document_id_idx`(`hr_document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agency_settings` (
    `id` VARCHAR(191) NOT NULL,
    `agency_name` VARCHAR(191) NOT NULL,
    `admin_email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `address` LONGTEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
    `logo` LONGTEXT NULL,
    `white_logo` LONGTEXT NULL,
    `favicon` LONGTEXT NULL,
    `primary_color` VARCHAR(191) NULL,
    `tax_rate` DOUBLE NOT NULL DEFAULT 0,
    `default_invoice_notes` LONGTEXT NULL,
    `payment_methods` LONGTEXT NULL,
    `social_links` LONGTEXT NULL,
    `notifications` LONGTEXT NULL,
    `signature` LONGTEXT NULL,
    `stamp` LONGTEXT NULL,
    `enable_recaptcha` BOOLEAN NOT NULL DEFAULT false,
    `recaptcha_site_key` VARCHAR(191) NULL,
    `recaptcha_secret_key` VARCHAR(191) NULL,
    `google_analytics_enabled` BOOLEAN NOT NULL DEFAULT false,
    `google_analytics_measurement_id` VARCHAR(191) NULL,
    `development_mode` BOOLEAN NOT NULL DEFAULT false,
    `coming_soon_message` LONGTEXT NULL,
    `coming_soon_countdown` VARCHAR(191) NULL,
    `coming_soon_bullets` LONGTEXT NULL,
    `open_ai_api_key` VARCHAR(191) NULL,
    `claude_api_key` VARCHAR(191) NULL,
    `gemini_api_key` VARCHAR(191) NULL,
    `main_ai_provider` VARCHAR(191) NOT NULL DEFAULT 'openai',
    `resend_api_key` VARCHAR(191) NULL,
    `resend_webhook_secret` VARCHAR(191) NULL,
    `resend_inbound_domain` VARCHAR(191) NULL,
    `email_from` VARCHAR(191) NULL,
    `mailer_name` VARCHAR(191) NULL,
    `smtp_host` VARCHAR(191) NULL,
    `smtp_port` INTEGER NULL,
    `smtp_username` VARCHAR(191) NULL,
    `smtp_encryption` VARCHAR(191) NULL,
    `smtp_driver` VARCHAR(191) NULL,
    `mail_enabled` BOOLEAN NOT NULL DEFAULT false,
    `hr_fallback_approver_id` VARCHAR(191) NULL,
    `google_drive_folder_id` VARCHAR(191) NULL,
    `google_drive_service_account_json` LONGTEXT NULL,
    `google_drive_client_id` VARCHAR(191) NULL,
    `google_drive_client_secret` LONGTEXT NULL,
    `google_drive_refresh_token` LONGTEXT NULL,
    `google_drive_enabled` BOOLEAN NOT NULL DEFAULT false,
    `one_signal_app_id` VARCHAR(191) NULL,
    `one_signal_api_key` VARCHAR(191) NULL,
    `one_signal_enabled` BOOLEAN NOT NULL DEFAULT false,
    `meta_enabled` BOOLEAN NOT NULL DEFAULT false,
    `tiktok_enabled` BOOLEAN NOT NULL DEFAULT false,
    `linkedin_enabled` BOOLEAN NOT NULL DEFAULT false,
    `google_enabled` BOOLEAN NOT NULL DEFAULT false,
    `x_enabled` BOOLEAN NOT NULL DEFAULT false,
    `pinterest_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_social_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER') NOT NULL,
    `handle` VARCHAR(191) NULL,
    `profile_url` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `client_social_profiles_client_id_platform_key`(`client_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_documents` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('CONTRACT', 'REPORT', 'ONBOARDING', 'BRAND_GUIDE', 'CONTENT_CALENDAR', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `file_url` VARCHAR(191) NOT NULL,
    `internal_notes` TEXT NULL,
    `client_notes` TEXT NULL,
    `expiry_date` DATETIME(3) NULL,
    `is_signed` BOOLEAN NOT NULL DEFAULT false,
    `client_visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `client_documents_client_id_idx`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_deliverables` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('POST', 'STORY', 'REEL', 'SHORT', 'VIDEO', 'REPORT', 'OTHER') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `package_deliverables_package_id_idx`(`package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverable_platforms` (
    `id` VARCHAR(191) NOT NULL,
    `deliverable_id` VARCHAR(191) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER') NOT NULL,

    UNIQUE INDEX `deliverable_platforms_deliverable_id_platform_key`(`deliverable_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_cycles` (
    `id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `cycle_start` DATETIME(3) NOT NULL,
    `cycle_end` DATETIME(3) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `tasks_generated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subscription_cycles_subscription_id_idx`(`subscription_id`),
    UNIQUE INDEX `subscription_cycles_subscription_id_cycle_start_key`(`subscription_id`, `cycle_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverable_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `cycle_id` VARCHAR(191) NOT NULL,
    `content_post_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('POST', 'STORY', 'REEL', 'SHORT', 'VIDEO', 'REPORT', 'OTHER') NOT NULL,
    `due_date` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'PLANNED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `team_member_id` VARCHAR(191) NULL,
    `internal_notes` TEXT NULL,
    `client_notes` TEXT NULL,
    `media_url` VARCHAR(191) NULL,
    `post_url` VARCHAR(191) NULL,
    `posted_at` DATETIME(3) NULL,
    `proof_url` VARCHAR(191) NULL,
    `client_visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deliverable_tasks_client_id_idx`(`client_id`),
    INDEX `deliverable_tasks_subscription_id_idx`(`subscription_id`),
    INDEX `deliverable_tasks_cycle_id_idx`(`cycle_id`),
    INDEX `deliverable_tasks_content_post_id_idx`(`content_post_id`),
    INDEX `deliverable_tasks_team_member_id_idx`(`team_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_platforms` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER') NOT NULL,

    UNIQUE INDEX `task_platforms_task_id_platform_key`(`task_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_posts` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER') NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'FILMED', 'PUBLISHED', 'DELAYED') NOT NULL DEFAULT 'DRAFT',
    `content_type` VARCHAR(191) NULL,
    `shooting_date` DATETIME(3) NULL,
    `publish_date` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `attachment_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `content_posts_client_id_idx`(`client_id`),
    INDEX `content_posts_client_id_month_year_idx`(`client_id`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monthly_reports` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `source_text` LONGTEXT NOT NULL,
    `data_quality` LONGTEXT NULL,
    `theme_snapshot` LONGTEXT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `monthly_reports_created_by_id_idx`(`created_by_id`),
    UNIQUE INDEX `monthly_reports_client_id_month_year_key`(`client_id`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monthly_report_sections` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `content` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `monthly_report_sections_report_id_order_idx`(`report_id`, `order`),
    UNIQUE INDEX `monthly_report_sections_report_id_key_key`(`report_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monthly_report_assets` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `section_key` VARCHAR(191) NOT NULL,
    `slot_key` VARCHAR(191) NOT NULL,
    `url` LONGTEXT NOT NULL,
    `caption` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `monthly_report_assets_report_id_idx`(`report_id`),
    UNIQUE INDEX `monthly_report_assets_report_id_section_key_slot_key_key`(`report_id`, `section_key`, `slot_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monthly_report_versions` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `snapshot_json` JSON NOT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `monthly_report_versions_report_id_created_at_idx`(`report_id`, `created_at`),
    INDEX `monthly_report_versions_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('BANK', 'MOBILE_WALLET', 'CASH') NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `color` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `image` LONGTEXT NULL,
    `notes` TEXT NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `description` TEXT NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `receipt_url` LONGTEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `expenses_account_id_idx`(`account_id`),
    INDEX `expenses_date_idx`(`date`),
    INDEX `expenses_category_idx`(`category`),
    INDEX `expenses_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recurring_expenses` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `amount` INTEGER NOT NULL,
    `account_id` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `day_of_month` INTEGER NULL,
    `start_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `end_date` DATETIME(3) NULL,
    `frequency` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recurring_expenses_account_id_idx`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_transfers` (
    `id` VARCHAR(191) NOT NULL,
    `from_account_id` VARCHAR(191) NOT NULL,
    `to_account_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `note` TEXT NULL,
    `date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `account_transfers_from_account_id_idx`(`from_account_id`),
    INDEX `account_transfers_to_account_id_idx`(`to_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposits` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `description` TEXT NULL,
    `date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deposits_account_id_idx`(`account_id`),
    INDEX `deposits_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hr_documents` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `doc_type` ENUM('WORK_CERTIFICATE', 'SALARY_CERTIFICATE', 'PAYSLIP', 'WARNING_CERTIFICATE', 'INTERNSHIP_ACCEPTED_CERTIFICATE', 'INTERNSHIP_LETTER') NOT NULL,
    `doc_number` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FINAL') NOT NULL DEFAULT 'DRAFT',
    `generated_by_id` VARCHAR(191) NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_by_id` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `pdf_url` LONGTEXT NULL,
    `content` JSON NULL,

    INDEX `hr_documents_employee_id_idx`(`employee_id`),
    INDEX `hr_documents_generated_by_id_idx`(`generated_by_id`),
    INDEX `hr_documents_approved_by_id_idx`(`approved_by_id`),
    UNIQUE INDEX `hr_documents_doc_number_version_key`(`doc_number`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hr_document_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `hr_document_id` VARCHAR(191) NOT NULL,
    `approver_id` VARCHAR(191) NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `comment` TEXT NULL,
    `decided_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hr_document_approvals_hr_document_id_idx`(`hr_document_id`),
    INDEX `hr_document_approvals_approver_id_idx`(`approver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shared_files` (
    `id` VARCHAR(191) NOT NULL,
    `share_id` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `stored_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NULL,
    `uploaded_by_id` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `email_sent_to` VARCHAR(191) NULL,
    `email_sent_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `shared_files_share_id_key`(`share_id`),
    INDEX `shared_files_share_id_idx`(`share_id`),
    INDEX `shared_files_expires_at_is_deleted_idx`(`expires_at`, `is_deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shared_file_events` (
    `id` VARCHAR(191) NOT NULL,
    `shared_file_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shared_file_events_shared_file_id_idx`(`shared_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `landing_page_contents` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `heroImageUrl` VARCHAR(191) NOT NULL DEFAULT '/assets/img/hero/digital-marketing-hero-img-min.png',
    `heroShapeImageUrl` VARCHAR(191) NOT NULL DEFAULT '/assets/img/hero/circle-musk.png',
    `heroBadgeImageUrl` VARCHAR(191) NOT NULL DEFAULT '/assets/img/bale.png',
    `aboutImageUrl` VARCHAR(191) NOT NULL DEFAULT '/assets/img/about/digittal-about-img.png',
    `contactImageUrl` VARCHAR(191) NOT NULL DEFAULT '/assets/img/contact.jpg',
    `trustImageUrl` VARCHAR(191) NOT NULL DEFAULT '/assets/img/about/face-mans-2.png',
    `clientLogos` JSON NOT NULL,
    `heroSubtitle` VARCHAR(191) NOT NULL DEFAULT 'Social Media Marketing',
    `heroTitle` VARCHAR(191) NOT NULL DEFAULT 'Growth With High-Impact Social Media',
    `heroDescription` TEXT NULL,
    `heroBtn1Text` VARCHAR(191) NOT NULL DEFAULT 'Boost My Social Media',
    `heroBtn2Text` VARCHAR(191) NOT NULL DEFAULT 'Work Process',
    `heroAwardNumber` VARCHAR(191) NOT NULL DEFAULT '2K+',
    `heroAwardLabel` VARCHAR(191) NOT NULL DEFAULT 'Happy Client',
    `aboutSubtitle` VARCHAR(191) NOT NULL DEFAULT 'About SEOX',
    `aboutTitle` VARCHAR(191) NOT NULL DEFAULT 'Helping Business All Size Stay Ahead Social Media',
    `aboutDescription` TEXT NULL,
    `aboutBullets` TEXT NULL,
    `aboutCampaigns` VARCHAR(191) NOT NULL DEFAULT '500+',
    `aboutClients` VARCHAR(191) NOT NULL DEFAULT '1200+',
    `processSubtitle` VARCHAR(191) NOT NULL DEFAULT 'Our Seamless Process',
    `processTitle` VARCHAR(191) NOT NULL DEFAULT 'Our Step-by-Step Approach',
    `process1Title` VARCHAR(191) NOT NULL DEFAULT 'Consultation Discovery',
    `process1Desc` TEXT NULL,
    `process2Title` VARCHAR(191) NOT NULL DEFAULT 'Design And Development',
    `process2Desc` TEXT NULL,
    `process3Title` VARCHAR(191) NOT NULL DEFAULT 'Continuous Improvement',
    `process3Desc` TEXT NULL,
    `process4Title` VARCHAR(191) NOT NULL DEFAULT 'Reporting',
    `process4Desc` TEXT NULL,
    `ctaSubtitle` VARCHAR(191) NOT NULL DEFAULT 'tailored social strategies',
    `ctaTitle` VARCHAR(191) NOT NULL DEFAULT 'Results Driven Marketing For Your Social Business',
    `ctaDescription` TEXT NULL,
    `seoTitle` VARCHAR(191) NOT NULL DEFAULT 'SEOX - High-Impact Social Media Marketing Agency',
    `seoDescription` TEXT NULL,
    `seoKeywords` TEXT NULL,
    `seoImage` VARCHAR(191) NOT NULL DEFAULT '',
    `services_json` JSON NOT NULL,
    `faqs_json` JSON NOT NULL,
    `packages_json` JSON NOT NULL,
    `footerTagline` VARCHAR(191) NOT NULL DEFAULT 'We grow your business with creative marketing that delivers real results.',
    `aboutMissionTitle` VARCHAR(191) NOT NULL DEFAULT 'Our Mission Is Simple',
    `aboutMissionDesc` TEXT NULL,
    `aboutMissionBullets` TEXT NULL,
    `about_stats_json` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `case_studies` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `feedback` TEXT NOT NULL,
    `rating` INTEGER NOT NULL DEFAULT 5,
    `avatar_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `landing_page_projects` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `image_url_2` VARCHAR(191) NULL,
    `image_url_3` VARCHAR(191) NULL,
    `image_url_4` VARCHAR(191) NULL,
    `client_name` VARCHAR(191) NULL,
    `project_date` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `duration` VARCHAR(191) NULL,
    `sections` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` ENUM('ACTION_REQUIRED', 'INFORMATION', 'SUCCESS', 'WARNING') NOT NULL DEFAULT 'INFORMATION',
    `entity_type` VARCHAR(191) NULL,
    `entity_id` VARCHAR(191) NULL,
    `action_url` VARCHAR(191) NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `platform_user_id` VARCHAR(191) NOT NULL,
    `platform_username` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `avatar_url` TEXT NULL,
    `page_id` VARCHAR(191) NULL,
    `ig_account_id` VARCHAR(191) NULL,
    `access_token_enc` TEXT NOT NULL,
    `refresh_token_enc` TEXT NULL,
    `token_expires_at` DATETIME(3) NULL,
    `health_status` VARCHAR(191) NOT NULL DEFAULT 'healthy',
    `health_message` TEXT NULL,
    `rate_limited_until` DATETIME(3) NULL,
    `group_name` VARCHAR(191) NULL,
    `group_color` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_imported_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_accounts_client_id_idx`(`client_id`),
    UNIQUE INDEX `social_accounts_client_id_platform_platform_user_id_key`(`client_id`, `platform`, `platform_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_posts` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `caption` TEXT NOT NULL,
    `platform_content` JSON NULL,
    `media_urls` JSON NULL,
    `media_type` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `scheduled_for` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `campaign_id` VARCHAR(191) NULL,
    `error_message` TEXT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_posts_client_id_idx`(`client_id`),
    INDEX `social_posts_status_scheduled_for_idx`(`status`, `scheduled_for`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_post_destinations` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `social_account_id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `platform_post_id` VARCHAR(191) NULL,
    `platform_post_url` TEXT NULL,
    `published_at` DATETIME(3) NULL,
    `last_error` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_attempt_at` DATETIME(3) NULL,
    `locked_at` DATETIME(3) NULL,

    INDEX `social_post_destinations_post_id_idx`(`post_id`),
    INDEX `social_post_destinations_status_locked_at_idx`(`status`, `locked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_insights_daily` (
    `id` VARCHAR(191) NOT NULL,
    `social_account_id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `followers` INTEGER NULL,
    `reach` INTEGER NULL,
    `impressions` INTEGER NULL,
    `profile_visits` INTEGER NULL,
    `lifetime_views_snapshot` INTEGER NULL,
    `engagement_rate` DECIMAL(5, 2) NULL,
    `video_views` INTEGER NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `shares` INTEGER NULL,
    `new_viewers` INTEGER NULL,
    `returning_viewers` INTEGER NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'api',

    INDEX `account_insights_daily_social_account_id_idx`(`social_account_id`),
    UNIQUE INDEX `account_insights_daily_social_account_id_date_key`(`social_account_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_insights` (
    `id` VARCHAR(191) NOT NULL,
    `post_id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `impressions` INTEGER NULL,
    `reach` INTEGER NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `shares` INTEGER NULL,
    `saved` INTEGER NULL,
    `views` INTEGER NULL,
    `fetched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `post_insights_post_id_idx`(`post_id`),
    UNIQUE INDEX `post_insights_post_id_platform_key`(`post_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_demographics` (
    `id` VARCHAR(191) NOT NULL,
    `social_account_id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `fraction` DOUBLE NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'import',
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `account_demographics_social_account_id_idx`(`social_account_id`),
    UNIQUE INDEX `account_demographics_social_account_id_kind_label_key`(`social_account_id`, `kind`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_activity` (
    `id` VARCHAR(191) NOT NULL,
    `social_account_id` VARCHAR(191) NOT NULL,
    `weekday` INTEGER NOT NULL,
    `hour` INTEGER NOT NULL,
    `active_followers` INTEGER NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'import',
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `account_activity_social_account_id_idx`(`social_account_id`),
    UNIQUE INDEX `account_activity_social_account_id_weekday_hour_key`(`social_account_id`, `weekday`, `hour`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imported_posts` (
    `id` VARCHAR(191) NOT NULL,
    `social_account_id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `external_id` VARCHAR(191) NOT NULL,
    `title` TEXT NULL,
    `link` TEXT NULL,
    `posted_at` DATETIME(3) NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `shares` INTEGER NULL,
    `views` INTEGER NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'import',
    `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `imported_posts_social_account_id_idx`(`social_account_id`),
    UNIQUE INDEX `imported_posts_social_account_id_external_id_key`(`social_account_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mailboxes` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `avatar_url` VARCHAR(191) NULL,
    `signature` TEXT NULL,
    `department` VARCHAR(191) NULL,
    `reply_to` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mailboxes_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mailbox_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `mailbox_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `access_level` ENUM('READ', 'WRITE', 'MANAGE') NOT NULL DEFAULT 'WRITE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mailbox_permissions_user_id_idx`(`user_id`),
    UNIQUE INDEX `mailbox_permissions_mailbox_id_user_id_key`(`mailbox_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` VARCHAR(191) NOT NULL,
    `mailbox_id` VARCHAR(191) NOT NULL,
    `subject` TEXT NOT NULL,
    `client_id` VARCHAR(191) NULL,
    `assignee_id` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'PENDING', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `thread_key` VARCHAR(191) NULL,
    `snippet` TEXT NULL,
    `message_count` INTEGER NOT NULL DEFAULT 0,
    `unread_count` INTEGER NOT NULL DEFAULT 0,
    `has_attachment` BOOLEAN NOT NULL DEFAULT false,
    `is_starred` BOOLEAN NOT NULL DEFAULT false,
    `is_important` BOOLEAN NOT NULL DEFAULT false,
    `is_flagged` BOOLEAN NOT NULL DEFAULT false,
    `is_spam` BOOLEAN NOT NULL DEFAULT false,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `last_message_at` DATETIME(3) NULL,
    `last_inbound_at` DATETIME(3) NULL,
    `last_outbound_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `conversations_mailbox_id_idx`(`mailbox_id`),
    INDEX `conversations_client_id_idx`(`client_id`),
    INDEX `conversations_assignee_id_idx`(`assignee_id`),
    INDEX `conversations_thread_key_idx`(`thread_key`),
    INDEX `conversations_last_message_at_idx`(`last_message_at`),
    INDEX `conversations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_participants` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` ENUM('FROM', 'TO', 'CC', 'BCC') NOT NULL DEFAULT 'TO',

    INDEX `conversation_participants_conversation_id_idx`(`conversation_id`),
    INDEX `conversation_participants_email_idx`(`email`),
    UNIQUE INDEX `conversation_participants_conversation_id_email_role_key`(`conversation_id`, `email`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emails` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `mailbox_id` VARCHAR(191) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `status` ENUM('DRAFT', 'QUEUED', 'SCHEDULED', 'SENT', 'DELIVERED', 'DELIVERY_DELAYED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELED', 'RECEIVED') NOT NULL DEFAULT 'QUEUED',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL DEFAULT 'NORMAL',
    `from_email` VARCHAR(191) NOT NULL,
    `from_name` VARCHAR(191) NULL,
    `to_emails` JSON NOT NULL,
    `cc_emails` JSON NULL,
    `bcc_emails` JSON NULL,
    `subject` TEXT NOT NULL,
    `html` LONGTEXT NULL,
    `text` LONGTEXT NULL,
    `snippet` TEXT NULL,
    `resend_id` VARCHAR(191) NULL,
    `message_id` VARCHAR(512) NULL,
    `in_reply_to` VARCHAR(512) NULL,
    `email_references` TEXT NULL,
    `headers` JSON NULL,
    `sent_by_id` VARCHAR(191) NULL,
    `scheduled_at` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `emails_conversation_id_idx`(`conversation_id`),
    INDEX `emails_mailbox_id_idx`(`mailbox_id`),
    INDEX `emails_resend_id_idx`(`resend_id`),
    INDEX `emails_message_id_idx`(`message_id`),
    INDEX `emails_status_idx`(`status`),
    INDEX `emails_direction_idx`(`direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_events` (
    `id` VARCHAR(191) NOT NULL,
    `email_id` VARCHAR(191) NOT NULL,
    `type` ENUM('QUEUED', 'SCHEDULED', 'SENT', 'DELIVERED', 'DELIVERY_DELAYED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELED', 'RECEIVED', 'REPLIED') NOT NULL,
    `payload` JSON NULL,
    `link` TEXT NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_events_email_id_idx`(`email_id`),
    INDEX `email_events_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `email_id` VARCHAR(191) NULL,
    `draft_id` VARCHAR(191) NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `checksum` VARCHAR(191) NULL,
    `is_inline` BOOLEAN NOT NULL DEFAULT false,
    `content_id` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `superseded_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_attachments_superseded_by_id_key`(`superseded_by_id`),
    INDEX `email_attachments_email_id_idx`(`email_id`),
    INDEX `email_attachments_draft_id_idx`(`draft_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_labels` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_labels_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_labels` (
    `conversation_id` VARCHAR(191) NOT NULL,
    `label_id` VARCHAR(191) NOT NULL,

    INDEX `conversation_labels_label_id_idx`(`label_id`),
    PRIMARY KEY (`conversation_id`, `label_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('SUPPORT', 'SALES', 'INVOICES', 'MARKETING', 'HR', 'LEGAL', 'SAVED_REPLY') NOT NULL DEFAULT 'SUPPORT',
    `subject` TEXT NOT NULL,
    `body` LONGTEXT NOT NULL,
    `variables` JSON NULL,
    `mailbox_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_templates_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_drafts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `mailbox_id` VARCHAR(191) NULL,
    `conversation_id` VARCHAR(191) NULL,
    `to_emails` JSON NULL,
    `cc_emails` JSON NULL,
    `bcc_emails` JSON NULL,
    `subject` TEXT NULL,
    `html` LONGTEXT NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL DEFAULT 'NORMAL',
    `scheduled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_drafts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_notes` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `mentions` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversation_notes_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_webhook_logs` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'resend',
    `event_type` VARCHAR(191) NOT NULL,
    `resend_id` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `error` TEXT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_webhook_logs_event_type_idx`(`event_type`),
    INDEX `email_webhook_logs_resend_id_idx`(`resend_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_meetings` ADD CONSTRAINT `client_meetings_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_team_members` ADD CONSTRAINT `project_team_members_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `team_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_team_members` ADD CONSTRAINT `project_team_members_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `team_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_files` ADD CONSTRAINT `employee_files_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `team_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_activity` ADD CONSTRAINT `employee_activity_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `team_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proformas` ADD CONSTRAINT `proformas_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proforma_items` ADD CONSTRAINT `proforma_items_proforma_id_fkey` FOREIGN KEY (`proforma_id`) REFERENCES `proformas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_services` ADD CONSTRAINT `package_services_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_services` ADD CONSTRAINT `package_services_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_proforma_id_fkey` FOREIGN KEY (`proforma_id`) REFERENCES `proformas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_monthly_report_id_fkey` FOREIGN KEY (`monthly_report_id`) REFERENCES `monthly_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_hr_document_id_fkey` FOREIGN KEY (`hr_document_id`) REFERENCES `hr_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_social_profiles` ADD CONSTRAINT `client_social_profiles_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_documents` ADD CONSTRAINT `client_documents_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_deliverables` ADD CONSTRAINT `package_deliverables_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_platforms` ADD CONSTRAINT `deliverable_platforms_deliverable_id_fkey` FOREIGN KEY (`deliverable_id`) REFERENCES `package_deliverables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_cycles` ADD CONSTRAINT `subscription_cycles_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_tasks` ADD CONSTRAINT `deliverable_tasks_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_tasks` ADD CONSTRAINT `deliverable_tasks_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_tasks` ADD CONSTRAINT `deliverable_tasks_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `subscription_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_tasks` ADD CONSTRAINT `deliverable_tasks_content_post_id_fkey` FOREIGN KEY (`content_post_id`) REFERENCES `content_posts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliverable_tasks` ADD CONSTRAINT `deliverable_tasks_team_member_id_fkey` FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_platforms` ADD CONSTRAINT `task_platforms_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `deliverable_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_posts` ADD CONSTRAINT `content_posts_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_reports` ADD CONSTRAINT `monthly_reports_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_reports` ADD CONSTRAINT `monthly_reports_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_report_sections` ADD CONSTRAINT `monthly_report_sections_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `monthly_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_report_assets` ADD CONSTRAINT `monthly_report_assets_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `monthly_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_report_versions` ADD CONSTRAINT `monthly_report_versions_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `monthly_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_report_versions` ADD CONSTRAINT `monthly_report_versions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `team_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expenses` ADD CONSTRAINT `recurring_expenses_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_transfers` ADD CONSTRAINT `account_transfers_from_account_id_fkey` FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_transfers` ADD CONSTRAINT `account_transfers_to_account_id_fkey` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_documents` ADD CONSTRAINT `hr_documents_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_documents` ADD CONSTRAINT `hr_documents_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_documents` ADD CONSTRAINT `hr_documents_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `team_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_document_approvals` ADD CONSTRAINT `hr_document_approvals_hr_document_id_fkey` FOREIGN KEY (`hr_document_id`) REFERENCES `hr_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hr_document_approvals` ADD CONSTRAINT `hr_document_approvals_approver_id_fkey` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shared_files` ADD CONSTRAINT `shared_files_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shared_files` ADD CONSTRAINT `shared_files_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shared_file_events` ADD CONSTRAINT `shared_file_events_shared_file_id_fkey` FOREIGN KEY (`shared_file_id`) REFERENCES `shared_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_accounts` ADD CONSTRAINT `social_accounts_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_post_destinations` ADD CONSTRAINT `social_post_destinations_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_post_destinations` ADD CONSTRAINT `social_post_destinations_social_account_id_fkey` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_insights_daily` ADD CONSTRAINT `account_insights_daily_social_account_id_fkey` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `post_insights` ADD CONSTRAINT `post_insights_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_demographics` ADD CONSTRAINT `account_demographics_social_account_id_fkey` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_activity` ADD CONSTRAINT `account_activity_social_account_id_fkey` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `imported_posts` ADD CONSTRAINT `imported_posts_social_account_id_fkey` FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_campaigns` ADD CONSTRAINT `social_campaigns_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mailbox_permissions` ADD CONSTRAINT `mailbox_permissions_mailbox_id_fkey` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mailbox_permissions` ADD CONSTRAINT `mailbox_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_mailbox_id_fkey` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emails` ADD CONSTRAINT `emails_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emails` ADD CONSTRAINT `emails_mailbox_id_fkey` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emails` ADD CONSTRAINT `emails_sent_by_id_fkey` FOREIGN KEY (`sent_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_events` ADD CONSTRAINT `email_events_email_id_fkey` FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachments` ADD CONSTRAINT `email_attachments_email_id_fkey` FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachments` ADD CONSTRAINT `email_attachments_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `email_drafts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_attachments` ADD CONSTRAINT `email_attachments_superseded_by_id_fkey` FOREIGN KEY (`superseded_by_id`) REFERENCES `email_attachments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_labels` ADD CONSTRAINT `conversation_labels_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_labels` ADD CONSTRAINT `conversation_labels_label_id_fkey` FOREIGN KEY (`label_id`) REFERENCES `email_labels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_mailbox_id_fkey` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_drafts` ADD CONSTRAINT `email_drafts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_notes` ADD CONSTRAINT `conversation_notes_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_notes` ADD CONSTRAINT `conversation_notes_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

