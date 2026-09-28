// Firebase Admin, initialised once per serverless instance.
//
// Required env:
//   FIREBASE_SERVICE_ACCOUNT  – the service-account JSON (raw or base64)
// Optional env:
//   FIRESTORE_DATABASE_ID     – defaults to the project's named database

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const DEFAULT_DATABASE_ID = 'ai-studio-8743f2d2-2fc9-4eb7-810e-bcc34d50cd01';

function loadCredentials(): Record<string, string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const json = JSON.parse(text);
  // Env vars often mangle newlines in the private key.
  if (typeof json.private_key === 'string') json.private_key = json.private_key.replace(/\\n/g, '\n');
  return json;
}

let app: App | undefined;
let firestore: Firestore | undefined;

function getApp(): App {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({ credential: cert(loadCredentials() as never) });
  return app;
}

export function db(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getApp(), process.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID);
  }
  return firestore;
}

export function adminAuth() {
  return getAuth(getApp());
}
