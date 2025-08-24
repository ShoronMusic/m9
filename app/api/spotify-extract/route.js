export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { playlistUrl } = await request.json();

    if (!playlistUrl) {
      return Response.json(
        { error: 'プレイリストURLが必要です' },
        { status: 400 }
      );
    }

    // 環境変数から認証情報を取得
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('❌ 環境変数が設定されていません');
      return Response.json(
        { error: 'Spotify API認証情報が設定されていません。.env.localファイルを確認してください。' },
        { status: 500 }
      );
    }

    console.log('✅ 環境変数の確認完了');
    console.log('🔗 入力URL:', playlistUrl);

    // プレイリストIDを抽出（より堅牢な正規表現）
    let playlistId = null;
    
    // 複数のパターンでプレイリストIDを抽出
    const patterns = [
      /playlist\/([a-zA-Z0-9]+)/,
      /playlist\/([a-zA-Z0-9]+)\?/,
      /playlist\/([a-zA-Z0-9]+)$/
    ];
    
    for (const pattern of patterns) {
      const match = playlistUrl.match(pattern);
      if (match) {
        playlistId = match[1];
        break;
      }
    }
    
    if (!playlistId) {
      console.error('❌ プレイリストIDの抽出に失敗:', playlistUrl);
      return Response.json(
        { error: '無効なSpotifyプレイリストURLです。正しいURL形式を確認してください。' },
        { status: 400 }
      );
    }

    console.log('🎯 抽出されたプレイリストID:', playlistId);
    console.log('🔍 プレイリストIDの長さ:', playlistId.length);
    console.log('🔍 プレイリストIDの形式:', /^[a-zA-Z0-9]+$/.test(playlistId) ? '有効' : '無効');

    // アクセストークンを取得
    console.log('🔑 アクセストークンを取得中...');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    console.log('🔑 トークンレスポンス:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Spotify API認証エラー:', tokenResponse.status, errorData);
      return Response.json(
        { error: `Spotify API認証に失敗しました (${tokenResponse.status})` },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ アクセストークンを取得しました');

    // プレイリスト情報を取得
    console.log('📡 プレイリスト情報を取得中...');
    const playlistApiUrl = `https://api.spotify.com/v1/playlists/${playlistId}`;
    console.log('🌐 API URL:', playlistApiUrl);
    
    const playlistResponse = await fetch(playlistApiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Spotify-Playlist-Extractor/1.0'
      },
    });

    console.log('📡 プレイリストレスポンス:', playlistResponse.status, playlistResponse.statusText);

    if (!playlistResponse.ok) {
      const errorData = await playlistResponse.text();
      console.error('❌ プレイリスト取得エラー:', playlistResponse.status, errorData);
      console.error('🔍 詳細情報:');
      console.error('  - プレイリストID:', playlistId);
      console.error('  - API URL:', playlistApiUrl);
      console.error('  - レスポンスステータス:', playlistResponse.status);
      console.error('  - レスポンスステータステキスト:', playlistResponse.statusText);
      console.error('  - エラーレスポンス:', errorData);
      console.error('  - レスポンスヘッダー:', Object.fromEntries(playlistResponse.headers.entries()));
      
      // エラーレスポンスをJSONとして解析してみる
      try {
        const errorJson = JSON.parse(errorData);
        console.error('🔍 エラー詳細:');
        console.error('  - エラーステータス:', errorJson.error?.status);
        console.error('  - エラーメッセージ:', errorJson.error?.message);
        console.error('  - エラー詳細:', errorJson.error);
      } catch (parseError) {
        console.error('🔍 エラーレスポンスの解析に失敗:', parseError.message);
      }
      
      let errorMessage = 'プレイリストの取得に失敗しました';
      if (playlistResponse.status === 404) {
        errorMessage = `プレイリストが見つかりません (ID: ${playlistId})。URLが正しいか、プレイリストが公開されているか確認してください。`;
      } else if (playlistResponse.status === 401) {
        errorMessage = '認証に失敗しました。アクセストークンが無効です。';
      } else if (playlistResponse.status === 403) {
        errorMessage = 'アクセスが拒否されました。プレイリストが非公開の可能性があります。';
      } else if (playlistResponse.status === 429) {
        errorMessage = 'API制限に達しました。しばらく待ってから再試行してください。';
      }
      
      return Response.json(
        { error: `${errorMessage} (${playlistResponse.status})` },
        { status: playlistResponse.status }
      );
    }

    const playlistData = await playlistResponse.json();
    const playlistName = playlistData.name;
    const description = playlistData.description || '説明なし';
    const totalTracks = playlistData.tracks.total;
    
    console.log(`📋 プレイリスト: ${playlistName}`);
    console.log(`🎵 総曲数: ${totalTracks}曲`);

    // 全楽曲を取得
    console.log('📥 楽曲情報を取得中...');
    let allTracks = [];
    let offset = 0;
    const limit = 100;

    while (offset < totalTracks) {
      const tracksApiUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`;
      
      const tracksResponse = await fetch(tracksApiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Spotify-Playlist-Extractor/1.0'
        },
      });

      if (!tracksResponse.ok) {
        const errorText = await tracksResponse.text();
        console.error('❌ 楽曲取得エラー:', tracksResponse.status, errorText);
        break;
      }

      const tracksData = await tracksResponse.json();
      const tracks = tracksData.items;

      if (!tracks || tracks.length === 0) break;

      allTracks = allTracks.concat(tracks);
      offset += tracks.length;

      console.log(`📥 ${allTracks.length}/${totalTracks}曲を取得中...`);

      if (tracks.length < limit) break;
    }

    console.log(`✅ ${allTracks.length}曲の取得が完了しました`);

    // 楽曲情報を整形
    const formattedTracks = allTracks.map((item) => {
      const track = item.track;
      if (!track) return null;

      const artists = track.artists.map(artist => artist.name).join(', ');
      const title = track.name;
      const album = track.album.name;
      
      // 再生時間を分:秒形式に変換
      const durationMs = track.duration_ms;
      const durationSec = Math.floor(durationMs / 1000);
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;
      const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      return {
        artists,
        title,
        album,
        duration,
        addedAt: item.added_at
      };
    }).filter(track => track !== null);

    // 結果を返す
    const result = {
      playlistName,
      description,
      totalTracks,
      tracks: formattedTracks,
      extractTime: new Date().toLocaleString('ja-JP'),
      playlistId
    };

    console.log('🎉 プレイリストの抽出が完了しました');
    return Response.json(result);

  } catch (error) {
    console.error('❌ Spotify抽出エラー:', error);
    return Response.json(
      { error: `サーバーエラーが発生しました: ${error.message}` },
      { status: 500 }
    );
  }
}
