// Spotifyのアクセストークンを取得
async function getSpotifyToken() {
  const client_id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const client_secret = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(client_id + ':' + client_secret),
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

// 曲を検索
export async function searchSpotifyTrack(artist, title) {
  try {
    const access_token = await getSpotifyToken();
    const searchQuery = encodeURIComponent(`track:${title} artist:${artist}`);
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept-Language': 'en'
        }
      }
    );

    const data = await response.json();
    console.log('[Spotify検索] 検索結果:', data);

    if (data.tracks?.items?.length > 0) {
      const track = data.tracks.items[0];
      return {
        trackId: track.id,
        name: track.name,
        artist: track.artists[0].name,
        albumImage: track.album.images[0]?.url,
        releaseDate: track.album.release_date
      };
    }

    return null;
  } catch (error) {
    console.error('[Spotify検索] エラー:', error);
    throw new Error('Spotify APIでの検索に失敗しました');
  }
}

// トラック情報を取得
export async function getSpotifyTrackInfo(trackId) {
  try {
    const access_token = await getSpotifyToken();
    
    const [trackResponse, featuresResponse] = await Promise.all([
      fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept-Language': 'en'
        }
      }),
      fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept-Language': 'en'
        }
      })
    ]);

    const trackData = await trackResponse.json();
    const audioFeatures = await featuresResponse.json();

    return {
      track: trackData,
      features: audioFeatures
    };
  } catch (error) {
    console.error('[Spotify情報取得] エラー:', error);
    throw new Error('Spotify APIからのトラック情報取得に失敗しました');
  }
} 