# MiniLedger

Track money you lent to friends. Phone + OTP login, a list of loans with overdue ones highlighted, an add form, a summary card, and an optional receipt photo per loan.

- **backend/**: Node.js + TypeScript + Express + PostgreSQL
- **app/**: React Native (Expo, TypeScript). Runs on Android, iOS and web.

![MiniLedger](docs/screenshot.png)

## Run it

Requirements: Node.js 20+, PostgreSQL 14+.

### 1. Database

```bash
createdb miniledger
# or with Docker:
docker run -d --name miniledger-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=miniledger -p 5432:5432 postgres:16
```

### 2. Backend (port 4000)

```bash
cd backend
npm install
DATABASE_URL=postgres://postgres:postgres@localhost:5432/miniledger npm run dev
```

Tables are created on startup. **The OTP is mocked: it is printed in this terminal**, e.g. `[mock-otp] OTP for +919876543210 is 084627`.

### 3. App

```bash
cd app
npm install
npx expo start        # press a (Android emulator), i (iOS simulator) or w (web), or scan the QR with Expo Go
```

The app calls `http://localhost:4000` (web, iOS simulator) or `http://10.0.2.2:4000` (Android emulator). On a real phone, point it at your computer's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.5:4000 npx expo start
```

### Tests

```bash
cd backend
createdb miniledger_test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/miniledger_test npm test
npm run typecheck
```

7 tests: input validation (phone, OTP, loan fields, receipt type) and an end-to-end API flow (OTP login read from the server log, auth required, add/repay entries, summary maths, receipt upload and download). The API test empties the tables of the database it is given.

## API

All loan routes need `Authorization: Bearer <token>`. Errors are `{ "error": "readable message" }`.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/request-otp` | `{ phone }` | prints the OTP to the server log |
| POST | `/auth/verify-otp` | `{ phone, otp }` | `{ token, user }` |
| GET | `/loans` | | loans, open ones first, by due date; each has `overdue` |
| POST | `/loans` | `{ friendName, amount, dueDate: "YYYY-MM-DD", receipt?: { base64, mimeType } }` | the new loan |
| POST | `/loans/:id/repay` | | the loan with `repaidAt` set |
| GET | `/loans/:id/receipt` | | the receipt image |
| GET | `/summary` | | `{ totalLent, totalRepaid, overdueAmount }` |

```bash
curl -X POST localhost:4000/auth/request-otp -H 'Content-Type: application/json' -d '{"phone":"+919876543210"}'
curl -X POST localhost:4000/auth/verify-otp  -H 'Content-Type: application/json' -d '{"phone":"+919876543210","otp":"<from log>"}'
curl -X POST localhost:4000/loans -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"friendName":"Rohan","amount":500,"dueDate":"2026-10-20"}'
curl localhost:4000/summary -H "Authorization: Bearer $TOKEN"
```

## How it works

**Backend** (`backend/src`)

- `auth.ts`: OTPs are 6 random digits (`crypto.randomInt`), kept in memory for 5 minutes, max 5 attempts, then logged instead of sent by SMS. Verifying creates the user if new and a random 32-byte session token stored in `sessions` (30 days).
- `loans.ts`: every query is scoped to the logged-in user (`WHERE user_id = $n`), so one user can never see or repay another's loans. "Overdue" is computed by the database: not repaid and `due_date < CURRENT_DATE`. The summary is one query with `SUM(...) FILTER (WHERE ...)`. Repaying twice keeps the first `repaid_at`.
- `validation.ts`: zod schemas. Phones are normalised (`+91 98765-43210` becomes `+919876543210`); amounts must be positive with at most 2 decimals; due dates must be real calendar dates.
- `db.ts`: `NUMERIC(12,2)` for money (no float storage); `DATE` values come back as `YYYY-MM-DD` strings so time zones cannot shift a due date.
- Receipts (bonus) are sent as base64 in the same JSON request and stored as `BYTEA` (max ~3 MB).

**App** (`app/`)

- `App.tsx` switches between the login and ledger screens based on the session token.
- `LoginScreen.tsx`: phone step, then OTP step.
- `LedgerScreen.tsx`: summary card at the top, add form (with receipt picker via `expo-image-picker`), pull-to-refresh list; overdue rows get a red border and background, repaid rows are dimmed.
- `api.ts`: one small `fetch` wrapper that turns server errors into messages shown on screen.

## Trade-offs

- The token is kept in memory, so closing the app logs you out. For production: `expo-secure-store`.
- OTPs live in server memory: fine for a mock and one process; a real one would use Redis or a table plus an SMS provider, and rate-limit `request-otp`.
- Due dates are typed as `YYYY-MM-DD` (pre-filled with a week from today) to avoid a native date-picker dependency.
- `CURRENT_DATE` is the database server's date, so "overdue" follows the server's time zone.
