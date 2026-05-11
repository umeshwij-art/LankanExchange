
import admin from 'firebase-admin';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
