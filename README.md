# Technologist Academy Node Service Template

A starter repository for building Node.js HTTP services in the Technologist Academy.

It gives you a working Express service with TypeScript and a production build already wired together, so you can start writing features. Out of the box it exposes a single `GET /health` endpoint that reports service status and uptime.

## Requirements

| Tool                                 | Version | Notes                                                                         |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| [nvm](https://github.com/nvm-sh/nvm) | latest  | Required. Manages your Node version per project.                              |
| Node.js                              | 22      | Pinned in [.nvmrc](.nvmrc). Install it with nvm, not with a system installer. |
| npm                                  | 10+     | Ships with Node 22.                                                           |

Install nvm, then from the repository root run:

```sh
nvm install   # reads .nvmrc and installs Node 22
nvm use       # switches this shell to Node 22
```

Run `nvm use` every time you open a new terminal in this project, or configure your shell to do it automatically. Using a different Node version may cause confusing build failures.

Verify you are on the right version:

```sh
node -v   # should print v22.x.x
```

## Quick start

```sh
nvm use
npm ci             # install exact dependency versions from package-lock.json
cp .env.example .env
npm run dev        # start the service with hot reload
```

Then in another terminal:

```sh
curl http://localhost:3000/health
# {"status":"ok","uptime":1.234}
```

Use `npm ci` rather than `npm install`. It installs the exact versions recorded in `package-lock.json`, so everyone on the team runs identical dependencies. Use `npm install` only when you are deliberately adding or upgrading a package.

## Admin portal API

The backend exposes the protected endpoints used by the frontend admin portal:
- `POST /login` authenticates customer and staff accounts. Its
  `customer.role` response field is `customer` for customers and the staff
  member's role for staff accounts.
- `GET /me` returns the authenticated customer or staff ID and current role
  from the database.
- `GET /admin/dashboard?period=today|week|month` returns sales metrics and all
  products with fewer than five units in stock. Sales periods use the
  `Europe/London` timezone; only `paid` and `completed` orders count as sales.
- `POST /admin/products/:id/reorder` atomically adds 20 units to the product
  stock. Only a staff account whose `staffRole` is `ADMIN` may access either
  admin endpoint; customer accounts and other staff roles are denied.

Staff accounts are stored separately from customers and include a unique email
and an Argon2-hashed password. The staff availability field is informational and
does not determine admin authorization. The staff-account migration transfers
existing customer accounts with the `ADMIN` role, including their active
refresh-token sessions, before removing the customer role column.

Apply pending migrations before starting the updated backend:

```sh
npx prisma migrate deploy
```

Set `ADMIN_PASSWORD` in the local, git-ignored `.env` file, then provision the
administrator account with:

```sh
npm run admin:provision
```

The script creates or updates `admin@friendshop.com` in the `Staff` table,
stores an Argon2 password hash, and assigns the `ADMIN` staff role. It does not
store the password in the source code. Customer registration cannot create or
change staff roles.

Each order line now stores its purchase-time unit price so future revenue is
based on the order price rather than the current product price. The migration
backfills existing lines from today's product price because historical prices
were not previously stored; revenue for those older orders is therefore an
estimate.

## Making it your own

After clicking **Use this template** on GitHub and creating your own repository:
1. Clone your new repository and run the quick start steps above.
2. Update the identity fields in [package.json](package.json):
   - `name` — your service name in kebab-case, e.g. `booking-service`
   - `description` — one line describing what your service does
   - `author` and `license`
   - `version` — reset to `0.1.0` if you prefer to start fresh
3. Replace this README with documentation for your own service.
4. Update `PORT` in [.env.example](.env.example) if your service should default to a different port, and keep it in sync with your own `.env`.
5. Delete or replace the sample `/health` route once you have real endpoints — though keeping a health check is good practice for deployments.

Never commit your `.env` file. It is already listed in [.gitignore](.gitignore); `.env.example` is the committed template that documents which variables are needed.

## Scripts

| Script                                                                                 | Command                      | What it does                                                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`                                                                          | `tsx watch src/index.ts`     | Runs the service from TypeScript source and restarts on file changes. Use this while developing. |
| `npm run typecheck`                                                                    | `tsc`                        | Checks types without emitting files.                                                             |
| `npm run build`                                                                        | `tsc` then `esbuild`         | Type-checks, then bundles the service into `dist/index.js` for production.                       |
| `npm run lint`                                                                         | `oxlint --deny-warnings src` | Checks TypeScript source; warnings fail the command.                                             |
| `npm run format`                                                                       | `prettier --check src`       | Checks source formatting without rewriting files; fails on differences.                          |
| `npm run format:fix`                                                                   | `prettier --write src`       | Applies the configured source formatting locally.                                                |
| `npm test`                                                                             | `vitest run`                 | Runs tests once with Vitest and exits on completion.                                             |
| `npm run prepare`                                                                      | `node .husky/install.mjs`    | Installs Git hooks after development dependency installs; skips production, CI, and `HUSKY=0`.   |
| `npm start`                                                                            | `node dist/index.js`         | Runs the built output. Requires `npm run build` first.                                           |
| Before pushing, run `npm run build`, `npm run format`, `npm run lint`, and `npm test`. |

Husky runs build, lint, and tests before each commit. If any command fails, the
commit stops. GitHub Actions runs the same checks independently because local
hooks can be bypassed. CI sets `HUSKY=0` to skip installing local Git hooks.
Production installs with `npm ci --omit=dev` skip Husky before loading it, so
they do not require development dependencies.

## Continuous integration and required checks

[The CI workflow](.github/workflows/ci.yml) runs on pull requests when opened,
reopened, or updated, and on pushes to `main` or `master`, including merges.
It uses Node 22, installs locked dependencies with `npm ci`, then runs build,
formatting, lint, and tests in order. Any failure fails the job; later steps do not hide it.

The workflow alone does not block merging. An administrator must configure
the following in **both the backend and frontend GitHub repositories**:
1. Push the workflow branch and open a pull request so GitHub records the
   **Build, lint and test** check.
2. In **Settings > Branches**, add or edit a branch protection rule for `main`.
   Repeat for `master` if that branch exists or is used.
3. Enable **Require a pull request before merging** and **Require status checks
  to pass before merging**. Select **Build, lint and test** from GitHub Actions.
4. Enable **Require branches to be up to date before merging** and **Do not allow
  bypassing the above settings**, including administrators. Do not allow force
   pushes or branch deletion. Save the rule.
5. Verify that a pull request with a failing check cannot merge, then fix the
   failure and confirm that the check passes.

These repository settings must be applied on GitHub; committing YAML cannot
enable branch protection. A failure after merge cannot undo that merge, which
is why the pull-request check must be required beforehand.

## Project structure

```
.
├── src/
│   ├── index.ts          # entry point: config, server startup, shutdown
│   └── app.ts            # builds the Express app and registers routes
├── .env                  # your local secrets and config (not committed)
├── .env.example          # template listing required env variables
├── .github/              # GitHub configuration
├── .gitignore            # files git should ignore
├── .npmrc                # pins the public npm registry for this project
├── .nvmrc                # the Node version this project uses
├── package.json          # project metadata, scripts and dependencies
├── package-lock.json     # exact dependency versions, committed
└── tsconfig.json         # TypeScript compiler and type-checking options
```

Generated folders — `node_modules/` and `dist/` — are ignored by git and safe to delete and regenerate.

### Why `app.ts` and `index.ts` are separate

[src/app.ts](src/app.ts) creates and configures the Express app but never starts listening. [src/index.ts](src/index.ts) reads configuration and starts the server. Keeping those responsibilities separate makes route registration independent from server startup.

## Adding a new route

Say you want a `GET /bookings` endpoint.

**1. Create the router** in `src/controllers/bookings.ts`:

```ts
import { Router, type Request, type Response } from 'express';

export const bookingsRouter = Router();

bookingsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ bookings: [] });
});
```

**2. Register it** in [src/app.ts](src/app.ts):

```ts
import { bookingsRouter } from './controllers/bookings';

// inside createApp(), before `return app`
app.use('/bookings', bookingsRouter);
```

Imports do not need a `.js` extension — this project is configured for bundler-style module resolution.

**3. Verify:**

```sh
npm run typecheck
npm run build
```

If your route reads a JSON request body, add `app.use(express.json({ limit: '100kb' }))` in `createApp()` before your routes.

## Configuration

Environment variables are loaded from `.env` by [dotenv](https://github.com/motdotla/dotenv) at startup.

| Variable            | Required | Description                                                                                          |
| ------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `PORT`              | yes      | Port the service listens on. The service exits at startup if it is missing or invalid.               |
| `JWT_ACCESS_SECRET` | yes      | Secret for signing access tokens (at least 32 bytes). The service exits at startup if it is missing. |

The server binds to `0.0.0.0` so it is reachable from outside a container. Add new variables to both your `.env` and [.env.example](.env.example).

## Password reset

Set `FRONTEND_URL` to the frontend origin where the `/reset_password` page is hosted.
Apply the password-reset token table migration with `npx prisma migrate dev` locally
or `npx prisma migrate deploy` in deployed environments.

`POST /forgot-password` accepts `{ "email": "customer@example.com" }`. For an
existing account, the service emails a link containing the email and a
single-use token that expires after 15 minutes. Only the token hash is stored.
The frontend should prefill its email field from the `email` query parameter
and submit the form to `POST /reset-password` with
`{ "email": "...", "token": "...", "password": "..." }`. The service hashes the
new password before updating the customer record.

## Authentication

This API is called **server-to-server** by the server-rendered frontend, never directly by the browser. Tokens are therefore exchanged in JSON bodies; the backend sets **no cookies**. The frontend stores the tokens in its own `HttpOnly`, `SameSite=Lax` (and `Secure` in production) cookies for the browser.

| Endpoint                 | Request body                                 | Success response                                                                                 |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /login`            | `{ email, password }`                        | `200` `{ message, customer, accessToken, tokenType, expiresIn, refreshToken, refreshExpiresAt }` |
| `POST /auth/refresh`     | `{ refreshToken }`                           | `200` `{ accessToken, tokenType, expiresIn, refreshToken, refreshExpiresAt }`                    |
| `POST /auth/logout`      | `{ refreshToken }` (optional)                | `204`                                                                                            |
| Protected routes (`/me`) | `Authorization: Bearer <accessToken>` header | Route response, or `401` if the token is missing/invalid/expired                                 |
- **Access tokens** are JWTs valid for 15 minutes (`expiresIn` seconds).
- **Refresh tokens** are opaque, valid until `refreshExpiresAt` (7 days from login, never extended) and **single-use**: every refresh returns a new one. Reusing an old token revokes the whole login session.
- Token responses are sent with `Cache-Control: no-store`.
- A browser client calling this API directly would need a different contract (refresh token in an `HttpOnly` cookie with credentialed CORS); that is intentionally not supported.

## Troubleshooting

**`Cannot find module` or unexpected type errors** — you may be on the wrong Node version. Run `nvm use`, then `rm -rf node_modules && npm ci`.

**`PORT environment variable is not set`** — you have not created your `.env`. Run `cp .env.example .env`.

**`EADDRINUSE`** — another process is already using that port. Stop it, or change `PORT` in `.env`.

**`npm start` fails with a missing file** — run `npm run build` first to generate `dist/`.
