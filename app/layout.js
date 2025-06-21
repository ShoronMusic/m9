import { Inter } from "next/font/google";
import "./globals.css";
import Layout from "./components/Layout";
import AuthProvider from "./components/AuthProvider";
import { PlayerProvider } from "./components/PlayerContext";
import FooterPlayer from "./components/FooterPlayer";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL('https://music8.jp'),
  title: 'Music8',
  description: 'Discover and enjoy music videos from various artists and genres on Music8.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <PlayerProvider>
            <Layout>
              {children}
            </Layout>
            <FooterPlayer />
          </PlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}