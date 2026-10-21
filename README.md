# DSA Vault — Algorithmic Learning Journal, Spaced Repetition & CS Fundamentals

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)

**DSA Vault** is a full-stack platform designed for software engineers and computer science students to systematically record, review, and master data structures, algorithms, and core computer science fundamentals. It combines an engineering-grade **DSA problem journal** and automated **spaced-repetition scheduler** with a comprehensive **CS Fundamentals Learning Path**, **Daily Learning Experience**, and **Server-Evaluated Knowledge Assessments**.

---

## Table of Contents

1. [Features](#1-features)
   * [DSA Problem Solving Journal](#-problem-solving-journal)
   * [Spaced-Repetition Revision Center](#-spaced-repetition-revision-center)
   * [CS Fundamentals Learning Path](#-cs-fundamentals-learning-path)
   * [Daily Learning & Streak System](#-daily-learning--streak-system)
   * [Topic Knowledge Assessments](#-topic-knowledge-assessments)
   * [Dashboard, Heatmap & Analytics](#-dashboard-heatmap--analytics)
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

### 🔁 Spaced-Repetition Revision Center
* **Algorithm-Driven Scheduling:** Default multi-stage intervals (1, 3, 7, 14, 30 days) that adapt dynamically based on revision outcomes (*Solved Independently*, *Solved With Hint*, *Reviewed Solution*, *Unable To Solve*).
* **Configurable Cadence:** Users can customize revision intervals in Settings.
* **Manual Rescheduling & History:** Track full audit logs of past revision attempts while retaining the ability to manually reschedule.

### 📚 CS Fundamentals & Placement Preparation Curriculum
* **Two-Phase Architecture:**
  * **Phase 1: Foundations and Placement Essentials (~120 topics):** Comprehensive core computer science and interview curriculum focused on technical hiring bars. Includes programming foundations, structured DSA (Stages A–F), Object-Oriented Programming, Database Management Systems, Operating Systems, Computer Networks, and Backend Engineering.
  * **Phase 2: Advanced CS and Engineering (~49 topics):** Advanced distributed systems consensus (Raft/Paxos), compiler theory (lexing/parsing/AST/codegen), advanced data structures (Segment Trees, Treaps, Tries, Disjoint Set Union), container orchestration (Kubernetes internals), and advanced deep learning systems. Topics have clear prerequisite links from Phase 1.
* **DSA Systematic Progression (Stages A–F):**
  * *Stage A: Asymptotic Analysis & Foundations* (Big-O/Theta/Omega, space/time trade-offs, standard library container costs).
  * *Stage B: Core Algorithmic Patterns* (Two Pointers, Sliding Window, Prefix Sums, Binary Search on sorted spaces & answer spaces).
  * *Stage C: Recursion, Backtracking & Search* (Recursion trees, state pruning, subsets/permutations, with an optional *Bit Manipulation* track).
  * *Stage D: Linear & Hierarchical Data Structures* (Monotonic stacks, queues, linked lists, trees, binary search trees, heaps & priority queues).
  * *Stage E: Graph Algorithms* (Breadth-First Search, Depth-First Search, Topological Sort / Kahn's algorithm, Dijkstra's shortest paths, Minimum Spanning Trees).
  * *Stage F: Dynamic Programming* (State definition, recurrence relations, 1D & 2D tables, 0/1 & Unbounded Knapsack, Interval DP, and Tree/DAG DP).
* **Subject-Specific Primary Language Designations:**
  * **C++:** Primary language for Data Structures, Algorithms, Programming Fundamentals, and Low-Level Design (emphasizing pointer mechanics, STL efficiency, and performance constraints; alternative Java/Python solutions accepted).
  * **Python:** Primary language for AI/ML, Data Processing, and rapid scripting (Stages 1–6 from Python Basics to PyTorch and RAG pipelines).
  * **SQL:** Primary query language for Relational DBMS, indexing, and query optimization.
  * **JavaScript / Node.js:** Primary runtime for Backend API engineering and developer tools.
* **Prerequisite-Driven Directed Acyclic Graph (DAG) Unlocking:**
  * Eliminates artificial global sequential bottlenecks: topics unlock dynamically as soon as their direct prerequisite topics are completed (`cs_topic_prerequisites`).
  * Backend strictly validates prerequisite satisfaction before permitting topic completion.
  * Dependency graph validated with 0 cycles across all 169 curriculum topics.

### 💼 Parallel Placement Preparation Center
Runs continuously in parallel with the curriculum—learners can prepare for hiring rounds at any stage without having to finish all 169 topics first:
* **Track A — Daily Problem-Solving Routine:** Maintain a consistent habit of 1–2 algorithmic problems per day in C++ with time and space complexity notes.
* **Track B — Timed Assessments & Speed Practice:** Log timed test simulations (45–60 minute rounds) mimicking real-world company Online Assessments (OA).
* **Track C — Core CS Interview Refresher:** Rapid interview revision covering high-frequency viva/interview topics in OS, DBMS, Networks, and OOP.
* **Track D — Deep Project Defense & Application Tracker:**
  * *Deep Project Defense:* Document resume projects with architecture diagrams, technology trade-offs, scalability bottlenecks, failure modes, and anticipated interviewer challenge questions.
  * *Application Tracker:* Track company, role, status (*Applied*, *OA Pending*, *Interviewing*, *Offered*, *Rejected*), CTC/salary range, next steps, and referral notes.
* **Track E — Mock Interviews & Behavioral Prep:** Record mock technical and HR interviews, track scores out of 10, interviewer feedback, strengths, and areas for improvement.
* **Spaced Weekly Revision:** Review completed curriculum topics grouped by module to counteract forgetting curves.

### 📅 Daily Learning & Streak System
* **Today's Learning Dashboard (`/cs-fundamentals/daily`):** Highlights today's active topic, module context, objectives, remaining checklist tasks, and overall curriculum completion.
* **Activity & Study Logging (`user_cs_study_log`):** Records timestamped activity logs whenever a user starts studying, updates a checklist item, or completes a topic.
* **Dedicated Learning Streaks:** Calculates consecutive study days independently from the DSA problem-solving streak.
* **Timezone Awareness:** Calculates calendar days and streaks based on user-configured timezone (defaults to `Asia/Kolkata` if unset).
* **Missed-Days Tolerance:** Missing days preserves all progress without auto-skipping or forcing arbitrary 24-hour locks.

### 📝 Topic Knowledge Assessments
* **In-Depth Assessments (`/cs-fundamentals/topics/:id/assessment`):** Topic-specific assessments containing Multiple Choice Questions (MCQ), conceptual questions, and short-answer questions.
* **Server-Side Evaluation:** Client never submits scores or pass/fail flags; answers are submitted to `/api/cs-assessments/topics/:topicId/assessment` where backend scores against answer keys and returns results with explanations.
* **Attempt History Auditing:** Every attempt is stored with timestamp, score, correct/incorrect breakdown, and full per-question review without overwriting past attempts.
* **Configurable Completion Gating:** Topics can be marked mandatory with a custom passing score (`passing_score`). If configured as mandatory, topic completion is blocked at the backend API until a passing attempt is recorded.

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
                                                │  • /api/analytics         │
                                                │  • /api/cs-fundamentals   │
                                                │  • /api/cs-assessments    │
                                                │  • /api/health & /ready   │
                                                └─────────────┬─────────────┘
                                                              │ Parameterized SQL
                                                              │ (TLS Encrypted)
                                                              ▼
                                                ┌───────────────────────────┐
                                                │ Managed PostgreSQL DB     │
                                                │  • users & user_settings  │
                                                │  • problems & revisions   │
                                                │  • cs_modules & topics    │
                                                │  • user_cs_progress       │
                                                │  • user_cs_study_log      │
                                                │  • cs_assessment_questions│
                                                │  • user_cs_assessments    │
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
Apply all schema migrations (including CS Fundamentals, Daily Learning, and Assessment banks):
```bash
npm run db:migrate
```

### Step 5: Start the Development Servers
In Terminal 1 (API Server):
```bash
npm run server
```
In Terminal 2 (Vite Frontend):
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 5. Environment Variables

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

DSA Vault utilizes **versioned, forward-only SQL migrations** tracked in the `schema_migrations` table. Migrations never drop or reset production tables.

### Migration Files (`db/migrations/`)
1. `001_create_schema.sql` — Users, problems, topics, problem_topics, revisions, problem_mistakes, and user_settings tables.
2. `002_seed_topics.sql` — Populates predefined standard DSA topics.
3. `003_update_revisions_and_settings.sql` — Spaced repetition intervals and settings constraints.
4. `004_add_timezone_to_settings.sql` — Timezone support for streak and calendar queries.
5. `005_add_daily_revision_goal.sql` — Daily revision target tracking.
6. `006_cs_fundamentals.sql` — CS Fundamentals schema (`cs_modules`, `cs_sections`, `cs_topics`, `cs_topic_checklist_items`, `user_cs_progress`, `user_cs_checklist_progress`) and full 14-module curriculum seed.
7. `007_cs_daily_learning.sql` — Study activity log table (`user_cs_study_log`), daily checklist target setting, and learning timezone support.
8. `008_cs_assessments.sql` — Topic assessment question bank (`cs_assessment_questions`), topic assessment configurations (`cs_topic_assessment_config`), attempt history records (`user_cs_assessment_attempts`, `user_cs_assessment_answers`), and question bank seeds.
9. `009_curriculum_reorganization.sql` — Curriculum reorganization into Phase 1 & 2, DSA Stages A–F, Primary Languages (C++, Python, SQL, JS), prerequisite dependency DAG (`cs_topic_prerequisites`), parallel placement preparation schema (`user_interview_projects`, `user_job_applications`, `user_mock_interviews`, `user_timed_assessments`), and new foundational topics (Bit Manipulation, Python for Data Work, Math & Stats for ML).

### Running Migrations
```bash
npm run db:migrate
```
*Note:* The migration runner connects inside a database transaction (`BEGIN ... COMMIT`), checks `schema_migrations`, applies pending files in alphabetical order, and rolls back atomically on failure.

---

## 7. API Endpoints

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Register a new account.
* `POST /api/auth/login` — Authenticate and receive a JWT.
* `GET /api/auth/me` — Retrieve the current authenticated user.

### Problems & Journal (`/api`)
* `GET /api/problems` — List problems with filtering, pagination, and sorting.
* `POST /api/problems` — Create a new problem record.
* `GET /api/problems/:id` — Get problem details with revision history.
* `PUT /api/problems/:id` — Update problem details.
* `DELETE /api/problems/:id` — Remove a problem record.
* `POST /api/problems/:id/revisions` — Log a spaced-repetition revision attempt.

### CS Fundamentals (`/api/cs-fundamentals`)
* `GET /api/cs-fundamentals/curriculum` — Full 14-module syllabus tree with user completion states and active topic sequence.
* `GET /api/cs-fundamentals/topics/:id` — Topic details, objectives, notes, and checklist items.
* `POST /api/cs-fundamentals/topics/:id/checklist/:itemId` — Toggle checklist item completion.
* `POST /api/cs-fundamentals/topics/:id/complete` — Mark topic as complete (enforces checklist confirmation & assessment gate).
* `GET /api/cs-fundamentals/daily` — Today's active topic, streak, and checklist goals.
* `GET /api/cs-fundamentals/history` — Daily study history log.
* `GET /api/cs-fundamentals/streak` — Dedicated CS learning streak and active days.

### Knowledge Assessments (`/api/cs-assessments`)
* `GET /api/cs-assessments/topics/:topicId/assessment` — Fetch assessment questions (answer keys omitted), topic config, and past attempts.
* `POST /api/cs-assessments/topics/:topicId/assessment` — Submit answers for server-side evaluation and score recording.
* `GET /api/cs-assessments/topics/:topicId/assessment/attempts` — Full audit history with per-question review and explanations.
* `GET /api/cs-assessments/topics/:topicId/pass-status` — Quick status check on whether the topic requires an assessment and if user passed.

### Placement & Interview Tracks (`/api/cs-fundamentals/placement`)
* `GET /api/cs-fundamentals/placement/projects` — Fetch tracked resume projects for technical defense.
* `POST /api/cs-fundamentals/placement/projects` — Add project with architecture overview, trade-offs, and defense questions.
* `PUT /api/cs-fundamentals/placement/projects/:id` — Update project defense details or readiness level (1–5).
* `DELETE /api/cs-fundamentals/placement/projects/:id` — Remove project from defense tracker.
* `GET /api/cs-fundamentals/placement/applications` — Fetch all job & internship applications.
* `POST /api/cs-fundamentals/placement/applications` — Record application (company, role, status, CTC, deadlines, notes).
* `PUT /api/cs-fundamentals/placement/applications/:id` — Update application status (*Applied*, *OA Pending*, *Interviewing*, *Offered*, *Rejected*).
* `DELETE /api/cs-fundamentals/placement/applications/:id` — Delete application record.
* `GET /api/cs-fundamentals/placement/mock-interviews` — Fetch past mock interview records and performance feedback.
* `POST /api/cs-fundamentals/placement/mock-interviews` — Record a mock session (type, score /10, strengths, improvement areas).
* `GET /api/cs-fundamentals/placement/timed-assessments` — Fetch timed test simulation records.
* `POST /api/cs-fundamentals/placement/timed-assessments` — Record timed test attempt (duration, questions, score %, pass/fail).
* `GET /api/cs-fundamentals/placement/weekly-revision` — Retrieve completed topics grouped by module for spaced revision.

---

## 8. Running Tests

The test suite validates algorithms, data isolation, negative inputs, security policies, and end-to-end integration:

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

---

## 12. Known Limitations & Roadmap

* **In-Memory Rate Limiting:** The current rate limiter runs in process memory. In a distributed multi-instance deployment behind a load balancer, backing `express-rate-limit` with Redis is recommended.
* **Large Frontend Chunk Size:** Consider introducing code-splitting via `React.lazy()` for Analytics, Revision Center, and CS Fundamentals pages to reduce the initial load bundle.
* **Custom Questions Authoring:** Currently questions are seeded in PostgreSQL; adding an in-app instructor/admin authoring interface for new questions is planned on the roadmap.
