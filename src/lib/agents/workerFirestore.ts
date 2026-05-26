/**
 * Worker-safe Firebase Admin initializer.
 * Does NOT import "server-only" — this file is used by the tsx worker process
 * which runs outside the Next.js server context.
 */
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _db: Firestore | undefined;

export function getDb(): Firestore {
  if (_db) return _db;
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  _db = getFirestore();
  return _db;
}
