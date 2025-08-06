import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// クライアント用 Firebase 設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy-app-id",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "dummy-measurement",
};

// Firebase設定が不完全な場合は初期化をスキップ
let app;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.warn('Firebase初期化エラー:', error);
  // ダミーオブジェクトを作成
  app = { name: 'dummy-app' };
}

let analytics;
if (typeof window !== "undefined" && app.name !== 'dummy-app') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics初期化エラー:', error);
    analytics = null;
  }
}

let auth, provider, firestore;
try {
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  firestore = getFirestore(app);
} catch (error) {
  console.warn('Firebase認証/データベース初期化エラー:', error);
  auth = null;
  provider = null;
  firestore = null;
}

// Firestore のオフラインサポートを有効化
if (typeof window !== "undefined" && firestore) {
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
