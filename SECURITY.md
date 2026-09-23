# Security Policy

## Supported Versions

We actively support and patch the latest version of Hirdan Marketing Management.

| Version | Supported          |
| ------- | ------------------ |
| v2.x    | :white_check_mark: |
| < v2.x  | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please do not report it publicly via GitHub issues. Instead, please report it directly to our security team.

Please email security reports to [security@hirdanmarketing.com](mailto:security@hirdanmarketing.com) with:
- A detailed description of the vulnerability.
- Steps to reproduce the issue (including proof-of-concept scripts or screenshots if applicable).
- Potential impact of the vulnerability.

We will acknowledge receipt of your report within 48 hours and work with you to resolve the issue promptly.

## Operational follow-ups (September 2026 audit)

These cannot be fixed by a code change alone and need an administrator:

1. **Rotate secrets exposed through `GET /api/settings`.** Until the fix, STAFF
   users could read third-party credentials stored in settings. Treat all of
   them as disclosed and rotate at the provider, then save the new values:
   OpenAI, Claude (Anthropic) and Gemini API keys; Resend API key **and** Resend
   webhook signing secret; OneSignal app/REST keys; reCAPTCHA secret key(s);
   Google Drive service-account credentials (delete the old key in Google Cloud
   IAM, don't just replace it here).
2. **Purge `server/uploads` from git history.** Real HR documents (internship
   letters naming a person, employee ID photos) and branding files were
   committed. They are untracked now but remain in every clone's history.
   With [git-filter-repo](https://github.com/newren/git-filter-repo) on a fresh
   mirror clone:

   ```sh
   git clone --mirror git@github.com:<owner>/<repo>.git repo-purge && cd repo-purge
   git filter-repo --sensitive-data-removal --invert-paths --path server/uploads/
   git push --force --mirror origin
   ```

   Then ask GitHub Support to drop cached views / unreachable objects and PR
   refs that still reference the files, have every collaborator re-clone (old
   clones re-introduce the data on push), and handle notification of the named
   person according to your data-protection obligations.
3. **Pin the VPS host key for CI.** Add a `SSH_KNOWN_HOSTS` repository secret
   (output of `ssh-keyscan -p <port> <host>`, verified against the server's
   `/etc/ssh/ssh_host_*_key.pub`) and optionally `SSH_HOST_FINGERPRINT` for the
   remote-command step. Until then the deploy warns and trusts the key blindly.
4. **Deploy as a non-root user.** CI and `deploy_local.sh` still SSH in as
   root to `chown` the site directories. Create a dedicated deploy user that
   owns the three `htdocs` trees (or has narrowly scoped `sudo` for `pm2` and
   `chown`), switch the workflow's `username`/`root@` to it, and disable root
   SSH login (`PermitRootLogin no`).
5. **Move database backups offsite.** `server/scripts/backup.cjs` writes
   gzip'd, mode-600 dumps under `backups/` on the same VPS; copy them to
   encrypted offsite storage and test restores.
6. **Make the schema drift check blocking** in `.github/workflows/deploy.yml`
   once production has been confirmed drift-free.
