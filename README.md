# Employee Attendance Management

A full-stack work-from-home attendance MVP for employees and HR. Employees sign in and submit daily attendance with photo proof; HR manages employee accounts and reviews attendance records.

## Features

- Role-based authentication for `EMPLOYEE` and `HR`.
- HR employee management: create, search, update, and deactivate employee accounts.
- Employee attendance submission with JPEG or PNG photo proof.
- Server-generated submission timestamps and one attendance submission per employee per Jakarta calendar day.
- HR attendance monitoring with date and employee filters, detail pages, and protected photo access.
- Responsive React application and documented REST API.

## Tech stack

- **Web:** React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS.
- **API:** NestJS, TypeScript, Prisma, JWT, Argon2.
- **Database:** MySQL 8.4.
- **Workspace:** pnpm.

The API is a modular monolith, organized around authentication, employees, and attendance.

## Requirements

- Node.js 20.19 or newer.
- pnpm 9.15.9.
- Docker Compose v2.

## Quick start

Run these commands from the repository root.

1. Create your local environment file and install dependencies:

   ```powershell
   Copy-Item .env.example .env
   pnpm install
   ```

2. Update `.env` before starting the database. Replace every placeholder, set `JWT_SECRET` to a random value of at least 32 characters, and set unique demo email addresses with passwords of at least 12 characters.

3. Start MySQL, generate the Prisma client, apply migrations, and seed demo accounts:

   ```powershell
   docker compose up -d mysql
   pnpm --filter @dexa/api db:generate
   pnpm --filter @dexa/api db:migrate
   pnpm --filter @dexa/api db:seed
   ```

4. Start the web app and API:

   ```powershell
   pnpm dev
   ```

Open the web app at [http://localhost:5173](http://localhost:5173). The API listens on [http://localhost:3000](http://localhost:3000), and its Swagger UI is at [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs).

The seed reads `SEED_HR_EMAIL`, `SEED_HR_PASSWORD`, `SEED_EMPLOYEE_EMAIL`, `SEED_EMPLOYEE_PASSWORD`, and `SEED_EMPLOYEE_NUMBER` from `.env`. Use those credentials to sign in as HR or as the demo employee. Re-running the seed does not change existing passwords or reactivate existing employee accounts; conflicting accounts cause an error.

## Environment

`.env.example` lists all supported variables and placeholder values. Important settings:

| Variable             | Purpose                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Migration database connection.                                                      |
| `APP_DATABASE_URL`   | API runtime connection; use the restricted runtime account.                         |
| `API_PORT`           | API port; defaults to `3000`.                                                       |
| `JWT_SECRET`         | Secret used to sign access tokens; use at least 32 random characters.               |
| `JWT_EXPIRES_IN`     | Token lifetime, such as `1h`; defaults to `1h`.                                     |
| `WEB_ORIGIN`         | Allowed web origin for CORS; defaults to `http://localhost:5173`.                   |
| `VITE_API_URL`       | API base URL used by the web app; defaults to `http://localhost:3000/api/v1`.       |
| `UPLOAD_DIR`         | Private attendance photo directory; defaults to `./uploads` relative to `apps/api`. |
| `UPLOAD_MAX_SIZE_MB` | Photo size limit from 1 to 5 MiB; defaults to `5`.                                  |

Keep `.env` and real credentials out of version control. `DATABASE_URL` is for migrations; `APP_DATABASE_URL` is for application queries and should not use a database administrator account.

On a fresh MySQL volume, Docker Compose creates the restricted runtime account. If the volume was initialized before that account was configured, create it once with:

```powershell
docker compose exec mysql bash /docker-entrypoint-initdb.d/10-create-app-user.sh
```

Attendance photos are stored locally under `apps/api/uploads` by default. Keep this directory private, writable, and backed up with the database.

## Run apps independently

```powershell
pnpm --filter @dexa/web dev
pnpm --filter @dexa/api dev
```

Set `VITE_API_URL` in the root `.env` if the API uses a different address.

## API overview

All endpoints use the `/api/v1` prefix.

| Method         | Endpoint                    | Access        | Purpose                                           |
| -------------- | --------------------------- | ------------- | ------------------------------------------------- |
| `GET`          | `/health`                   | Public        | Health check.                                     |
| `POST`         | `/auth/login`               | Public        | Sign in and receive an access token.              |
| `GET`          | `/auth/me`                  | Authenticated | Get the current user.                             |
| `GET`, `POST`  | `/employees`                | HR            | List or create employees.                         |
| `GET`, `PATCH` | `/employees/:id`            | HR            | Get or update an employee.                        |
| `PATCH`        | `/employees/:id/deactivate` | HR            | Deactivate an employee.                           |
| `POST`         | `/attendance`               | Employee      | Submit attendance with a `photo` multipart field. |
| `GET`          | `/attendance`               | HR            | List and filter attendance.                       |
| `GET`          | `/attendance/:id`           | HR            | Get an attendance record.                         |
| `GET`          | `/attendance/:id/photo`     | HR            | View its protected photo.                         |

See the live [Swagger UI](http://localhost:3000/api/v1/docs) or the [API contract](docs/api-contract.md) for request and response details.

## Project structure

```text
apps/
  api/       NestJS API, Prisma schema, and migrations
  web/       React application
```

## Known limitations

- Attendance photos use local file storage; production deployments need persistent private storage.
- Upload checks validate MIME type, file extension, and file signature; they do not fully decode image contents.
- Employee attendance history is not available in the current API.
- This project demonstrates modular boundaries in a monolith; it does not deploy separate microservices.
