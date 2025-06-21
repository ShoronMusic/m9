
import admin from "firebase-admin";
import { cert } from "firebase-admin/app";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // 改行を適切に変換
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const adminFirestore = admin.firestore();
