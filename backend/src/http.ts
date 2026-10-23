import type { ErrorRequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value ?? {});
}

// Every error leaves the API as { error: "readable message" }.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: message });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body is not valid JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Body too large (receipt max ~3 MB)' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
