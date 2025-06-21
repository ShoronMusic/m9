// app/mypage/MyPageClient.js
"use client";
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../components/firebase";
import { useRouter } from "next/navigation";
import { getUserProfile, saveUserProfile } from "./userService";
import MyPageLayout from "../components/Layout";
import Tabs from "./Tabs";
import Playlists from "./Playlists";
import ScrollToTopButton from '../components/ScrollToTopButton';


export default function MyPageClient() {
  const [user, loading] = useAuthState(auth);
  const [profile, setProfile] = useState({ handleName: "", bio: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("playlists");
  const router = useRouter();

  // 未ログインの場合はトップへリダイレクト
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // プロフィール取得
  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const userProfile = await getUserProfile(user.uid);
        if (userProfile) {
          setProfile(userProfile);
        }
      }
    }
    fetchProfile();
  }, [user]);

  return (
    <MyPageLayout>
      <div
          style={{
            marginBottom: "20px",
            backgroundColor: "#e3f2fd", // 薄いブルーの背景色
            borderRadius: "10px",       // 角丸の設定（必要に応じて調整）
            padding: "20px",            // 内側の余白
            maxWidth: '900px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
        {/* ユーザー情報 */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "20px", fontWeight: "bold" }}>
            {user?.email || "Guest"} <span style={{ fontWeight: "normal" }}>My Page</span>
          </p>
          <div>
            <button 
              onClick={() => auth.signOut()}
              style={{
                background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 18px', fontWeight: 600, cursor: 'pointer', marginBottom: '10px', marginRight: '10px', transition: 'background 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#1565c0'}
              onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
            >
              Log out
            </button>
          </div>
        </div>
        {/* プロフィール表示／編集 */}
        {!isEditing ? (
          <>
            <h3 style={{ fontWeight: 700, marginBottom: '2px' }}>Handle Name</h3>
            <p style={{ marginLeft: '12px', marginBottom: '10px' }}>{profile.handleName || "Not set"}</p>
            <h3 style={{ fontWeight: 700, marginBottom: '2px' }}>Bio</h3>
            <p style={{ marginLeft: '12px' }}>{profile.bio || "Not set"}</p>
            <button 
              onClick={() => setIsEditing(true)}
              style={{
                background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 18px', fontWeight: 600, cursor: 'pointer', marginTop: '10px', transition: 'background 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#1565c0'}
              onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
            >
              Edit Profile
            </button>
          </>
        ) : (
          <>
            <h3>Edit Handle Name</h3>
            <input
              type="text"
              value={profile.handleName}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, handleName: e.target.value }))
              }
              placeholder="Enter your handle name"
              style={{ width: "100%", marginBottom: "10px" }}
            />
            <h3>Edit Bio</h3>
            <textarea
              value={profile.bio}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="Enter your bio"
              style={{ width: "100%", marginBottom: "10px" }}
            />
            <div>
              <button
                onClick={() => {
                  saveUserProfile(user.uid, profile);
                  setIsEditing(false);
                }}
                style={{ marginRight: "10px" }}
              >
                Save
              </button>
              <button onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>

      {/* タブメニュー＋プレート一体化 */}
      <div style={{ maxWidth: '900px', margin: '32px auto 0 auto' }}>
        <div style={{
          background: '#e0e7ef',
          color: '#333',
          borderRadius: '16px 16px 0 0',
          padding: '10px 36px',
          fontWeight: 700,
          fontSize: '1.2em',
          letterSpacing: '0.05em',
          boxShadow: '0 2px 8px #0001',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          Playlists
        </div>
        <div style={{
          background: '#fff',
          borderRadius: '0 0 16px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          padding: '32px 24px',
          marginBottom: '32px',
        }}>
          {activeTab === "playlists" && <Playlists />}
        </div>
      </div>
      <ScrollToTopButton />
    </MyPageLayout>
  );
}
