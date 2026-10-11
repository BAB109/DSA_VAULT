# DSA Vault — Algorithmic Learning Journal & Spaced Repetition Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)

**DSA Vault** is a full-stack web application designed for software engineers and computer science students to systematically record, review, and master data structures and algorithms (DSA) problems. It combines an engineering-grade problem journal with an automated **spaced-repetition scheduler**, **52-week activity heatmap**, **daily goals tracker**, and **deep analytical visualizations**.

---

## Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Local Installation](#local-installation)
5. [Environment Variables](#environment-variables)
6. [Database Setup & Versioned Migrations](#database-setup--versioned-migrations)
7. [Running Tests](#running-tests)
8. [Production Build](#production-build)
9. [Deployment Instructions & Hosting Recommendations](#deployment-instructions--hosting-recommendations)
10. [Database Backup & Disaster Recovery](#database-backup--disaster-recovery)
11. [Known Limitations & Roadmap](#known-limitations--roadmap)

---

## 1. Features

### 🧠 Problem Solving Journal
* **Structured Records:** Track title, platform (LeetCode, HackerRank, Codeforces, GFG, InterviewBit), difficulty (Easy, Medium, Hard), solving status, and time taken.
* **Dual Approach Modeling:** Document initial brute-force approach alongside optimized solutions with explicit Time and Space complexities.
* **Google Drive Notes Integration:** Attach Google Drive / Docs links to both initial and improved solutions with safe browser isolation (`noopener noreferrer`).
* **Self-Assessment & Mistake Categorization:** Rate confidence (1–5) and classify mistake types (e.g., *Off-by-one*, *TLE*, *Wrong algorithm*, *Edge case omission*).

### 🔁 Spaced-Repetition Revision Center
* **Algorithm-Driven Scheduling:** Default multi-stage intervals (1, 3, 7, 14, 30 days) that adapt dynamically based on revision outcomes (*Solved Independently*, *Solved With Hint*, *Reviewed Solution*, *Unable To Solve*).
* **Configurable Cadence:** Users can customize revision intervals in Settings.
* **Manual Rescheduling & History:** Track full audit logs of past revision attempts while retaining the ability to manually reschedule.

### 📊 Dashboard, Heatmap & Analytics
* **GitHub-Style 52-Week Activity Heatmap:** Accessible, keyboard-navigable (`Arrow keys`, `Enter`/`Space`) calendar with shading levels (`0` to `4`) and date-specific activity counts.
* **Dual Daily Goals:** Set and monitor target problems and target revisions completed per day.
* **Analytical Visualizations:** Recharts-powered graphs for 7-day/30-day activity trends, difficulty breakdown, topic-wise competency, and mistake distribution.
* **Timezone Awareness:** All calendar dates, streak calculations, and goal progress respect the user's configured timezone.

### 🛡️ Enterprise-Grade Security
* **Bcrypt Password Hashing:** Salt factor of 12 with dummy comparison to mitigate side-channel timing attacks.
* **Stateless JWT Authentication:** Bearer tokens with expiration validation.
* **Strict User Isolation (IDOR Defense):** All mutations and reads enforce `user_id` ownership at the query level.
* **Protocol & Input Sanitization:** Rejects non-HTTP(S) schemes, disallows `javascript:`/`data:` payloads, and restricts notes URLs to Google Drive/Docs domains.
* **SQL Injection Resistance:** Parameterized queries across all database operations.
* **Rate Limiting:** Protects registration and login endpoints against brute-force attacks.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, React Router v7, Lucide Icons, Recharts, Tailwind CSS v4, Vite |
| **Backend** | Node.js (ES Modules), Express 5, bcrypt, jsonwebtoken, cors, express-rate-limit |
| **Database** | PostgreSQL (managed or local) via `pg` connection pool with TLS support |
| **Tooling & CI** | Oxlint, Vite Production Bundler, Native Node.js Test Harness |

---

## 3. Architecture

DSA Vault supports both **two-tier decoupled hosting** and **single-tier unified hosting**:

```
                       ┌───────────────────────────────┐
                       │     Browser / Client SPA      │
                       │ (React 19 + Tailwind v4 + JS) │
                       └───────────────┬───────────────┘
                                       │ HTTPS / JSON
                                       ▼
                       ┌───────────────────────────────┐
                       │      Reverse Proxy / CDN      │
                       │   (Cloudflare / NGINX / ALB)  │
                       └───────────────┬───────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
                ▼                                             ▼
  ┌───────────────────────────┐                 ┌───────────────────────────┐
  │  Production Static Assets │                 │ Express API Server        │
  │    (dist/index.html)      │                 │  • /api/auth              │
  └───────────────────────────┘                 │  • /api/problems          │
                                                │  • /api/analytics         │
                                                │  • /api/health & /ready   │
                                                └─────────────┬─────────────┘
                                                              │ Parameterized SQL
                                                              │ (TLS Encrypted)
                                                              ▼
                                                ┌───────────────────────────┐
                                                │ Managed PostgreSQL DB     │
                                                │ (Users, Problems, Topics, │
                                                │  Revisions, Settings)     │
                                                └───────────────────────────┘
```

---

## 4. Local Installation

### Prerequisites
* **Node.js** `>= 18.0.0`
* **npm** `>= 9.0.0`
* **PostgreSQL** `>= 14.0` (Optional for development; server includes automatic in-memory fallback)

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd dsa-record
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```
Adjust credentials in `.env` as needed.

### Step 4: Run Database Migrations (Optional for dev, required for DB mode)
```bash
npm run db:migrate
```

### Step 5: Start the Development Servers
In terminal 1 (API Server):
```bash
npm run server
```
In terminal 2 (Vite Frontend with Hot Module Reload):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Environment Variables

The application is configured using environment variables loaded via `dotenv`. Below is the complete reference:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes (in prod) | `development` | Set to `production` in production deployments. |
| `PORT` | No | `5000` | Port for the Express backend server. |
| `DATABASE_URL` | Recommended | `null` | Full PostgreSQL connection URI (e.g. `postgresql://user:pass@host:5432/db?sslmode=require`). |
| `PGHOST` | No | `localhost` | Discrete database host (used if `DATABASE_URL` is omitted). |
| `PGPORT` | No | `5432` | Discrete database port. |
| `PGDATABASE` | No | `dsa_vault` | Database name. |
| `PGUSER` | No | `postgres` | Database username. |
| `PGPASSWORD` | No | `null` | Database password. |
| `PGSSL` | No | `false` | Enable TLS (`true`/`false`). Auto-detected for cloud hosts. |
| `PGSSL_REJECT_UNAUTHORIZED` | No | `false` | Verify CA certificate chain. Set to `false` for cloud self-signed certs. |
| `JWT_SECRET` | **Yes (in prod)** | *Fallback* | Secret key for signing JWTs. Must be $\ge$ 32 characters in production. |
| `JWT_EXPIRES_IN` | No | `7d` | Lifespan of issued authentication tokens. |
| `CLIENT_URL` | Recommended | `null` | Comma-separated list of permitted CORS frontend origins. |
| `REQUIRE_DB` | No | `false` | When `true`, `/api/ready` returns 503 if PostgreSQL is disconnected. |
| `VITE_API_URL` | No | `/api` | Base URL used by the React client. Keep `/api` for unified hosting. |

---

## 6. Database Setup & Versioned Migrations

DSA Vault utilizes **versioned, forward-only SQL migrations** tracked in a dedicated `schema_migrations` table. Migrations never drop or reset production tables.

### Migration Files (`db/migrations/`)
1. `001_create_schema.sql` — Creates users, problems, topics, problem_topics, revisions, problem_mistakes, and user_settings tables with foreign keys and cascade rules.
2. `002_seed_topics.sql` — Populates predefined standard DSA topics.
3. `003_update_revisions_and_settings.sql` — Configures spaced repetition intervals and settings constraints.
4. `004_add_timezone_to_settings.sql` — Adds timezone support for streak and calendar queries.
5. `005_add_daily_revision_goal.sql` — Adds daily revision target tracking.

### Executing Migrations
```bash
npm run db:migrate
```
*Note:* The migration runner connects using transactions (`BEGIN ... COMMIT`), checks `schema_migrations`, applies pending files in alphabetical order, and rolls back atomically on failure.

---

## 7. Running Tests

The test suite validates algorithms, data isolation, negative inputs, security policies, and end-to-end integration:

```bash
# Run all automated test suites sequentially
npm run test:all
```

Individual test runners:
* `node server/test-scheduler.js` — Verifies spaced repetition intervals, outcome stage progression, and resets.
* `node server/test-analytics.js` — Verifies dashboard aggregations, division-by-zero handling, and topic progress.
* `node server/test-calendar-goals.js` — Verifies 52-week activity calendar, daily goals, and timezone calculation.
* `node server/test-integration.js` — Verifies authentication, problem CRUD, multi-topic assignment, and notes links.
* `node server/test-security-prerelease.js` — Verifies JWT verification, input bounds, scheme rejection, and IDOR isolation.

---

## 8. Production Build

To compile the React frontend into an optimized, minified bundle:

```bash
npm run build
```
This produces the distribution assets in `dist/`:
* `dist/index.html` — Clean SPA entry point.
* `dist/assets/index-[hash].css` — Minified Tailwind v4 CSS bundle.
* `dist/assets/index-[hash].js` — Tree-shaken production JavaScript bundle.

---

## 9. Deployment Instructions & Hosting Recommendations

### Recommended Cloud Hosting Architecture

1. **Managed Database:**
   * **Neon** (Recommended: Serverless Postgres, instant branching, automated TLS).
   * **Supabase** (Managed Postgres with built-in connection pooling).
   * **AWS RDS PostgreSQL** / **Render PostgreSQL**.
2. **Backend & Unified Full-Stack:**
   * **Render**, **Railway**, **Fly.io**, or **AWS App Runner**.
3. **Decoupled Frontend (Optional):**
   * **Vercel**, **Netlify**, or **Cloudflare Pages** (set `VITE_API_URL=https://api.yourdomain.com/api`).

---

### Step-by-Step Deployment (Unified Monolith Option)

This approach serves both the React client and Express API from a single container or service:

1. **Provision Managed Database:**
   * Create a PostgreSQL database on Neon or Render.
   * Copy the connection string (`postgresql://...`).

2. **Run Migrations:**
   * Run the migration runner against your production database:
     ```bash
     DATABASE_URL="your-production-database-url" node db/migrate.js
     ```

3. **Deploy Backend Service on PaaS (e.g. Render / Railway):**
   * Set Environment Variables:
     * `NODE_ENV=production`
     * `PORT=10000` (or host-assigned)
     * `DATABASE_URL=your-production-database-url`
     * `JWT_SECRET=use-a-strong-random-32-char-secret`
     * `REQUIRE_DB=true`
   * Set Build Command:
     ```bash
     npm install && npm run build
     ```
   * Set Start Command:
     ```bash
     npm start
     ```
   * Configure Health Check Path:
     * Liveness: `/api/health`
     * Readiness: `/api/ready`

---

## 10. Database Backup & Disaster Recovery

When operating in production with managed PostgreSQL:

1. **Automated Snapshots:**
   * Enable daily automated snapshots with at least a 7-day retention period (standard on Neon, AWS RDS, and Render).
2. **Point-in-Time Recovery (PITR):**
   * Enable WAL archiving / PITR for production instances to allow restoration to any second within the retention window.
3. **Logical Manual Dumps:**
   * Prior to applying new versioned migrations, take a logical snapshot:
     ```bash
     pg_dump -d "$DATABASE_URL" -F c -b -v -f dsa_vault_backup_$(date +%Y%m%d_%H%M%S).dump
     ```
4. **Restore Procedure:**
   * To restore from a logical backup file:
     ```bash
     pg_restore -d "$DATABASE_URL" -v -c dsa_vault_backup_<timestamp>.dump
     ```
5. **Least-Privilege Database Role:**
   * In multi-tenant environments, run application connections using a dedicated role granted only `SELECT, INSERT, UPDATE, DELETE` on application tables, withholding `SUPERUSER` or `CREATEDB` permissions.

---

## 11. Known Limitations & Roadmap

* **In-Memory Rate Limiting:** The current rate limiter runs in process memory. In a distributed multi-instance deployment behind a load balancer, backing `express-rate-limit` with Redis is recommended.
* **Large Frontend Chunk Size:** The minified JavaScript bundle is ~800 kB minified (~230 kB gzip). Introducing code-splitting via `React.lazy()` for Analytics and Revision Center will reduce initial landing page size.
* **Bi-directional Drive Sync:** Currently, Google Drive notes are linked via authenticated URL. Native Google Drive picker integration can be added in future iterations.
