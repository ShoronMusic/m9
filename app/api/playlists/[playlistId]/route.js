import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request, { params }) {
  try {
    const { playlistId } = params;
    
    // NextAuthのセッションを取得
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
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
    
    // Supabaseでユーザーを検索
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('spotify_id', spotifyUserId)
      .single();
    
    if (userError || !supabaseUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = supabaseUser.id;

    // プレイリストが存在し、ユーザーが所有しているかチェック
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, user_id')
      .eq('id', playlistId)
      .single();

    if (playlistError || !playlist) {
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.user_id !== userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // プレイリストのトラックを先に削除
    const { error: tracksDeleteError } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId);

    if (tracksDeleteError) {
      console.error('Error deleting playlist tracks:', tracksDeleteError);
      return Response.json({ error: 'Failed to delete playlist tracks' }, { status: 500 });
    }

    // プレイリストを削除
    const { error: playlistDeleteError } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId);

    if (playlistDeleteError) {
      console.error('Error deleting playlist:', playlistDeleteError);
      return Response.json({ error: 'Failed to delete playlist' }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Playlist deleted successfully' });

  } catch (error) {
    console.error('Delete playlist error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
