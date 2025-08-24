export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 環境変数から認証情報を取得
    const clientId = process.env.SPOTIFY_CLIENT_ID || '';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';

    return Response.json({
      clientId,
      clientSecret,
      hasCredentials: !!(clientId && clientSecret)
    });

  } catch (error) {
    console.error('認証情報取得エラー:', error);
    return Response.json(
      { error: '認証情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
