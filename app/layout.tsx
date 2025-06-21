import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Music8 - TopPage",
  description: "Music8 のトップページです",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
} 