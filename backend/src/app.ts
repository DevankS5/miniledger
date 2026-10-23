import express from 'express';
import { authRouter, requireAuth } from './auth';
import { errorHandler, HttpError } from './http';
import { loansRouter, summary } from './loans';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  // The Expo web build runs on another origin during development.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', authRouter);
  app.use('/loans', requireAuth, loansRouter);
  app.get('/summary', requireAuth, async (req, res) => res.json(await summary(req.userId!)));
  app.use(() => {
    throw new HttpError(404, 'Not found');
  });
  app.use(errorHandler);
  return app;
}
