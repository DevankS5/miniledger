import { z } from 'zod';

export const phone = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?[1-9]\d{9,14}$/, 'must be a valid phone number, e.g. +919876543210'));

export const requestOtpSchema = z.object({ phone });

export const verifyOtpSchema = z.object({
  phone,
  otp: z.string().regex(/^\d{6}$/, 'must be the 6-digit code'),
});

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const loanSchema = z.object({
  friendName: z.string().trim().min(1, 'is required').max(80, 'must be at most 80 characters'),
  amount: z
    .number({ message: 'must be a number' })
    .positive('must be greater than 0')
    .max(1_000_000_000, 'is too large')
    .refine((n) => Number.isInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'can have at most 2 decimals'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
    .refine(isRealDate, 'is not a real date'),
  receipt: z
    .object({
      base64: z.string().min(1).max(4_000_000, 'receipt image must be under ~3 MB'),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    })
    .optional(),
});

export const idParam = z.object({ id: z.coerce.number().int().positive('must be a loan id') });
