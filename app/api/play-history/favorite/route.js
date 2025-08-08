import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/authOptions';
import { supabaseAdmin, getUserBySpotifyId } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entry_id, is_favorite } = await request.json();
    
    if (!supabaseAdmin) {
      return Response.json({ 
        success: false, 
        message: 'Database not configured' 
      }, { status: 500 });
    }

    // ユーザーIDを取得
    const { data: user, error: userError } = await getUserBySpotifyId(session.user.id);
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return Response.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // お気に入り状態を更新
    const { data, error } = await supabaseAdmin
      .from('play_history')
      .update({ is_favorite: is_favorite })
      .eq('id', entry_id)
      .eq('user_id', user.id)
      .select();

    if (error) {
      console.error('Error updating favorite status:', error);
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    console.log('Favorite status updated successfully:', { entry_id, is_favorite, user_id: user.id });

    return Response.json({ 
      success: true, 
      data: data[0] 
    }, { status: 200 });

  } catch (error) {
    console.error('Favorite API Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
