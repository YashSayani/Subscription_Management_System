# Brightloop Subscription Management System

Enterprise-grade subscription and billing engine for recurring SaaS products, quotations, multi-role RBAC, invoice generation, payment allocation, and real-time revenue analytics.

Built with **React + Vite + TypeScript + Tailwind** on the frontend, **Node.js + Express + TypeScript + Prisma** on the backend, and **PostgreSQL** for strict relational data integrity.

---

## Architecture & Workspaces

The repository is organized as an npm workspace monorepo:

* **`apps/api`**: Express REST API service with Helmet, CORS, strict Zod validation, Pino logger, and Prisma database access.
* **`apps/web`**: React 18 SPA powered by Vite, Tailwind CSS, TanStack Query, and Lucide icons.
* **`packages/database`**: Prisma schema and shared PostgreSQL database client.
* **`packages/shared`**: Shared domain contracts, Zod schemas, state machine enums, and API response types.

---

## Prerequisites

1. **Node.js**: v20+ (Verified on Node v24 LTS)
2. **PostgreSQL**: v15+ (Local instance running on port 5432)
3. **npm**: v10+

---

## Quickstart & Setup

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd BrightLoop
npm install
```

### 2. Configure Local Database
Ensure your local PostgreSQL instance is running. Connect and create the `brightloop` database:
```sql
CREATE DATABASE brightloop;
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env` in the root and in `apps/api`:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Ensure `DATABASE_URL` in `.env` matches your local PostgreSQL credentials:
```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/brightloop?schema=public
```

### 4. Generate Prisma Client
```bash
npm run prisma:generate --workspace=@brightloop/database
```

### 5. Start Development Servers
Start both the Express API (port 4000) and React Web Vite server (port 5173) simultaneously:
```bash
npm run dev
```

Visit **http://localhost:5173** to view the live system health dashboard connected to PostgreSQL.

---

## Verification & Quality Commands

| Command | Action |
| :--- | :--- |
| `npm run typecheck` | Validates TypeScript across all workspaces with zero errors. |
| `npm run lint` | Runs ESLint across root and all applications. |
| `npm run test` | Executes backend Vitest integration suite. |
| `npm run build` | Builds packages and production artifacts. |
| `npm run format` | Enforces Prettier code formatting. |

---

## Two-Developer Git Workflow

To ensure clean pair-programming and zero merge conflicts:

1. **Baseline Branch:** `main` is protected and always in a deployable, verified state.
2. **Branch Naming Strategy:**
   * Developer A: `feat/<module>-devA` (e.g., `feat/auth-devA`, `feat/billing-worker-devA`)
   * Developer B: `feat/<module>-devB` (e.g., `feat/catalog-devB`, `feat/invoices-devB`)
   * Chores / Fixes: `chore/<description>` or `fix/<description>`
3. **Commit Convention:** Conventional Commits:
   ```text
   type(scope): concise imperative description
   ```
   *Examples:* `feat(auth): add refresh token rotation`, `fix(invoice): prevent rounding drift`
4. **Integration Protocol:**
   * Pull latest `main` before starting work: `git pull origin main`.
   * Never commit secrets or unverified code.
   * Run `npm run typecheck && npm run lint && npm run test` before creating a pull request.
   * Both developers update [`CLAUDE.md`](./CLAUDE.md) status table and changelog on every merge.
