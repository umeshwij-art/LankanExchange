// Small HTTP helpers shared by the Vercel functions and the local dev server.
// Handlers use Node's req/res plus the `body`/`query` fields that both
// Vercel and Express populate.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { adminAuth } from './firebaseAdmin.js';
import { OrderError } from '../shared/trading.js';

export type Req = IncomingMessage & { body?: unknown; query?: Record<string, string | string[] | undefined> };
export type Res = ServerResponse;
export type Handler = (req: Req, res: Res) => Promise<void> | void;

export function send(res: Res, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function queryParam(req: Req, key: string): string | undefined {
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === 'string') return fromQuery;
  if (Array.isArray(fromQuery)) return fromQuery[0];
  const url = new URL(req.url ?? '/', 'http://local');
  return url.searchParams.get(key) ?? undefined;
}

/** Verifies the Firebase ID token in `Authorization: Bearer …`. */
export async function requireUser(req: Req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in to trade');
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, 'Your session has expired — sign in again');
  }
}

/** For cron and maintenance endpoints. Vercel Cron sends `Bearer $CRON_SECRET`. */
export function requireCronSecret(req: Req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(500, 'CRON_SECRET is not configured');
  if (req.headers.authorization !== `Bearer ${secret}`) throw new HttpError(401, 'Unauthorized');
}

export function withErrors(methods: string[], handler: Handler): Handler {
  return async (req, res) => {
    if (!methods.includes(req.method ?? 'GET')) {
      res.setHeader('Allow', methods.join(', '));
      return send(res, 405, { error: 'Method not allowed' });
    }
    try {
      await handler(req, res);
    } catch (e) {
      if (e instanceof HttpError || e instanceof OrderError) return send(res, e.status, { error: e.message });
      console.error('[api] unhandled', e);
      return send(res, 500, { error: 'Something went wrong on our side' });
    }
  };
}

export async function readJson(req: Req): Promise<unknown> {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}
