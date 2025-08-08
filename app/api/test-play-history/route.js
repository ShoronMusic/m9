import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/authOptions';
import { supabaseAdmin, getUserBySpotifyId, createUser, recordPlayHistory } from '../../lib/supabase';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.log('Test API: No session found');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { track_id, song_id, play_duration, completed, source, artist_name, track_title } = await request.json();
    
    console.log('Test recording play history:', {
      track_id,
      song_id,
      play_duration,
      completed,
      source,
      artist_name,
      track_title,
      userId: session.user.id
    });
    
    // Supabaseが設定されていない場合はスキップ
    if (!supabaseAdmin) {
      console.warn('Test API: Supabase not configured, test play history recording skipped');
      return Response.json({ 
        success: false, 
        message: 'Play history disabled',
        reason: 'Supabase not configured'
      }, { status: 200 });
    }
    
    console.log('Test API: Supabase admin client available');
    
    // ユーザーIDを取得または作成
    const { data: user, error: userError } = await getUserBySpotifyId(session.user.id);
    
    if (userError) {
      console.error('Test API: Error getting user:', userError);
      return Response.json({ 
        success: false, 
        error: 'Failed to get user',
        details: userError.message 
      }, { status: 500 });
    }
    
    let userId;
    if (user) {
      userId = user.id;
      console.log('Test API: Found existing user:', userId);
    } else {
      // 新規ユーザーを作成
      console.log('Test API: Creating new user...');
      const { data: newUser, error: createError } = await createUser({
        spotify_id: session.user.id,
        spotify_email: session.user.email,
        spotify_display_name: session.user.name,
        spotify_image_url: session.user.image
      });

      if (createError) {
        console.error('Test API: Error creating user:', createError);
        return Response.json({ 
          success: false,
          error: 'Failed to create user', 
          details: createError.message 
        }, { status: 500 });
      }
      userId = newUser.id;
      console.log('Test API: Created new user:', userId);
    }

    // 視聴履歴を記録
    console.log('Test API: Recording play history with data:', {
      user_id: userId,
      track_id,
      song_id,
      play_duration,
      completed,
      source,
      artist_name,
      track_title
    });
    
    const { data: historyData, error: historyError } = await recordPlayHistory({
      user_id: userId,
      track_id,
      song_id,
      play_duration,
      completed,
      source,
      artist_name,
      track_title
    });

    if (historyError) {
      console.error('Test API: Error recording play history:', historyError);
      return Response.json({ 
        success: false, 
        error: 'Failed to record play history',
        details: historyError.message 
      }, { status: 500 });
    }

    console.log('Test API: Successfully recorded play history:', historyData);

    return Response.json({ 
      success: true, 
      data: historyData,
      userId: userId
    }, { status: 200 });
  } catch (error) {
    console.error('Test API Error:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
