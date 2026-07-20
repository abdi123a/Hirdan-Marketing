# Hirdan Marketing Management

[![Version](https://img.shields.io/badge/version-2.22.1-blue.svg?style=flat-square)](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/package.json)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square)](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/package.json)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red.svg?style=flat-square)](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/LICENSE)

A premium, all-in-one digital marketing agency platform featuring a Next.js landing page, a React CRM admin dashboard & client portal, and a robust Express backend. Designed to automate and manage client onboarding, tasks, invoices, document verification, and content planning.

> 🔒 **Proprietary & Private:** This repository is proprietary and confidential. It is for internal use by Hirdan Marketing only.

---

## 🔗 Quick Links

| Component / File | Description | Location |
|---|---|---|
| 🌐 **CRM Frontend** | Vite + React + TypeScript + Tailwind CSS / Shadcn UI | [src/](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/src) |
| 🗄️ **Backend API** | Express + TypeScript + Prisma ORM + PostgreSQL | [server/](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/server) |
| 📄 **Landing Page** | Next.js marketing site for Hirdan Marketing | [landing-page/](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/landing-page) |
| ⚙️ **CI/CD Workflow** | Automated build and deploy workflow via SSH & Rsync | [deploy.yml](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/.github/workflows/deploy.yml) |
| 📜 **Contributing Guide** | Internal development guidelines | [CONTRIBUTING.md](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/CONTRIBUTING.md) |
| 🔒 **Security Policy** | Vulnerability reporting procedure | [SECURITY.md](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/SECURITY.md) |
| 🔑 **License** | Proprietary license terms | [LICENSE](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/LICENSE) |

---

## Features

- **Monorepo Architecture** — Contains landing page, CRM client/admin dashboard, and Express backend in one repository.
- **Agency CRM Admin Dashboard** — Client onboarding, task assignments, and subscription flows.
- **Secure Client Portal** — Dedicated space for clients to view projects, verify/approve deliverables, and pay invoices.
- **Automated Verification** — System for tracking and verifying Invoices and Proformas.
- **Short Link Domain redirects** — Seamless link shortener integration for sharing secure project links.

---

## Project Structure & Architecture

```
hirdan-marketing/
├── landing-page/      # Next.js Static Landing Page (hirdanmarketing.com)
├── server/            # Node.js + Express API Backend (api.hirdanmarketing.com)
├── src/               # Vite + React Frontend Dashboard (app.hirdanmarketing.com)
└── .github/           # GitHub Action workflows for CI/CD
```

---

## Getting Started

### Prerequisites

- **Node.js** (v20 or higher)
- **npm** (v10+) or **Bun**

### 1. CRM Frontend Setup (Root)

The root folder contains the React CRM application.

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Build production assets (Vite dist/)
npm run build
```

### 2. Landing Page Setup

The marketing site is powered by Next.js.

```bash
cd landing-page

# Install dependencies
npm install

# Start Next.js development server
npm run dev

# Build and export static landing page files
npm run build
```

### 3. Backend API Setup

The Express server handles routing, database connections via Prisma, and scheduler tasks.

```bash
cd server

# Install dependencies
npm install

# Create and configure .env from .env.example
cp .env.example .env

# Generate Prisma Client and apply DB Schema
npm run db:push
npm run db:seed

# Start Express tsx watch development server
npm run dev
```

---

## Short Domain Configuration (e.g., hirdan.cc)

To configure and use a custom short link domain for shared transfers (e.g. `hirdan.cc`), follow these steps:

### 1. Point DNS Records to VPS
In your domain registrar dashboard, add the following DNS records pointing to your server's IP (`72.61.192.11`):
- **Type:** `A`, **Name:** `@`, **Value:** `72.61.192.11`
- **Type:** `A`, **Name:** `www`, **Value:** `72.61.192.11` (optional)

### 2. Configure Reverse Proxy in CloudPanel
1. Go to your **CloudPanel** admin dashboard.
2. Navigate to **Sites** ➜ **Add Site** ➜ **Reverse Proxy**.
3. Set the domain name to `hirdan.cc`.
4. Point the Reverse Proxy target to the port that your Node.js Express server runs on (default: `3001`).
5. Open the site settings in CloudPanel and issue a free **Let's Encrypt SSL certificate** in one click.

### 3. Update Environment Variables

#### Backend (`server/.env`):
Set the `SHORT_LINK_DOMAIN` variable to point to your new short domain:
```env
SHORT_LINK_DOMAIN="https://hirdan.cc"
```
*(Ensure `FRONTEND_URL` is also set to your main app URL so redirects work properly).*

#### Frontend (Vite):
If you want the frontend interface to generate and copy links using the short domain directly, define the environment variable:
```env
VITE_SHORT_LINK_DOMAIN="https://hirdan.cc"
```
*(If unset, the frontend defaults to generating links using `window.location.origin` with the shortened `/f/:shareId` route).*

---

## Deployment Workflow (CI/CD)

Deployments are automated via GitHub Actions using the `.github/workflows/deploy.yml` workflow.

### Triggering Deployments
Every push to the `clean-version` branch will run the deployment pipeline:
1. **Build Frontend**: Compiles the CRM into the static `dist/` directory.
2. **Build Landing Page**: Exports Next.js static pages to `landing-page/dist/`.
3. **Build Backend**: Transpiles TypeScript files into Node-ready scripts inside `server/dist`.
4. **VPS Deploy**: Copies the builds to their respective directories on the Hostinger VPS using Rsync.
5. **Database Migration**: Runs Prisma db push to sync the database schema.
6. **Restart Backend**: Restarts the Express server PM2 process on the VPS.

---

## License

This project is proprietary and confidential. All rights reserved by Hirdan Marketing. Unauthorized copying or distribution of these files is strictly prohibited. See the [LICENSE](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/hirdan-marketing/LICENSE) file for more information.
