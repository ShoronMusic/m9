/**
 * Spotify Playlist Sync API Library
 * TuneDiveプレイリストとSpotifyプレイリストの同期機能
 * 
 * 既存のSupabaseテーブル構造を活用:
 * - playlists.spotify_playlist_id: SpotifyプレイリストID
 * - playlists.sync_status: 同期状態管理
 * - playlists.last_synced_at: 最終同期日時
 * - playlist_tracks.spotify_track_id: SpotifyトラックID
 */

// Spotify Web API エンドポイント
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

/**
 * Spotifyプレイリストを作成
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {string} name - プレイリスト名
 * @param {string} description - プレイリスト説明
 * @param {boolean} isPublic - 公開設定
 * @returns {Promise<Object>} 作成されたプレイリスト情報
 */
export async function createSpotifyPlaylist(accessToken, name, description = '', isPublic = false) {
  try {
    // ユーザーIDを取得
    const userResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`ユーザー情報取得失敗: ${userResponse.status}`);
    }

    const user = await userResponse.json();
    const userId = user.id;

    // プレイリスト作成
    const playlistResponse = await fetch(`${SPOTIFY_API_BASE_URL}/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        description: description,
        public: isPublic
      })
    });

    if (!playlistResponse.ok) {
      const errorData = await playlistResponse.json();
      throw new Error(`プレイリスト作成失敗: ${errorData.error?.message || 'Unknown error'}`);
    }

    const playlist = await playlistResponse.json();
    console.log('Spotifyプレイリスト作成成功:', playlist.name);
    
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      external_urls: playlist.external_urls,
      uri: playlist.uri
    };

  } catch (error) {
    console.error('Spotifyプレイリスト作成エラー:', error);
    throw error;
  }
}

/**
 * Spotifyプレイリストにトラックを追加
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {string} playlistId - SpotifyプレイリストID
 * @param {Array<string>} trackUris - 追加するトラックのURI配列
 * @param {number} position - 追加位置（オプション）
 * @returns {Promise<Object>} 追加結果
 */
export async function addTracksToSpotifyPlaylist(accessToken, playlistId, trackUris, position = null) {
  try {
    if (!trackUris || trackUris.length === 0) {
      return { added: 0, skipped: 0 };
    }

    const requestBody = {
      uris: trackUris
    };

    if (position !== null) {
      requestBody.position = position;
    }

    const response = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`トラック追加失敗: ${errorData.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log(`${trackUris.length}曲をSpotifyプレイリストに追加完了`);
    
    return {
      snapshot_id: result.snapshot_id,
      added: trackUris.length,
      skipped: 0
    };

  } catch (error) {
    console.error('Spotifyトラック追加エラー:', error);
    throw error;
  }
}

/**
 * Spotifyトラックを検索
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {string} query - 検索クエリ
 * @returns {Promise<Object>} 検索結果
 */
export async function searchSpotifyTrack(accessToken, query) {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`トラック検索失敗: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.tracks.items.length === 0) {
      return null;
    }

    const track = data.tracks.items[0];
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(artist => ({
        id: artist.id,
        name: artist.name
      })),
      album: track.album,
      external_urls: track.external_urls,
      uri: track.uri,
      preview_url: track.preview_url
    };

  } catch (error) {
    console.error('Spotifyトラック検索エラー:', error);
    throw error;
  }
}

/**
 * TuneDiveプレイリストをSpotifyに同期
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {Object} tuneDivePlaylist - TuneDiveプレイリストデータ
 * @param {Array} tracks - トラックデータ配列
 * @returns {Promise<Object>} 同期結果
 */
export async function syncTuneDivePlaylistToSpotify(accessToken, tuneDivePlaylist, tracks) {
  try {
    console.log('TuneDiveプレイリストをSpotifyに同期開始:', tuneDivePlaylist.name);

    let spotifyPlaylist;

    // 既存のSpotifyプレイリストIDがあるかチェック
    if (tuneDivePlaylist.spotify_playlist_id) {
      console.log('既存のSpotifyプレイリストを更新:', tuneDivePlaylist.spotify_playlist_id);
      // 既存プレイリストの情報を取得
      const playlistResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${tuneDivePlaylist.spotify_playlist_id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (playlistResponse.ok) {
        const existingPlaylist = await playlistResponse.json();
        spotifyPlaylist = {
          id: existingPlaylist.id,
          name: existingPlaylist.name,
          description: existingPlaylist.description,
          public: existingPlaylist.public
        };
      } else {
        console.log('既存プレイリストが見つからないため、新規作成します');
        spotifyPlaylist = null;
      }
    }

    // 新規プレイリスト作成
    if (!spotifyPlaylist) {
      spotifyPlaylist = await createSpotifyPlaylist(
        accessToken,
        tuneDivePlaylist.name,
        tuneDivePlaylist.description || `TuneDiveから同期: ${tuneDivePlaylist.name}`,
        tuneDivePlaylist.is_public
      );
    } else {
      // 既存プレイリストの場合、既存のトラックをクリア
      console.log('既存プレイリストのトラックをクリア中...');
      await clearSpotifyPlaylist(accessToken, spotifyPlaylist.id);
    }

    // トラックのSpotify URIを準備
    const trackUris = [];
    const validTracks = [];

    for (const track of tracks) {
      if (track.spotify_track_id) {
        // 既にSpotifyトラックIDがある場合
        trackUris.push(`spotify:track:${track.spotify_track_id}`);
        validTracks.push(track);
      } else {
        // SpotifyトラックIDがない場合、検索を試行
        try {
          const searchQuery = `${track.title} ${track.artists ? JSON.parse(track.artists)[0]?.name || '' : ''}`.trim();
          const spotifyTrack = await searchSpotifyTrack(accessToken, searchQuery);
          
          if (spotifyTrack) {
            trackUris.push(spotifyTrack.uri);
            validTracks.push({
              ...track,
              spotify_track_id: spotifyTrack.id
            });
          } else {
            console.log(`トラックが見つかりません: ${track.title}`);
          }
        } catch (searchError) {
          console.error(`トラック検索エラー (${track.title}):`, searchError);
        }
      }
    }

    // トラックをプレイリストに追加
    let addedTracks = 0;
    if (trackUris.length > 0) {
      const addResult = await addTracksToSpotifyPlaylist(accessToken, spotifyPlaylist.id, trackUris);
      addedTracks = addResult.added;
    }

    console.log(`同期完了: ${addedTracks}/${tracks.length}曲を追加`);

    return {
      spotify_playlist_id: spotifyPlaylist.id,
      spotify_playlist_url: spotifyPlaylist.external_urls?.spotify,
      spotify_snapshot_id: spotifyPlaylist.snapshot_id,
      tracks_added: addedTracks,
      tracks_total: tracks.length,
      tracks_valid: validTracks,
      sync_timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('TuneDiveプレイリストのSpotify同期エラー:', error);
    throw error;
  }
}

// compact-songs.jsonのキャッシュ
let compactSongsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10分（プレイリストインポート用に延長）

/**
 * compact-songs.jsonを取得（キャッシュ付き）
 * @returns {Promise<Array>} 楽曲データ配列
 */
async function getCompactSongs() {
  const now = Date.now();
  
  // キャッシュが有効な場合はそれを使用
  if (compactSongsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return compactSongsCache;
  }
  
  try {
    // 外部URLからファイルを取得
    const response = await fetch('https://xs867261.xsrv.jp/data/data/compact-songs.json');
    if (response.ok) {
      compactSongsCache = await response.json();
      cacheTimestamp = now;
      console.log('compact-songs.jsonをキャッシュに読み込みました:', compactSongsCache.length, '曲');
      return compactSongsCache;
    } else {
      console.error('compact-songs.json取得エラー:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('compact-songs.json読み込みエラー:', error);
  }
  
  return [];
}

/**
 * SpotifyトラックIDでTuneDiveデータを検索
 * @param {string} spotifyTrackId - SpotifyトラックID
 * @returns {Promise<Object|null>} TuneDiveトラックデータ
 */
async function searchTuneDiveTrackBySpotifyId(spotifyTrackId) {
  try {
    // 方法1: データベース検索（Supabase）
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: trackData, error } = await supabase
        .from('songs')
        .select('*')
        .eq('spotify_track_id', spotifyTrackId)
        .single();
      
      if (!error && trackData) {
        console.log('データベースからデータが見つかりました:', trackData.title);
        return trackData;
      }
    }

    // 方法2: compact-songs.jsonから検索
    try {
      const allSongs = await getCompactSongs();
      const foundSong = allSongs.find(song => song.spotifyTrackId === spotifyTrackId);
      if (foundSong) {
        console.log('compact-songs.jsonからデータが見つかりました:', foundSong.title);
        return {
          genre_name: foundSong.genres?.[0]?.name || null,
          genre_data: foundSong.genres ? JSON.stringify(foundSong.genres) : null,
          vocal_name: foundSong.vocals?.[0]?.name || null,
          vocal_data: foundSong.vocals ? JSON.stringify(foundSong.vocals) : null,
          style_name: foundSong.style_name || null,
          style_id: foundSong.style_id || null
        };
      }
    } catch (jsonError) {
      console.log('compact-songs.json検索エラー:', jsonError);
    }

    return null;
  } catch (error) {
    console.error('TuneDiveデータ検索エラー:', error);
    return null;
  }
}

/**
 * SpotifyプレイリストをTuneDiveにインポート
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {string} spotifyPlaylistId - SpotifyプレイリストID
 * @returns {Promise<Object>} インポート結果
 */
export async function importSpotifyPlaylistToTuneDive(accessToken, spotifyPlaylistId) {
  try {
    console.log('SpotifyプレイリストをTuneDiveにインポート開始:', spotifyPlaylistId);

    // Spotifyプレイリスト情報を取得
    const playlistResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${spotifyPlaylistId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!playlistResponse.ok) {
      throw new Error(`Spotifyプレイリスト取得失敗: ${playlistResponse.status}`);
    }

    const spotifyPlaylist = await playlistResponse.json();

    // プレイリストのトラックを取得
    const tracksResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${spotifyPlaylistId}/tracks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!tracksResponse.ok) {
      throw new Error(`Spotifyトラック取得失敗: ${tracksResponse.status}`);
    }

    const tracksData = await tracksResponse.json();

    console.log('=== Spotifyトラック取得デバッグ ===');
    console.log('SpotifyプレイリストID:', spotifyPlaylistId);
    console.log('取得したトラック数:', tracksData.items?.length || 0);
    console.log('tracksData.items:', tracksData.items?.slice(0, 2)); // 最初の2件をログ出力

    // TuneDive形式に変換（メタデータ補完付き）
    let metadataEnrichedCount = 0;
    let totalTracksCount = tracksData.items.length;
    
    const importedTracks = await Promise.all(tracksData.items.map(async (item, index) => {
      // 基本的な情報を設定
      const baseTrack = {
        position: index + 1,
        title: item.track.name,
        artists: JSON.stringify(item.track.artists.map(artist => ({
          id: artist.id,
          name: artist.name
        }))),
        spotify_track_id: item.track.id,
        spotify_images: JSON.stringify(item.track.album.images),
        spotify_artists: JSON.stringify(item.track.artists.map(artist => artist.name)),
        thumbnail_url: item.track.album.images[0]?.url || null,
        release_date: item.track.album.release_date || null,
        added_at: new Date().toISOString()
      };

      // SpotifyトラックIDでTuneDiveデータを検索
      try {
        console.log(`=== メタデータ補完開始: ${item.track.name} ===`);
        console.log('SpotifyトラックID:', item.track.id);
        
        const tuneDiveData = await searchTuneDiveTrackBySpotifyId(item.track.id);
        if (tuneDiveData) {
          console.log('✅ TuneDiveデータが見つかりました:', tuneDiveData);
          const enrichedTrack = {
            ...baseTrack,
            genre_name: tuneDiveData.genre_name || null,
            genre_data: tuneDiveData.genre_data || null,
            vocal_name: tuneDiveData.vocal_name || null,
            vocal_data: tuneDiveData.vocal_data || null,
            style_name: tuneDiveData.style_name || null,
            style_id: tuneDiveData.style_id || null
          };
          console.log('✅ メタデータ補完完了:', {
            genre_name: enrichedTrack.genre_name,
            vocal_name: enrichedTrack.vocal_name,
            style_name: enrichedTrack.style_name
          });
          metadataEnrichedCount++;
          return enrichedTrack;
        } else {
          console.log('❌ TuneDiveデータが見つかりませんでした');
        }
      } catch (error) {
        console.log(`❌ TuneDiveデータ検索エラー (${item.track.name}):`, error);
      }

      return baseTrack;
    }));

    console.log('=== 変換後のトラックデータ ===');
    console.log('変換されたトラック数:', importedTracks.length);
    console.log('メタデータ補完成功数:', metadataEnrichedCount);
    console.log('メタデータ補完成功率:', `${Math.round((metadataEnrichedCount / totalTracksCount) * 100)}%`);
    console.log('変換されたトラック例:', importedTracks.slice(0, 2));
    console.log('=== デバッグ情報終了 ===');

    return {
      playlist: {
        name: spotifyPlaylist.name,
        description: spotifyPlaylist.description,
        is_public: spotifyPlaylist.public,
        spotify_playlist_id: spotifyPlaylist.id,
        spotify_owner_id: spotifyPlaylist.owner.id,
        spotify_snapshot_id: spotifyPlaylist.snapshot_id
      },
      tracks: importedTracks,
      import_timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('SpotifyプレイリストのTuneDiveインポートエラー:', error);
    throw error;
  }
}

/**
 * Spotifyプレイリストの変更を検知
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {string} spotifyPlaylistId - SpotifyプレイリストID
 * @param {string} lastSnapshotId - 前回のスナップショットID
 * @returns {Promise<Object>} 変更検知結果
 */
export async function detectSpotifyPlaylistChanges(accessToken, spotifyPlaylistId, lastSnapshotId) {
  try {
    console.log('Spotifyプレイリストの変更検知開始:', spotifyPlaylistId);

    // Spotifyプレイリストの現在の情報を取得
    const playlistResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${spotifyPlaylistId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!playlistResponse.ok) {
      throw new Error(`Spotifyプレイリスト取得失敗: ${playlistResponse.status}`);
    }

    const playlistData = await playlistResponse.json();
    const currentSnapshotId = playlistData.snapshot_id;

    // スナップショットIDを比較（より適切な処理）
    // lastSnapshotIdが無効な値の場合は変更なしと判定
    const isValidLastSnapshot = lastSnapshotId && 
                               lastSnapshotId !== 'initial' && 
                               lastSnapshotId !== null && 
                               lastSnapshotId !== undefined;
    
    // 変更検知ロジックを修正：実際にSpotifyで変更があった場合のみtrue
    // 現在は常にfalseを返すようにして、誤検知を防ぐ
    const hasChanges = false; // 一時的に変更検知を無効化

    console.log('=== Spotify変更検知デバッグ情報 ===');
    console.log('SpotifyプレイリストID:', spotifyPlaylistId);
    console.log('現在のスナップショットID:', currentSnapshotId, '(Type:', typeof currentSnapshotId, ')');
    console.log('保存されているスナップショットID:', lastSnapshotId, '(Type:', typeof lastSnapshotId, ')');
    console.log('有効なlastSnapshotIdか:', isValidLastSnapshot);
    console.log('スナップショットID比較結果:', hasChanges);
    console.log('プレイリスト名:', playlistData.name);
    console.log('🔍 デバッグ: 比較の詳細');
    console.log('  - currentSnapshotId !== lastSnapshotId:', currentSnapshotId !== lastSnapshotId);
    console.log('  - isValidLastSnapshot:', isValidLastSnapshot);
    console.log('  - 最終的なhasChanges:', hasChanges);
    console.log('比較詳細:', {
      currentType: typeof currentSnapshotId,
      lastType: typeof lastSnapshotId,
      currentValue: JSON.stringify(currentSnapshotId),
      lastValue: JSON.stringify(lastSnapshotId),
      strictEqual: currentSnapshotId === lastSnapshotId,
      looseEqual: currentSnapshotId == lastSnapshotId
    });
    console.log('=== デバッグ情報終了 ===');

    return {
      hasChanges,
      currentSnapshotId,
      lastSnapshotId,
      playlistName: playlistData.name,
      playlistData: hasChanges ? playlistData : null,
      needsInitialUpdate: (lastSnapshotId === 'initial' || lastSnapshotId === null || lastSnapshotId === undefined)
    };

  } catch (error) {
    console.error('Spotifyプレイリスト変更検知エラー:', error);
    throw error;
  }
}

/**
 * Spotifyプレイリストからすべてのトラックを削除
 * @param {string} accessToken - Spotifyアクセストークン
 * @param {string} playlistId - SpotifyプレイリストID
 * @returns {Promise<Object>} 削除結果
 */
export async function clearSpotifyPlaylist(accessToken, playlistId) {
  try {
    // プレイリストの全トラックを取得
    const tracksResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!tracksResponse.ok) {
      throw new Error(`プレイリストトラック取得失敗: ${tracksResponse.status}`);
    }

    const tracksData = await tracksResponse.json();
    
    if (!tracksData.items || tracksData.items.length === 0) {
      console.log('プレイリストは既に空です');
      return { cleared: 0 };
    }

    // 削除用のURI配列を作成
    const trackUris = tracksData.items.map(item => ({
      uri: item.track.uri
    }));

    // トラックを削除
    const deleteResponse = await fetch(`${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tracks: trackUris
      })
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(`トラック削除失敗: ${errorData.error?.message || 'Unknown error'}`);
    }

    const result = await deleteResponse.json();
    console.log(`${tracksData.items.length}曲をプレイリストから削除完了`);
    
    return {
      snapshot_id: result.snapshot_id,
      cleared: tracksData.items.length
    };

  } catch (error) {
    console.error('Spotifyプレイリストクリアエラー:', error);
    throw error;
  }
}

/**
 * ユーザーのSpotifyプレイリスト一覧を取得
 * @param {string} accessToken - Spotifyアクセストークン
 * @returns {Promise<Array>} プレイリスト一覧
 */
export async function getUserSpotifyPlaylists(accessToken) {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/playlists?limit=50`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotifyプレイリスト一覧取得失敗: ${response.status}`);
    }

    const data = await response.json();
    
    return data.items.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      external_urls: playlist.external_urls,
      owner: playlist.owner,
      images: playlist.images
    }));

  } catch (error) {
    console.error('Spotifyプレイリスト一覧取得エラー:', error);
    throw error;
  }
}
