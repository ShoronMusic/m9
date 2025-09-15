import SpotifyProvider from "next-auth/providers/spotify";

async function refreshAccessToken(token) {
  try {
    // リフレッシュトークンが存在しない場合はエラーを返す
    if (!token.refreshToken) {
      console.error('No refresh token available');
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }
    const url = "https://accounts.spotify.com/api/token";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error('Token refresh failed:', refreshedTokens.error_description || refreshedTokens.error);
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

const SpotifyProviderFunc = SpotifyProvider.default ?? SpotifyProvider;

export const authOptions = {
  providers: [
    SpotifyProviderFunc({
      clientId: process.env.SPOTIFY_CLIENT_ID || "dummy-client-id",
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "dummy-client-secret",
      authorization: {
        params: {
          scope:
            "user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-read-currently-playing user-modify-playback-state user-read-playback-state streaming user-library-modify user-library-read",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "dummy-secret",
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: false, // デバッグログを無効化
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        console.log('New authentication, setting initial tokens');
        return {
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + account.expires_in * 1000,
          refreshToken: account.refresh_token,
          user,
        };
      }
      
      // トークンの有効期限をチェック
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }
      
      // トークンが期限切れの場合、リフレッシュを試行
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = token.user;
      session.accessToken = token.accessToken;
      session.error = token.error;
      
      // トークンエラーがある場合、セッションに反映
      if (token.error) {
        session.error = token.error;
      }
      
      return session;
    },
  },
}; 