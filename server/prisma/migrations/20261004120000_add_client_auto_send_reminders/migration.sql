-- Payment reminder / overdue emails now wait for the user's approval unless
-- the client is switched to "send automatically". Default off: the job used to
-- email every unpaid invoice, including ones for work that wasn't finished.
ALTER TABLE `clients` ADD COLUMN `auto_send_reminders` BOOLEAN NOT NULL DEFAULT false;
