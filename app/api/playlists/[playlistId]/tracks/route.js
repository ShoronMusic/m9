import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';

export async function GET(request, { params }) {
  try {
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    const { playlistId } = params;
    
    // ユーザー認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // プレイリストの所有者チェック
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('user_id, is_public')
      .eq('id', playlistId)
      .single();

    if (playlistError || (!playlist.is_public && playlist.user_id !== user.id)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // トラック一覧を取得（playlist_tracksテーブルの全フィールドを取得）
    const { data: tracks, error } = await supabase
      .from('playlist_tracks')
      .select(`
        id,
        position,
        title,
        title_slug,
        artists,
        spotify_artists,
        thumbnail_url,
        video_id,
        style_id,
        style_name,
        style_slug,
        release_date,
        added_at,
        song_id,
        track_id,
        spotify_track_id,
        genre_id,
        genre_name,
        genre_slug,
        vocal_id,
        vocal_name,
        is_favorite,
        spotify_images,
        artist_slug,
        artist_order,
        content,
        genre_data,
        style_data,
        vocal_data,
        added_by
      `)
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    // 各トラックのsong_idを使ってsongsテーブルからspotify_artistsを取得（補完として）
    const tracksWithSpotifyArtists = await Promise.all(
      tracks.map(async (track) => {
        if (track.song_id) {
          const { data: songData, error: songError } = await supabase
            .from('songs')
            .select('spotify_artists, genre_data')
            .eq('id', track.song_id)
            .single();
          
          if (!songError && songData) {
            return {
              ...track,
              // playlist_tracksのspotify_artistsを最優先、なければsongsテーブルのデータを使用
              spotify_artists: track.spotify_artists || songData.spotify_artists,
              genre_data: track.genre_data || songData.genre_data
            };
          }
        }
        return track;
      })
    );

    console.log('Tracks with spotify_artists:', tracksWithSpotifyArtists.map(t => ({
      title: t.title,
      spotify_artists: t.spotify_artists,
      genre_data: t.genre_data
    })));

    return Response.json({ tracks: tracksWithSpotifyArtists });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    console.log('=== Add Track to Existing Playlist API Called ===');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('Request body available:', request.body !== null);
    
    const { playlistId } = params;
    console.log('Playlist ID:', playlistId);
    
    // NextAuthのセッションを取得
    const session = await getServerSession(authOptions);
    console.log('Session data:', { 
      hasSession: !!session, 
      userId: session?.user?.id, 
      userEmail: session?.user?.email,
      userName: session?.user?.name 
    });
    
    if (!session || !session.user) {
      console.log('No session or user found');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service Role Keyを使用してSupabaseクライアントを作成（RLSバイパス）
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
    
    // NextAuthのセッションからSpotifyユーザーIDを取得
    const spotifyUserId = session.user.id;
    console.log('Spotify User ID:', spotifyUserId);
    
    // Supabaseでユーザーを検索
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('spotify_id', spotifyUserId)
      .single();
    
    console.log('User search result:', { supabaseUser, userError });
    
    if (userError || !supabaseUser) {
      console.error('User not found in Supabase');
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = supabaseUser.id;
    console.log('Supabase User ID:', userId);
    
    // プレイリストの存在確認と所有者チェック
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, user_id, name')
      .eq('id', playlistId)
      .single();
    
    console.log('Playlist check result:', { playlist, playlistError });
    
    if (playlistError || !playlist) {
      console.error('Playlist not found');
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }
    
    if (playlist.user_id !== userId) {
      console.error('Access denied: User does not own this playlist');
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    
    console.log('Playlist access verified:', playlist);
    
    // リクエストボディからデータを取得（1回だけ）
    console.log('=== About to parse request body ===');
    const requestBody = await request.json();
    console.log('=== Raw request body parsed ===');
    console.log('Raw requestBody type:', typeof requestBody);
    console.log('Raw requestBody:', requestBody);
    
    const { skipDuplicateCheck, ...trackData } = requestBody;
    
    console.log('=== Request Body Analysis ===');
    console.log('Full request body:', requestBody);
    console.log('skipDuplicateCheck flag:', skipDuplicateCheck);
    console.log('skipDuplicateCheck type:', typeof skipDuplicateCheck);
    console.log('skipDuplicateCheck === true:', skipDuplicateCheck === true);
    console.log('skipDuplicateCheck === "true":', skipDuplicateCheck === "true");
    console.log('Boolean(skipDuplicateCheck):', Boolean(skipDuplicateCheck));
    console.log('Extracted trackData:', trackData);

    // trackDataから必要なフィールドを抽出
    const { 
      track_id, 
      title, 
      title_slug,
      artists, 
      song_id, 
      spotify_track_id, 
      thumbnail_url, 
      video_id,
      style_id, 
      style_name, 
      style_slug,
      release_date, 
      genre_id, 
      genre_name, 
      genre_slug,
      vocal_id, 
      vocal_name, 
      is_favorite,
      spotify_images,
      spotify_artists,
      artist_slug,
      artist_order,
      content,
      // 新しい複数情報フィールド
      genre_data,
      style_data,
      vocal_data
    } = trackData;
    
    console.log('Track data received:', { 
      track_id, 
      title, 
      title_slug,
      artists, 
      song_id, 
      spotify_track_id, 
      thumbnail_url, 
      video_id,
      style_id, 
      style_name, 
      style_slug,
      release_date, 
      genre_id, 
      genre_name, 
      genre_slug,
      vocal_id, 
      vocal_name, 
      is_favorite,
      spotify_images,
      spotify_artists,
      artist_slug,
      artist_order,
      content,
      // 新しい複数情報フィールド
      genre_data,
      style_data,
      vocal_data
    });
    
    // titleがundefinedの場合は、artistsから曲名を構築
    let finalTrackName = title;
    if (!finalTrackName && artists && Array.isArray(artists)) {
      finalTrackName = artists.map(artist => artist.name).join(', ');
    }
    
    if (!track_id || !finalTrackName) {
      console.error('Missing required track data:', { track_id, finalTrackName, title, artists });
      return Response.json({ error: 'Missing required track data' }, { status: 400 });
    }
    
    // トラックが既にプレイリストに存在するかチェック（スキップフラグがtrueの場合はチェックしない）
    console.log('=== Duplicate Check Decision ===');
    console.log('skipDuplicateCheck value:', skipDuplicateCheck);
    console.log('Will skip duplicate check:', Boolean(skipDuplicateCheck));
    
    if (!Boolean(skipDuplicateCheck)) {
      console.log('Performing duplicate check...');
      const { data: existingTrack, error: checkError } = await supabase
        .from('playlist_tracks')
        .select('id, title')
        .eq('playlist_id', playlistId)
        .eq('song_id', song_id || track_id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116は「行が見つからない」エラーで、これは正常（トラックが存在しない）
        console.error('Error checking for existing track:', checkError);
        return Response.json({ 
          error: '既存トラックの確認に失敗しました',
          details: 'データベースの接続またはクエリに問題が発生しました。しばらく時間をおいて再度お試しください。'
        }, { status: 500 });
      }
      
      if (existingTrack) {
        console.log('Track already exists in playlist:', existingTrack);
        const responseData = { 
          success: false, 
          message: 'このトラックは既にプレイリストに追加されています',
          existingTrack: existingTrack
        };
        console.log('Sending 409 response:', responseData);
        return Response.json(responseData, { status: 409 }); // 409 Conflict
      }
      console.log('Duplicate check passed - track not found in playlist');
    } else {
      console.log('Skipping duplicate check for new playlist');
    }
    
    // 現在の最大positionを取得
    const { data: maxPosition, error: maxError } = await supabase
      .from('playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const newPosition = (maxPosition?.position || 0) + 1;
    console.log('New position calculated:', newPosition);
    
    // トラックの追加データを準備（データベースに存在するフィールドのみ）
    const trackInsertData = {
      playlist_id: playlistId,
      track_id: track_id,
      title: finalTrackName,
      artists: artists || null,
      position: newPosition,
      added_at: new Date().toISOString(),
      added_by: userId,
      song_id: song_id ? parseInt(song_id) : 0, // integer型に変換
      
      // メディア情報
      thumbnail_url: thumbnail_url || null,
      
      // スタイル・ジャンル・ボーカル情報（主要なもの）
      style_id: style_id || null,
      style_name: style_name || null,
      genre_id: genre_id || null,
      genre_name: genre_name || null,
      vocal_id: vocal_id || null,
      vocal_name: vocal_name || null,
      
      // 複数情報を格納する新しいフィールド
      genre_data: genre_data || null,
      style_data: style_data || null,
      vocal_data: vocal_data || null,
      
      // 日付情報
      release_date: release_date || null,
      
      // Spotify情報
      spotify_track_id: spotify_track_id || null,
      spotify_images: spotify_images || null,
      spotify_artists: spotify_artists || null,
      
      // その他の情報
      is_favorite: is_favorite || false,
      artist_order: artist_order || null,
      content: content || null
    };
   
    console.log('Track insert data for database:', trackInsertData);
    
    // トラックを追加
    const { data: trackResult, error: trackError } = await supabase
      .from('playlist_tracks')
      .insert(trackInsertData)
      .select()
      .single();
    
    if (trackError) {
      console.error('Track addition error:', trackError);
      console.error('Track insert data that caused error:', trackInsertData);
      console.error('Error details:', {
        code: trackError.code,
        message: trackError.message,
        details: trackError.details,
        hint: trackError.hint
      });
      
      // 重複キーエラーの場合は特別な処理
      if (trackError.code === '23505') {
        // skipDuplicateCheckがtrueの場合は、制約違反を無視して成功として扱う
        if (Boolean(skipDuplicateCheck)) {
          console.log('Database constraint violation (23505) but skipDuplicateCheck is true - treating as success');
          return Response.json({ 
            success: true, 
            message: 'Track already exists in playlist (constraint bypassed)',
            constraintViolation: true
          });
        } else {
          // 通常の重複エラー処理
          return Response.json({ 
            success: false, 
            message: 'このトラックは既にプレイリストに追加されています',
            error: 'トラックは既にプレイリストに存在します'
          }, { status: 409 });
        }
      }
      
      // 外部キー制約違反の場合は詳細情報を提供
      if (trackError.code === '23503') {
        return Response.json({ 
          success: false, 
          message: '外部キー制約違反が発生しました',
          error: trackError.message,
          details: '参照先のデータが存在しません',
          hint: 'ユーザーIDまたはプレイリストIDが無効です'
        }, { status: 500 });
      }
      
      // データベーススキーマエラーの場合は詳細情報を提供
      if (trackError.code === '42703') {
        return Response.json({ 
          success: false, 
          message: 'データベーススキーマエラーが発生しました',
          error: trackError.message,
          details: '存在しないフィールドが指定されています'
        }, { status: 500 });
      }
      
      // データ型エラーの場合は詳細情報を提供
      if (trackError.code === '22P02') {
        return Response.json({ 
          success: false, 
          message: 'データ型エラーが発生しました',
          error: trackError.message,
          details: '送信されたデータの型が正しくありません',
          hint: 'song_idは数値である必要があります'
        }, { status: 500 });
      }
      
      return Response.json({ 
        error: 'Failed to add track to playlist',
        details: trackError.message,
        code: trackError.code,
        hint: trackError.hint || '詳細なエラー情報がありません'
      }, { status: 500 });
    }
    
    console.log('Track added successfully:', trackResult);
    
    return Response.json({ 
      success: true, 
      track: trackResult,
      message: 'Track added to playlist successfully'
    });
    
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}