
// src/app/playlists/[playlistId]/page.jsx
// ※このファイルはサーバーコンポーネントとして動作します


import React from "react";
import PlaylistPageClient from "./PlaylistPageClient";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin の初期化（すでに初期化済みの場合はスキップ）

console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("FIREBASE_PRIVATE_KEY exists:", !!process.env.FIREBASE_PRIVATE_KEY);
console.log("FIREBASE_DATABASE_URL:", process.env.FIREBASE_DATABASE_URL);


if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "";
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !privateKey ||
    !process.env.FIREBASE_DATABASE_URL
  ) {
    throw new Error("Firebase の環境変数が正しく設定されていません。");
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}
const firestore = getFirestore();

/**
 * generateMetadata
 * Firestore から対象プレイリストの詳細を取得し、
 * ・更新日時または作成日時から年を抽出
 * ・playlist.title が "YYYY スタイル名" の形式と仮定し、スタイル名部分を抽出
 * ・playlist.userId をもとに、Firebase Admin の auth から作成者の displayName を取得
 * これらの情報をもとに、ページタイトルを生成します。
 */
export async function generateMetadata({ params }) {
  const { playlistId } = params;
  const playlistRef = firestore.collection("playlists").doc(playlistId);
  const playlistDoc = await playlistRef.get();

  if (!playlistDoc.exists) {
    return {
      title: "Playlist not found | Music8",
      description: "プレイリストが見つかりませんでした。",
    };
  }
  const playlist = playlistDoc.data();

  // updatedAt または createdAt から年を抽出
  const timestamp = playlist.updatedAt || playlist.createdAt;
  const year = timestamp ? new Date(timestamp.seconds * 1000).getFullYear() : "Unknown Year";

  // playlist.title を "YYYY スタイル名" と仮定し、年部分を除いたスタイル名を抽出
  let styleName = "Unknown Style";
  if (playlist.title) {
    const parts = playlist.title.split(" ");
    if (parts.length > 1) {
      parts.shift(); // 年の部分を除去
      styleName = parts.join(" ");
    }
  }

  // playlist.userId をもとに、作成者の displayName を取得
  let userName = "Unknown User";
  try {
    const userRecord = await admin.auth().getUser(playlist.userId);
    userName = userRecord.displayName || "Unknown User";
  } catch (error) {
    console.error("ユーザー情報取得エラー:", error);
  }

  const pageTitle = `${year} ${styleName} (PLAYLIST by ${userName}) | Music8`;
  return {
    title: pageTitle,
    description: playlist.description || "Your curated playlist on Music8.",
  };
}

export async function generateStaticParams() {
  return [
    { playlistId: 'dummy' }
  ];
}

// クライアントコンポーネントへ playlistId を渡してレンダリング
export default function PlaylistPage({ params }) {
  return <PlaylistPageClient playlistId={params.playlistId} />;
}
