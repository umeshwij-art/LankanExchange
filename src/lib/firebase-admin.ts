
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !admin.apps.length ? admin.initializeApp({
  projectId: firebaseConfig.projectId,
}) : admin.app();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = admin.auth();
