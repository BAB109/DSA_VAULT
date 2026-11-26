# DSA Vault — Algorithmic Learning Journal, Spaced Repetition & DSA Tracker

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)

**DSA Vault** is a full-stack platform designed for software engineers and computer science students to systematically record, review, and master data structures and algorithms. It combines an engineering-grade **DSA problem journal** and automated **spaced-repetition scheduler** with a **LeetCode Question Catalog**, peer **Trackers (cohort study groups)**, and a lightweight **Focus Timer Widget**.

---

## Table of Contents

1. [Features](#1-features)
   * [DSA Problem Solving Journal](#-problem-solving-journal)
   * [LeetCode Catalog & Problem Linking](#-leetcode-catalog--problem-linking)
   * [Spaced-Repetition Revision Center](#-spaced-repetition-revision-center)
   * [Trackers (Peer Accountability Cohorts)](#-trackers-peer-accountability-cohorts)
   * [Dashboard, Heatmap & Analytics](#-dashboard-heatmap--analytics)
   * [Focus Timer & Quick Log Widget](#-focus-timer--quick-log-widget)
   * [Enterprise-Grade Security](#-enterprise-grade-security)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Local Installation](#4-local-installation)
5. [Environment Variables](#5-environment-variables)
6. [Database Setup & Versioned Migrations](#6-database-setup--versioned-migrations)
7. [API Endpoints](#7-api-endpoints)
8. [Running Tests](#8-running-tests)
9. [Production Build](#9-production-build)
10. [Deployment Instructions (Render / Cloud)](#10-deployment-instructions-render--cloud)
11. [Database Backup & Disaster Recovery](#11-database-backup--disaster-recovery)
12. [Known Limitations & Roadmap](#12-known-limitations--roadmap)

---

## 1. Features

### 🧠 Problem Solving Journal
* **Structured Records:** Track title, platform (LeetCode, HackerRank, Codeforces, GFG, InterviewBit), difficulty (Easy, Medium, Hard), solving status, and time taken.
* **Dual Approach Modeling:** Document initial brute-force approach alongside optimized solutions with explicit Time and Space complexities.
* **Google Drive Notes Integration:** Attach Google Drive / Docs links to both initial and improved solutions with safe browser isolation (`noopener noreferrer`).
* **Self-Assessment & Mistake Categorization:** Rate confidence (1–5) and classify mistake types (e.g., *Off-by-one*, *TLE*, *Wrong algorithm*, *Edge case omission*).

### 📖 LeetCode Catalog & Problem Linking
* **Integrated Catalog:** Full catalog of LeetCode problems (number, title, slug, difficulty, topic tags).
* **Instant Autocomplete & Prefill:** Search catalog by number or title; selecting a problem prefills the title, difficulty, and URL, linking the problem directly to the catalog.
* **Conflict Prevention:** Prevents duplicate catalog problem entries per user while allowing manual unlinked entries.

### 🔁 Spaced-Repetition Revision Center
* **Algorithm-Driven Scheduling:** Default multi-stage intervals (1, 3, 7, 14, 30 days) that adapt dynamically based on revision outcomes (*Solved Independently*, *Solved With Hint*, *Reviewed Solution*, *Unable To Solve*).
* **Configurable Cadence:** Users can customize revision intervals in Settings.
* **Manual Rescheduling & History:** Track full audit logs of past revision attempts while retaining the ability to manually reschedule.

### 👥 Trackers (Peer Accountability Cohorts)
* **Small Cohort Accountability:** Join shared study trackers (up to ~10 members) with scheduled daily problem sets (1–10 problems/day).
* **Private Notes Protection:** Group members only share completion status and solution links; personal notes remain strictly private in the vault.
* **Daily Assignments & Overdue Management:** Automatic daily problem generation with overdue tracking (oldest first).
* **Group Leaderboard:** Real-time visibility into today's completions, pending debt, and on-time streaks (🔥).
* **Cohort Administration:** Admin controls for public codes, invite tokens, member management, and CSV problem sheet uploads.

### 📊 Dashboard, Heatmap & Analytics
* **GitHub-Style 52-Week Activity Heatmap:** Accessible, keyboard-navigable (`Arrow keys`, `Enter`/`Space`) calendar with shading levels (`0` to `4`) and date-specific activity counts.
* **Dual Daily Goals:** Set and monitor target problems and target revisions completed per day.
* **Analytical Visualizations:** Recharts-powered graphs for 7-day/30-day activity trends, difficulty breakdown, topic-wise competency, and mistake distribution.
* **Timezone Awareness:** All calendar dates, streak calculations, and goal progress respect the user's configured timezone.

### ⏱️ Focus Timer & Quick Log Widget
A persistent, collapsible floating widget docked in the bottom-right corner of every protected page.
* **Timer:** Global focus timer backed by wall-clock tracking to prevent tab throttling. Supports countdown and stopwatch modes.
* **Quick Log Solve:** One-click button that pauses the timer and pre-fills elapsed minutes into the Add Problem form.
* **Shortcuts:** Quick navigation to Log Problem, Revision Center, and Problem Library.

### 🛡️ Enterprise-Grade Security
* **Bcrypt Password Hashing:** Salt factor of 12 with dummy comparison to mitigate side-channel timing attacks.
* **Stateless JWT Authentication:** Bearer tokens with expiration validation.
* **Strict User Isolation (IDOR Defense):** All mutations and reads enforce `user_id` ownership at the query level.
* **Protocol & Input Sanitization:** Rejects non-HTTP(S) schemes, disallows `javascript:`/`data:` payloads, and restricts notes URLs to Google Drive/Docs domains.
* **SQL Injection Resistance:** Parameterized queries across all database operations.
* **Rate Limiting:** Protects registration and login endpoints against brute-force attacks.
* **Demo User Provisioning:** A sandboxed demo account is auto-provisioned at startup (`ensureDemoUser`) so evaluators can explore the platform without registering.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, React Router v7, Lucide Icons, Recharts, Tailwind CSS v4, Vite |
| **Backend** | Node.js (ES Modules), Express 5, bcrypt, jsonwebtoken, cors, express-rate-limit, csv-parse |
| **Database** | PostgreSQL 14+ via `pg` connection pool with TLS/SSL support |
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
                                                │  • /api/catalog           │
                                                │  • /api/trackers          │
                                                │  • /api/health & /ready   │
                                                └─────────────┬─────────────┘
                                                              │ Parameterized SQL
                                                              │ (TLS Encrypted)
                                                              ▼
                                                ┌───────────────────────────┐
                                                │ Managed PostgreSQL DB     │
                                                │  • users & user_settings  │
                                                │  • problems & revisions   │
                                                │  • catalog_problems       │
                                                │  • trackers & members     │
                                                │  • tracker_assignments   │
                                                │  • submissions            │
                                                └───────────────────────────┘
```

---

## 4. Local Installation

### Prerequisites
* **Node.js** `>= 18.0.0`
* **npm** `>= 9.0.0`
* **PostgreSQL** `>= 14.0`

### Step 1: Clone the Repository
```bash
git clone https://github.com/BAB109/DSA_VAULT.git
cd DSA_VAULT
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create your local `.env` file from the template:
```bash
cp .env.example .env
```
Ensure your database credentials and secret are set:
```ini
PORT=5000
PGHOST=localhost
PGPORT=5432
PGDATABASE=dsa_vault
PGUSER=postgres
PGPASSWORD=your_postgres_password
PGSSL=false

JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### Step 4: Run Versioned Database Migrations
Apply all schema migrations:
```bash
npm run db:migrate
```

### Step 5: (Optional) Import Problem Catalog
Import the LeetCode problem catalog dataset:
```bash
npm run catalog:import
```

### Step 6: Start the Development Servers
In Terminal 1 (API Server):
```bash
npm run server
```
In Terminal 2 (Vite Frontend):
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

> **Demo Account:** A sandboxed demo user is auto-provisioned on startup. Check your `.env.example` for the credentials or the server logs for the generated username/password.

---

## 5. Environment Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes (in prod) | `development` | Set to `production` in production deployments. |
| `PORT` | No | `5000` | Port for the Express backend server. |
| `DATABASE_URL` | Recommended | `null` | Full PostgreSQL connection URI. |
| `PGHOST` | No | `localhost` | Discrete database host (used if `DATABASE_URL` is omitted). |
| `PGPORT` | No | `5432` | Discrete database port. |
| `PGDATABASE` | No | `dsa_vault` | Database name. |
| `PGUSER` | No | `postgres` | Database username. |
| `PGPASSWORD` | No | `null` | Database password. |
| `PGSSL` | No | `false` | Enable TLS (`true`/`false`). Auto-detected for cloud hosts. |
| `PGSSL_REJECT_UNAUTHORIZED` | No | `false` | Verify CA certificate chain. Set to `false` for cloud self-signed certs. |
| `JWT_SECRET` | **Yes (in prod)** | *Fallback* | Secret key for signing JWTs. Must be ≥ 32 characters in production. |
| `JWT_EXPIRES_IN` | No | `7d` | Lifespan of issued authentication tokens. |
| `CLIENT_URL` | Recommended | `null` | Comma-separated list of permitted CORS frontend origins. |
| `REQUIRE_DB` | No | `false` | When `true`, `/api/ready` returns 503 if PostgreSQL is disconnected. |
| `VITE_API_URL` | No | `/api` | Base URL used by the React client. Keep `/api` for unified hosting. |

---

## 6. Database Setup & Versioned Migrations

DSA Vault utilizes **versioned, forward-only SQL migrations** tracked in the `schema_migrations` table. Migrations never drop or reset production tables.

### Migration Files (`db/migrations/`)
1. `001_create_schema.sql` — Users, problems, topics, problem_topics, revisions, problem_mistakes, and user_settings tables.
2. `002_seed_topics.sql` — Populates predefined standard DSA topics.
3. `003_update_revisions_and_settings.sql` — Spaced repetition intervals and settings constraints.
4. `004_add_timezone_to_settings.sql` — Timezone support for streak and calendar queries.
5. `005_add_daily_revision_goal.sql` — Daily revision target tracking.
6. `006_cs_fundamentals.sql` — Historical CS Fundamentals schema.
7. `007_cs_daily_learning.sql` — Historical study activity log table.
8. `008_cs_assessments.sql` — Historical topic assessment question bank.
9. `009_curriculum_reorganization.sql` — Historical curriculum reorganization and placement schema.
10. `010_seed_demo_user.sql` — Seeds sandboxed demo account.
11. `011_problem_catalog.sql` — LeetCode problem catalog (`catalog_problems`) and problem linking reference.
12. `012_trackers.sql` — Peer accountability trackers, memberships, invites, sheet items, daily assignments, and submissions.
13. `014_drop_cs_modules.sql` — Drops historical CS and placement modules to focus exclusively on DSA tracking.

### Running Migrations
```bash
npm run db:migrate
```

---

## 7. API Endpoints

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Register a new account.
* `POST /api/auth/login` — Authenticate and receive a JWT.
* `GET /api/auth/me` — Retrieve current authenticated user profile.

### Problems & Journal (`/api`)
* `GET /api/problems` — List problems with filtering, pagination, and sorting.
* `POST /api/problems` — Create a new problem record (optional catalog linking).
* `GET /api/problems/:id` — Get problem details with revision history.
* `PUT /api/problems/:id` — Update problem details.
* `DELETE /api/problems/:id` — Remove a problem record.
* `POST /api/problems/:id/revisions` — Log a spaced-repetition revision attempt.
* `POST /api/problems/:id/reschedule` — Manually reschedule problem next revision date.

### Problem Catalog (`/api/catalog`)
* `GET /api/catalog?q=` — Search LeetCode catalog by number or title substring.

### Trackers & Cohorts (`/api/trackers`)
* `GET /api/trackers/my` — Fetch user's joined trackers and pending join requests.
* `POST /api/trackers` — (Admin) Create a new tracker cohort.
* `GET /api/trackers/:id` — Get tracker metadata and sheet progress.
* `GET /api/trackers/:id/today` — Fetch today's assigned problems and member statuses.
* `GET /api/trackers/:id/pending` — Fetch member's overdue assignments.
* `GET /api/trackers/:id/board` — Get cohort leaderboard (done today, pending count, streaks).
* `POST /api/trackers/:id/assignments/:assignmentId/submit` — Submit solution for an assignment.
* `POST /api/trackers/requests` — Submit request to join via public code.
* `DELETE /api/trackers/requests/:id` — Cancel a pending join request.
* `POST /api/trackers/invites/accept` — Accept an invite token and join tracker.
* `DELETE /api/trackers/:id/leave` — Leave a tracker cohort.
* `POST /api/trackers/:id/sheet/preview` — (Admin) Preview problem sheet CSV.
* `POST /api/trackers/:id/sheet/confirm` — (Admin) Confirm and apply problem sheet.
* `POST /api/trackers/:id/invites` — (Admin) Generate invite link.
* `GET /api/trackers/:id/invites` — (Admin) List active and past invites.
* `DELETE /api/trackers/:id/invites/:inviteId` — (Admin) Revoke an invite.
* `POST /api/trackers/:id/members/:userId/remove` — (Admin) Remove a member.
* `PUT /api/trackers/:id/settings` — (Admin) Update problems/day or timezone for future days.

---

## 8. Running Tests

The test suite validates algorithms, data isolation, negative inputs, security policies, catalog linking, and trackers:

```bash
# Run all automated test suites sequentially
npm run test:all
```

Individual test suites:
* `node server/test-scheduler.js` — Verifies spaced repetition intervals, outcome stage progression, and resets.
* `node server/test-analytics.js` — Verifies dashboard aggregations, division-by-zero handling, and topic progress.
* `node server/test-calendar-goals.js` — Verifies 52-week activity calendar, daily goals, and timezone calculation.
* `node server/test-integration.js` — Verifies authentication, problem CRUD, multi-topic assignment, and notes links.
* `node server/test-security-prerelease.js` — Verifies JWT verification, input bounds, scheme rejection, and IDOR isolation.
* `node server/test-catalog.js` — Verifies catalog search, number/title queries, wildcard escaping, and idempotency.
* `node server/test-catalog-link.js` — Verifies catalog linking, conflict handling (409), and tenant isolation.
* `node server/test-trackers.js` — Comprehensive test suite covering trackers lifecycle, invites, backfill, and concurrency.

---

## 9. Production Build

To compile the React frontend into an optimized production bundle:

```bash
npm run build
```
This produces optimized distribution assets in `dist/`:
* `dist/index.html` — Clean SPA entry point.
* `dist/assets/index-[hash].css` — Minified Tailwind v4 CSS bundle.
* `dist/assets/index-[hash].js` — Tree-shaken production JavaScript bundle.

---

## 10. Deployment Instructions (Render / Cloud)

### Unified Monolith Deployment (Single Service)

DSA Vault serves both the React client and Express API from a single container or service:

1. **Database:**
   * Create a PostgreSQL database (e.g. on Render, Neon, or Supabase).
   * Copy the connection string (`postgresql://...`).

2. **Render Web Service Configuration:**
   * **Environment:** `Node`
   * **Build Command:**
     ```bash
     npm install && npm run build
     ```
   * **Start Command:**
     ```bash
     npm run db:migrate && npm start
     ```
   * **Environment Variables:**
     * `NODE_ENV=production`
     * `PORT=10000` (or host-assigned)
     * `DATABASE_URL=your-production-database-url`
     * `JWT_SECRET=use-a-strong-random-32-char-secret`
     * `REQUIRE_DB=true`
   * **Health Checks:**
     * Liveness: `/api/health`
     * Readiness: `/api/ready`

---

## 11. Database Backup & Disaster Recovery

When operating in production with managed PostgreSQL:

1. **Automated Snapshots:**
   * Enable daily automated snapshots with at least a 7-day retention period.
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

---

## 12. Known Limitations & Roadmap

* **In-Memory Rate Limiting:** The current rate limiter runs in process memory. In a distributed multi-instance deployment behind a load balancer, backing `express-rate-limit` with Redis is recommended.
* **Large Frontend Chunk Size:** Consider introducing code-splitting via `React.lazy()` for Analytics, Revision Center, and Trackers pages to reduce the initial load bundle.
