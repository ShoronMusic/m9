import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/authOptions";
import MyPageClient from "./MyPageClient";

export default async function MyPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h1>ログインが必要です</h1>
        <p>マイページを利用するにはSpotifyでログインしてください</p>
        <a 
          href="/auth/signin" 
          style={{
            padding: '12px 24px',
            backgroundColor: '#1DB954',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold'
          }}
        >
          Spotifyでログイン
        </a>
      </div>
    );
  }

  return <MyPageClient session={session} />;
}
