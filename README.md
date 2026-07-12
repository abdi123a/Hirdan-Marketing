# Hirdan Marketing Management

A premium digital marketing agency website.

## Features
- Professional "Coming Soon" page
- Agency Admin Dashboard
- Client Portal
- Document Verification (Invoices & Proformas)

## Short Domain Configuration (e.g. hirdan.cc)

To configure and use a custom short link domain for shared transfers (e.g. `hirdan.cc`), follow these steps:

### 1. Point DNS Records to VPS
In your domain registrar dashboard (where you purchased the domain), add the following DNS records pointing to your server's IP (`72.61.192.11`):
* **Type:** `A`, **Name:** `@`, **Value:** `72.61.192.11`
* **Type:** `A`, **Name:** `www`, **Value:** `72.61.192.11` (optional)

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

