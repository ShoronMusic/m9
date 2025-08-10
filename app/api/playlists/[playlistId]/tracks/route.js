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

    // トラック一覧を取得
    const { data: tracks, error } = await supabase
      .from('playlist_tracks')
      .select(`
        id,
        position,
        title,
        artists,
        thumbnail_url,
        style_id,
        style_name,
        release_date,
        added_at,
        song_id,
        track_id
      `)
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    return Response.json({ tracks });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    console.log('=== Add Track to Existing Playlist API Called ===');
    
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
    
    // リクエストボディからデータを取得
    const { track_id, track_name, artists, song_id } = await request.json();
    
    console.log('Track data:', { track_id, track_name, artists, song_id });
    
    // track_nameがundefinedの場合は、artistsから曲名を構築
    let finalTrackName = track_name;
    if (!finalTrackName && artists && Array.isArray(artists)) {
      finalTrackName = artists.map(artist => artist.name).join(', ');
    }
    
    if (!track_id || !finalTrackName) {
      console.error('Missing required track data');
      return Response.json({ error: 'Missing required track data' }, { status: 400 });
    }
    
    // トラックが既にプレイリストに存在するかチェック
    const { data: existingTrack, error: checkError } = await supabase
      .from('playlist_tracks')
      .select('id, title')
      .eq('playlist_id', playlistId)
      .eq('song_id', song_id || track_id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116は「行が見つからない」エラーで、これは正常（トラックが存在しない）
      console.error('Error checking for existing track:', checkError);
      return Response.json({ error: 'Failed to check for existing track' }, { status: 500 });
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
    
    // トラックの追加データを準備
    const trackInsertData = {
      playlist_id: playlistId,
      track_id: track_id,
      title: finalTrackName,
      artists: artists || null,
      position: newPosition,
      added_at: new Date().toISOString(),
      added_by: userId,
      song_id: song_id || track_id
    };
    
    console.log('Track insert data:', trackInsertData);
    
    // トラックを追加
    const { data: trackResult, error: trackError } = await supabase
      .from('playlist_tracks')
      .insert(trackInsertData)
      .select()
      .single();
    
    if (trackError) {
      console.error('Track addition error:', trackError);
      
      // 重複キーエラーの場合は特別な処理
      if (trackError.code === '23505') {
        return Response.json({ 
          success: false, 
          message: 'このトラックは既にプレイリストに追加されています',
          error: 'Track already exists in playlist'
        }, { status: 409 });
      }
      
      return Response.json({ error: 'Failed to add track to playlist' }, { status: 500 });
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