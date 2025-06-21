// app/mypage/userService.js

import { doc, setDoc, getDoc } from "firebase/firestore";
import { firestore } from "../components/firebase"; // 共通の firebase.js を利用

// ユーザー情報を保存する関数
export const saveUserProfile = async (userId, profileData) => {
  try {
    const userDocRef = doc(firestore, "users", userId);
    await setDoc(userDocRef, profileData, { merge: true }); // データをマージ
    console.log("User profile saved successfully.");
  } catch (error) {
    console.error("Error saving user profile:", error);
  }
};

// ユーザー情報を取得する関数
export const getUserProfile = async (userId) => {
  try {
    const userDocRef = doc(firestore, "users", userId);
    const docSnapshot = await getDoc(userDocRef);
    if (docSnapshot.exists()) {
      return docSnapshot.data();
    }
    console.log("No user profile found.");
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};
