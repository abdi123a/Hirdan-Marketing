# Contributing to Hirdan Marketing Management

Thank you for your interest in contributing to Hirdan Marketing Management! We welcome community contributions to help improve the platform.

## Code of Conduct

Please be respectful and professional in all interactions within this project.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please open a GitHub Issue and include:
- A clear, descriptive title.
- Steps to reproduce the bug.
- Expected vs. actual behavior.
- Screenshots or error logs if available.
- Your environment details (browser, OS, Node.js version).

### Suggesting Enhancements
If you have ideas for new features or improvements:
- Open a GitHub Issue describing the feature request.
- Explain the use case and why it would be beneficial to the project.

### Pull Requests
We welcome pull requests! To submit a contribution:
1. Fork the repository and create your branch from `clean-version`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make your changes, adhering to the project's coding standards.
4. Ensure code passes linting and tests:
   ```bash
   npm run lint
   ```
5. Commit your changes with clear, descriptive commit messages.
6. Push to your fork and submit a Pull Request (PR) to the `clean-version` branch.

## Development Setup

The project is structured as a monorepo-like layout:
- **CRM Frontend**: Root directory (Vite + React + TypeScript + Tailwind CSS).
- **Backend API**: `server/` directory (Node.js + Express + Prisma + PostgreSQL).
- **Landing Page**: `landing-page/` directory (Next.js/React).

Refer to the main `README.md` for specific configuration and setup instructions.
