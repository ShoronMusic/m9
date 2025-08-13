import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/authOptions';
import { supabaseAdmin, getUserBySpotifyId, createUser, recordPlayHistory, getPlayHistory } from '../../lib/supabase';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { track_id, song_id, play_duration, completed, source, artist_name, track_title, is_favorite, style_id, style_name, genre_id, genre_name } = await request.json();
    
    console.log('Recording play history:', {
      track_id,
      song_id,
      play_duration,
      completed,
      source,
      artist_name,
      track_title,
      is_favorite,
      style_id,
      style_name,
      genre_id,
      genre_name
    });
    
    // Supabaseが設定されていない場合はスキップ
    if (!supabaseAdmin) {
      console.warn('❌ Supabase not configured, play history recording skipped');
      console.warn('❌ Supabase configuration check:', {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        supabaseAdminExists: !!supabaseAdmin
      });
      return Response.json({ 
        success: true, 
        message: 'Play history disabled',
        reason: 'Supabase not configured'
      }, { status: 200 });
    }
    
    console.log('✅ Supabase configuration check passed');
    
    // ユーザーIDを取得または作成
    const { data: user, error: userError } = await getUserBySpotifyId(session.user.id);
    
    let userId;
    if (user) {
      userId = user.id;
    } else {
      // 新規ユーザーを作成
      const { data: newUser, error: createError } = await createUser({
        spotify_id: session.user.id,
        spotify_email: session.user.email,
        spotify_display_name: session.user.name,
        spotify_image_url: session.user.image
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return Response.json({ error: 'Failed to create user' }, { status: 500 });
      }
      userId = newUser.id;
    }

    // 視聴履歴を記録
    console.log('📊 API - Attempting to record play history with data:', {
      user_id: userId,
      track_id,
      song_id,
      play_duration,
      completed,
      source,
      artist_name,
      track_title,
      is_favorite,
      style_id,
      style_name,
      genre_id,
      genre_name
    });
    
    const { error: historyError } = await recordPlayHistory({
      user_id: userId,
      track_id,
      song_id,
      play_duration,
      completed,
      source,
      artist_name,
      track_title,
      is_favorite,
      style_id,
      style_name,
      genre_id,
      genre_name
    });

    if (historyError) {
      console.error('❌ API - Error recording play history:', historyError);
      console.error('❌ API - Error details:', {
        message: historyError.message,
        details: historyError.details,
        hint: historyError.hint,
        code: historyError.code
      });
      
      // より詳細なエラー情報をログ出力
      if (historyError.code === '23505') {
        console.error('❌ API: Unique constraint violation - duplicate record');
      } else if (historyError.code === '42P01') {
        console.error('❌ API: Table does not exist');
      } else if (historyError.code === '42703') {
        console.error('❌ API: Column does not exist');
      } else if (historyError.code === '23502') {
        console.error('❌ API: Not null constraint violation');
      }
      
      return Response.json({ 
        error: 'Failed to record play history',
        details: {
          code: historyError.code,
          message: historyError.message,
          hint: historyError.hint
        }
      }, { status: 500 });
    }
    
    console.log('✅ API - Play history recorded successfully');

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabaseが設定されていない場合は空のデータを返す
    if (!supabaseAdmin) {
      console.warn('Supabase not configured, returning empty play history');
      return Response.json({ 
        playHistory: [], 
        stats: {
          totalPlayTime: 0,
          uniqueTracks: 0,
          completedTracks: 0,
          totalPlays: 0
        } 
      }, { status: 200 });
    }

    // ユーザーの視聴履歴を取得
    const { data: user, error: userError } = await getUserBySpotifyId(session.user.id);
    
    if (!user) {
      return Response.json({ playHistory: [], stats: {} }, { status: 200 });
    }

    const { data: playHistory, error } = await getPlayHistory(user.id, 50);

    if (error) {
      console.error('Error fetching play history:', error);
      return Response.json({ error: 'Failed to fetch play history' }, { status: 500 });
    }

    // デバッグ情報を追加
    console.log('Play history data:', playHistory);

    // 統計情報を計算
    const totalDuration = playHistory.reduce((sum, record) => sum + (record.play_duration || 0), 0);
    const uniqueTracks = new Set(playHistory.map(record => record.track_id)).size;
    const completedTracks = playHistory.filter(record => record.completed).length;

    const stats = {
      totalPlayTime: totalDuration,
      uniqueTracks,
      completedTracks,
      totalPlays: playHistory.length
    };

    console.log('Calculated stats:', stats);

    return Response.json({ playHistory, stats }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
