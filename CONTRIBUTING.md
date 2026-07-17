# Contributing Guidelines (Internal Only)

This repository is private and proprietary to Hirdan Marketing. Contributions are restricted to authorized internal developers and team members.

## Code of Conduct

Please maintain professional and respectful communication in all project spaces.

## Internal Development Flow

### Feature branches
Always create a feature branch off of the `clean-version` branch:
```bash
git checkout -b feature/your-feature-name
```

### Commit Messages
Write clear, concise commit messages outlining what was changed and why.

### Pull Requests
- Keep Pull Requests small and focused.
- Ensure all automated checks (linting, build) pass before requesting a review.
- Tag another internal team member for review before merging into `clean-version`.

## Development Setup

The project is structured as follows:
- **CRM Frontend**: Root directory (Vite + React + TypeScript + Tailwind CSS).
- **Backend API**: `server/` directory (Node.js + Express + Prisma + PostgreSQL).
- **Landing Page**: `landing-page/` directory (Next.js/React).

Refer to the main `README.md` for local setup and database seeding instructions.
