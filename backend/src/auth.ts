import { randomBytes, randomInt } from 'crypto';
import { Router, type RequestHandler } from 'express';
import { pool } from './db';
import { HttpError, parse } from './http';
import { requestOtpSchema, verifyOtpSchema } from './validation';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_DAYS = 30;

// Mock OTP: kept in memory and printed to the server log instead of being sent by SMS.
const otps = new Map<string, { code: string; expires: number; attempts: number }>();

export const authRouter = Router();

authRouter.post('/request-otp', (req, res) => {
  const { phone } = parse(requestOtpSchema, req.body);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  otps.set(phone, { code, expires: Date.now() + OTP_TTL_MS, attempts: 0 });
  console.log(`[mock-otp] OTP for ${phone} is ${code}`);
  res.json({ message: 'OTP sent (check the server log)' });
});

authRouter.post('/verify-otp', async (req, res) => {
  const { phone, otp } = parse(verifyOtpSchema, req.body);
  const entry = otps.get(phone);
  if (!entry || entry.expires < Date.now()) throw new HttpError(401, 'OTP expired or not requested');
  if (++entry.attempts > MAX_ATTEMPTS) {
    otps.delete(phone);
    throw new HttpError(429, 'Too many attempts, request a new OTP');
  }
  if (entry.code !== otp) throw new HttpError(401, 'Wrong OTP');
  otps.delete(phone);

  const { rows } = await pool.query(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone RETURNING id`,
    [phone],
  );
  const token = randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))',
    [token, rows[0].id, SESSION_DAYS],
  );
  res.json({ token, user: { id: rows[0].id, phone } });
});

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Log in first');
  const { rows } = await pool.query('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()', [token]);
  if (!rows.length) throw new HttpError(401, 'Session expired, log in again');
  req.userId = rows[0].user_id;
  next();
};
