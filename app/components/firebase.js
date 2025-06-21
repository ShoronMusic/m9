import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// クライアント用 Firebase 設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);

// Firestore のオフラインサポートを有効化
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code === "failed-precondition") {
      console.log("複数のタブが開いているため、オフラインサポートは一度に一つのタブでのみ有効になります。");
    } else if (err.code === "unimplemented") {
      console.log("このブラウザはオフラインサポートに必要な全機能をサポートしていません。");
    } else {
      console.error("Firestoreのオフラインサポートを有効にする際にエラーが発生しました:", err);
    }
  });
}

export { app, analytics, auth, provider, firestore };
