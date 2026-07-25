-- Widen the AgencySettings credential columns from VARCHAR(191) to TEXT.
--
-- These columns are now stored encrypted (AES-256-GCM, see
-- src/lib/settings-secrets.ts). Ciphertext is roughly 2x the plaintext length
-- plus ~65 bytes of prefix/IV/auth-tag overhead, so a 164-character API key
-- becomes ~393 characters and no longer fits in VARCHAR(191).
--
-- Widening only; no data is read, moved or dropped.

-- AlterTable
ALTER TABLE `agency_settings` MODIFY `recaptcha_secret_key` TEXT NULL,
    MODIFY `open_ai_api_key` TEXT NULL,
    MODIFY `resend_api_key` TEXT NULL,
    MODIFY `claude_api_key` TEXT NULL,
    MODIFY `gemini_api_key` TEXT NULL,
    MODIFY `one_signal_api_key` TEXT NULL,
    MODIFY `resend_webhook_secret` TEXT NULL;
