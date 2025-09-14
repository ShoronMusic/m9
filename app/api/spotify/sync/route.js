import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { syncTuneDivePlaylistToSpotify, importSpotifyPlaylistToTuneDive, getUserSpotifyPlaylists, clearSpotifyPlaylist, detectSpotifyPlaylistChanges } from '@/lib/spotify-sync-api';

/**
 * Spotify同期APIエンドポイント
 * POST: TuneDive → Spotify同期
 * GET: 同期状態確認・Spotifyプレイリスト一覧取得
 */

export async function POST(request) {
  try {
    console.log('=== Spotify Sync API Called ===');

    // NextAuthセッションを取得
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Supabaseクライアント作成
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await request.json();
    const { action, playlistId, spotifyPlaylistId } = body;

    console.log('Sync action:', action, 'Playlist ID:', playlistId);

    // アクセストークンの取得
    const accessToken = session.accessToken;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Spotify access token not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync_to_spotify') {
      // TuneDive → Spotify同期
      if (!playlistId) {
        return new Response(JSON.stringify({ error: 'Playlist ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // プレイリスト情報を取得
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select(`
          id,
          name,
          description,
          is_public,
          user_id,
          spotify_playlist_id,
          sync_status
        `)
        .eq('id', playlistId)
        .single();

      if (playlistError || !playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ユーザー認証チェック
      const authUserId = session.user.id;
      let { data: supabaseUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .or(`spotify_id.eq.${authUserId},google_id.eq.${authUserId}`)
        .single();

      if (userError || !supabaseUser || playlist.user_id !== supabaseUser.id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // プレイリストのトラックを取得
      const { data: tracks, error: tracksError } = await supabase
        .from('playlist_tracks')
        .select(`
          id,
          position,
          title,
          artists,
          spotify_track_id,
          thumbnail_url,
          style_id,
          style_name,
          genre_id,
          genre_name,
          vocal_id,
          vocal_name,
          release_date,
          spotify_images,
          spotify_artists
        `)
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (tracksError) {
        console.error('Tracks fetch error:', tracksError);
        return new Response(JSON.stringify({ error: 'Failed to fetch playlist tracks' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log(`Found ${tracks?.length || 0} tracks in playlist`);

      // Spotify同期実行
      const syncResult = await syncTuneDivePlaylistToSpotify(
        accessToken,
        playlist,
        tracks || []
      );

      // データベースを更新
      const { error: updateError } = await supabase
        .from('playlists')
        .update({
          spotify_playlist_id: syncResult.spotify_playlist_id,
          last_synced_at: syncResult.sync_timestamp,
          sync_status: 'synced',
          spotify_snapshot_id: syncResult.spotify_snapshot_id
        })
        .eq('id', playlistId);

      if (updateError) {
        console.error('Database update error:', updateError);
        // 同期は成功したが、DB更新に失敗した場合
      }

      // 有効なトラックのspotify_track_idを更新
      if (syncResult.tracks_valid && syncResult.tracks_valid.length > 0) {
        for (const track of syncResult.tracks_valid) {
          if (track.spotify_track_id) {
            await supabase
              .from('playlist_tracks')
              .update({ spotify_track_id: track.spotify_track_id })
              .eq('id', track.id);
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Spotifyプレイリストへの同期が完了しました',
        ...syncResult
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } else if (action === 'import_existing_playlist_changes') {
      // 既存プレイリストの変更をインポート
      const { playlistId, spotifyPlaylistId } = body;

      if (!playlistId || !spotifyPlaylistId) {
        return new Response(JSON.stringify({ error: 'Playlist ID and Spotify Playlist ID are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ユーザー情報を取得
      const authUserId = session.user.id;
      let { data: supabaseUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .or(`spotify_id.eq.${authUserId},google_id.eq.${authUserId}`)
        .single();

      if (userError || !supabaseUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Spotifyプレイリストの現在の状態を取得
      console.log('=== インポート処理開始 ===');
      console.log('アクセストークン:', accessToken ? '存在' : 'なし');
      console.log('SpotifyプレイリストID:', spotifyPlaylistId);
      
      const importResult = await importSpotifyPlaylistToTuneDive(
        accessToken,
        spotifyPlaylistId
      );
      
      console.log('=== インポート処理完了 ===');
      console.log('インポート結果:', {
        tracksCount: importResult.tracks?.length || 0,
        playlistName: importResult.playlist?.name || 'なし'
      });

      // 既存のプレイリストを更新（新規作成ではなく）
      const { error: updateError } = await supabase
        .from('playlists')
        .update({
          name: importResult.playlist.name,
          description: importResult.playlist.description,
          is_public: importResult.playlist.is_public,
          spotify_snapshot_id: importResult.playlist.spotify_snapshot_id,
          last_synced_at: importResult.import_timestamp
        })
        .eq('id', playlistId);

      if (updateError) {
        console.error('Playlist update error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update playlist' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 既存のトラックを削除（デバッグログ付き）
      console.log('=== 既存トラック削除開始 ===');
      console.log('削除対象プレイリストID:', playlistId);
      
      const { error: deleteError } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('playlist_id', playlistId);

      if (deleteError) {
        console.error('Tracks delete error:', deleteError);
      } else {
        console.log('既存トラック削除完了');
      }

      // 新しいトラックを追加
      let tracksImported = 0;
      if (importResult.tracks && importResult.tracks.length > 0) {
        const tracksToInsert = importResult.tracks.map(track => ({
          playlist_id: playlistId,
          position: track.position,
          title: track.title,
          artists: track.artists, // JSON文字列として保存
          spotify_track_id: track.spotify_track_id,
          thumbnail_url: track.thumbnail_url,
          release_date: track.release_date,
          spotify_images: track.spotify_images, // JSON文字列として保存
          spotify_artists: track.spotify_artists, // JSON文字列として保存
          added_by: supabaseUser.id,
          added_at: track.added_at,
          song_id: null, // Spotifyトラックにはsong_idがないためNULL
          // メタデータ補完フィールドを追加
          genre_name: track.genre_name || null,
          genre_data: track.genre_data || null,
          vocal_name: track.vocal_name || null,
          vocal_data: track.vocal_data || null,
          style_name: track.style_name || null,
          style_id: track.style_id || null
        }));

        const { error: insertError } = await supabase
          .from('playlist_tracks')
          .insert(tracksToInsert);

        if (insertError) {
          console.error('Tracks insert error:', insertError);
          console.error('Failed tracks data:', tracksToInsert.slice(0, 2)); // 最初の2件のデータをログ出力
          
          // エラー詳細をログ出力
          if (insertError.code === '22P02') {
            console.error('PostgreSQL array literal error detected');
            console.error('This usually means the artists field expects a different format');
          }
        } else {
          tracksImported = tracksToInsert.length;
          console.log(`Successfully imported ${tracksImported} tracks`);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: '既存プレイリストの変更をインポートしました',
        playlist: {
          id: playlistId,
          name: importResult.playlist.name
        },
        tracks_imported: tracksImported
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else if (action === 'import_from_spotify') {
      // Spotify → TuneDive同期（インポート）
      if (!spotifyPlaylistId) {
        return new Response(JSON.stringify({ error: 'Spotify playlist ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ユーザー情報を取得
      const authUserId = session.user.id;
      let { data: supabaseUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .or(`spotify_id.eq.${authUserId},google_id.eq.${authUserId}`)
        .single();

      if (userError || !supabaseUser) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Spotifyプレイリストをインポート
      const importResult = await importSpotifyPlaylistToTuneDive(
        accessToken,
        spotifyPlaylistId
      );

      // TuneDiveプレイリストを作成
      const { data: newPlaylist, error: createError } = await supabase
        .from('playlists')
        .insert({
          user_id: supabaseUser.id,
          name: importResult.playlist.name,
          description: importResult.playlist.description,
          is_public: importResult.playlist.is_public,
          spotify_playlist_id: importResult.playlist.spotify_playlist_id,
          spotify_owner_id: importResult.playlist.spotify_owner_id,
          spotify_snapshot_id: importResult.playlist.spotify_snapshot_id,
          sync_status: 'imported',
          last_synced_at: importResult.import_timestamp
        })
        .select()
        .single();

      if (createError) {
        console.error('Playlist creation error:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create playlist' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // トラックを追加
      if (importResult.tracks && importResult.tracks.length > 0) {
        const tracksWithPlaylistId = importResult.tracks.map(track => ({
          ...track,
          playlist_id: newPlaylist.id,
          added_by: supabaseUser.id
        }));

        const { error: tracksError } = await supabase
          .from('playlist_tracks')
          .insert(tracksWithPlaylistId);

        if (tracksError) {
          console.error('Tracks insertion error:', tracksError);
          // プレイリストは作成されたが、トラック追加に失敗
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Spotifyプレイリストのインポートが完了しました',
        playlist: newPlaylist,
        tracks_imported: importResult.tracks?.length || 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Spotify Sync API Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Spotify同期中にエラーが発生しました',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Spotify同期状態確認・プレイリスト一覧取得
 */
export async function GET(request) {
  try {
    // NextAuthセッションを取得
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const playlistId = searchParams.get('playlistId');

    const accessToken = session.accessToken;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Spotify access token not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_spotify_playlists') {
      // ユーザーのSpotifyプレイリスト一覧を取得
      const spotifyPlaylists = await getUserSpotifyPlaylists(accessToken);
      
      return new Response(JSON.stringify({
        success: true,
        playlists: spotifyPlaylists
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else if (action === 'check_sync_status') {
      // 特定プレイリストの同期状態を確認
      if (!playlistId) {
        return new Response(JSON.stringify({ error: 'Playlist ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { data: playlist, error } = await supabase
        .from('playlists')
        .select(`
          id,
          name,
          spotify_playlist_id,
          sync_status,
          last_synced_at,
          spotify_snapshot_id
        `)
        .eq('id', playlistId)
        .single();

      if (error || !playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        playlist_id: playlistId,
        sync_status: playlist.sync_status || 'not_synced',
        spotify_playlist_id: playlist.spotify_playlist_id,
        last_synced_at: playlist.last_synced_at,
        spotify_snapshot_id: playlist.spotify_snapshot_id,
        needs_sync: playlist.sync_status !== 'synced'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else if (action === 'check_spotify_changes') {
      // Spotify側の変更検知
      if (!playlistId) {
        return new Response(JSON.stringify({ error: 'Playlist ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('id, name, spotify_playlist_id, spotify_snapshot_id, last_synced_at')
        .eq('id', playlistId)
        .single();

      if (playlistError) {
        console.error('Playlist fetch error:', playlistError);
        return new Response(JSON.stringify({ error: 'Failed to fetch playlist' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!playlist.spotify_playlist_id) {
        return new Response(JSON.stringify({ 
          hasChanges: false, 
          message: 'プレイリストがSpotifyに同期されていません' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log('=== API Route: 変更検知開始 ===');
      console.log('プレイリストID:', playlistId);
      console.log('SpotifyプレイリストID:', playlist.spotify_playlist_id);
      console.log('保存されているスナップショットID:', playlist.spotify_snapshot_id);
      console.log('最終同期日時:', playlist.last_synced_at);

      // Spotify側の変更を検知
      const changeResult = await detectSpotifyPlaylistChanges(
        accessToken,
        playlist.spotify_playlist_id,
        playlist.spotify_snapshot_id
      );

      console.log('=== API Route: 変更検知結果 ===');
      console.log('検知結果:', changeResult);

      // 初回更新が必要な場合、または変更がない場合はsnapshot_idを更新
      console.log('🔍 更新条件チェック:');
      console.log('  - needsInitialUpdate:', changeResult.needsInitialUpdate);
      console.log('  - hasChanges:', changeResult.hasChanges);
      console.log('  - playlist.spotify_snapshot_id:', playlist.spotify_snapshot_id);
      console.log('  - changeResult.currentSnapshotId:', changeResult.currentSnapshotId);
      console.log('  - snapshot_idが異なるか:', playlist.spotify_snapshot_id !== changeResult.currentSnapshotId);
      
      if ((changeResult.needsInitialUpdate && !changeResult.hasChanges) || 
          (!changeResult.hasChanges && playlist.spotify_snapshot_id !== changeResult.currentSnapshotId)) {
        console.log('✅ snapshot_id更新を実行 (変更なしの場合)');
        
        const { error: updateSnapshotError } = await supabase
          .from('playlists')
          .update({
            spotify_snapshot_id: changeResult.currentSnapshotId
          })
          .eq('id', playlistId);

        if (updateSnapshotError) {
          console.error('❌ Snapshot ID更新エラー:', updateSnapshotError);
        } else {
          console.log('✅ Snapshot ID更新完了:', changeResult.currentSnapshotId);
        }
      } else {
        console.log('❌ snapshot_id更新条件に合致しません');
      }

      return new Response(JSON.stringify({
        hasChanges: changeResult.hasChanges,
        currentSnapshotId: changeResult.currentSnapshotId,
        lastSnapshotId: changeResult.lastSnapshotId,
        playlistName: changeResult.playlistName,
        needsInitialUpdate: changeResult.needsInitialUpdate,
        message: changeResult.hasChanges ? 
          `「${changeResult.playlistName}」に変更が検出されました` : 
          changeResult.needsInitialUpdate ?
          `「${changeResult.playlistName}」の初期設定を更新しました` :
          '変更は検出されませんでした'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Spotify Sync GET API Error:', error);
    
    return new Response(JSON.stringify({
      error: '同期状態確認中にエラーが発生しました'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}