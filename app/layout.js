import { Inter } from "next/font/google";
import "./globals.css";
import Layout from "./components/Layout";
import AuthProvider from "./components/AuthProvider";
import { PlayerProvider } from "./components/PlayerContext";
import FooterPlayer from "./components/FooterPlayer";
import ErrorBoundary from "./components/ErrorBoundary";
import { getServerSession } from "next-auth";
import { authOptions } from "./lib/authOptions";
import MobilePlaybackMonitor from "./components/MobilePlaybackMonitor";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL('https://tunedive.com'),
  title: 'TuneDive',
  description: '音楽の深層に潜る - Spotify音源で音楽を発見し、プレイリストで繋がる',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TuneDive'
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1DB954'
}

export default async function RootLayout({ children }) {
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken || null;

  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#1DB954" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TuneDive" />
        <meta name="format-detection" content="telephone=no, email=no, address=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1DB954" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* PWA対応 */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        
        {/* フォントとスタイルシート */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        
        {/* プリロード */}
        <link rel="preconnect" href="https://api.spotify.com" />
        <link rel="preconnect" href="https://accounts.spotify.com" />
        <link rel="dns-prefetch" href="https://api.spotify.com" />
        <link rel="dns-prefetch" href="https://accounts.spotify.com" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <PlayerProvider>
              <MobilePlaybackMonitor />
              <Layout>
                {children}
              </Layout>
              <FooterPlayer />
            </PlayerProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}