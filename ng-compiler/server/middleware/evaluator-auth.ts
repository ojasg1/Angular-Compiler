import { Request, Response, NextFunction } from 'express';

/**
 * Optional middleware to protect reporting endpoints with an evaluator API key.
 * If EVALUATOR_API_KEY is not set in .env, all requests are allowed.
 */
export function evaluatorAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = (process.env.EVALUATOR_API_KEY || '').trim();

  // If no key is configured, allow all requests
  if (!configuredKey) {
    next();
    return;
  }

  const providedKey = req.headers['x-evaluator-key'] as string;
  if (!providedKey || providedKey !== configuredKey) {
    res.status(403).json({ error: 'Invalid or missing evaluator API key' });
    return;
  }

  next();
}
