import React, { useEffect, useState } from "react";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, provider } from "./firebase";
import Link from 'next/link';  // Linkコンポーネントをインポート

// シンプルな人のアイコンをSVGで定義します
const UserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-user"
    style={{ marginRight: '8px' }}
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

function GoogleLoginButton() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!auth) {
      console.warn('Firebase認証が利用できません');
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // console.log("onAuthStateChanged triggered:", currentUser);
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!auth || !provider) {
      console.error('Firebase認証が利用できません');
      return;
    }
    
    try {
      // console.log("Starting sign-in process...");
      await signInWithPopup(auth, provider);
      // console.log("Sign-in process initiated");
    } catch (error) {
      console.error("Error during sign-in:", error);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 10, right: 10 }}>
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UserIcon />
          {/* reeshoron部分をリンクに変更 */}
          <Link href="/mypage">
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              {user.email.split("@")[0]}
            </span>
          </Link>
        </div>
      ) : (
        <button onClick={handleLogin}>Sign in with Google</button>
      )}
    </div>
  );
}

export default GoogleLoginButton;
