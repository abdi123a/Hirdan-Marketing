# Hirdan Marketing Management

A premium digital marketing agency platform featuring a Next.js landing page, a React CRM admin dashboard & client portal, and a robust Express backend.

## Project Structure

This repository is structured as a monorepo containing three core components:

*   **CRM Frontend (Root)**: React single-page application built with Vite, TypeScript, Tailwind CSS, and Shadcn UI.
*   **Landing Page ([landing-page](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/agency-flow-pro/landing-page))**: Next.js-powered marketing site for the agency.
*   **Backend API ([server](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/agency-flow-pro/server))**: Node.js Express server configured with TypeScript, Prisma ORM, and PostgreSQL.

---

## Features

- **Marketing Landing Page**: Next.js landing page highlighting services, stats, and contact options.
- **Agency CRM Admin Dashboard**: Comprehensive project, task, user, and subscription management.
- **Client Portal**: Dedicated space for clients to view projects, files, invoices, and approve deliverables.
- **Document Verification**: Safe, automated handling and verification of Invoices and Proformas.
- **Short Link Integration**: Built-in support for short-url domain redirects for client portals.

---

## Getting Started

### Prerequisites

Ensure you have Node.js (v20+) and either `npm` or `bun` installed on your system.

### CRM Frontend Setup (Root)

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
3.  Build for production:
    ```bash
    npm run build
    ```

### Landing Page Setup

1.  Navigate to the directory:
    ```bash
    cd landing-page
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
4.  Build the static export:
    ```bash
    npm run build
    ```

### Backend API Setup

1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your `.env` file (refer to `.env.example`).
4.  Run database migrations and seed:
    ```bash
    npm run db:push
    npm run db:seed
    ```
5.  Start the development backend:
    ```bash
    npm run dev
    ```

---

## Short Domain Configuration (e.g., hirdan.cc)

To configure and use a custom short link domain for shared transfers (e.g. `hirdan.cc`), follow these steps:

### 1. Point DNS Records to VPS
In your domain registrar dashboard, add the following DNS records pointing to your server's IP (`72.61.192.11`):
*   **Type:** `A`, **Name:** `@`, **Value:** `72.61.192.11`
*   **Type:** `A`, **Name:** `www`, **Value:** `72.61.192.11` (optional)

### 2. Configure Reverse Proxy in CloudPanel
1.  Go to your **CloudPanel** admin dashboard.
2.  Navigate to **Sites** ➜ **Add Site** ➜ **Reverse Proxy**.
3.  Set the domain name to `hirdan.cc`.
4.  Point the Reverse Proxy target to the port that your Node.js Express server runs on (default: `3001`).
5.  Open the site settings in CloudPanel and issue a free **Let's Encrypt SSL certificate** in one click.

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

## Contributing

Please read [CONTRIBUTING.md](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/agency-flow-pro/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

If you discover a security vulnerability, please refer to our [SECURITY.md](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/agency-flow-pro/SECURITY.md) policy for reporting instructions.

## License

This project is licensed under the MIT License - see the [LICENSE](file:///Users/abdihakim/Documents/Hirdanmarketing/untitled%20folder/Agency/agency-flow-pro/LICENSE) file for details.
