import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';

export async function GET(request, { params }) {
  try {
    const cookieStore = cookies();
    
    // NextAuthのセッションを取得
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Supabaseクライアントを作成（認証なし）
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { songId } = params;
    
    // Spotify IDからSupabaseのユーザーIDを取得
    const { data: supabaseUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('spotify_id', session.user.id)
      .single();
    
    if (userError || !supabaseUser) {
      console.error('User lookup error:', userError);
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = supabaseUser.id;
    
    // 単一クエリで効率的に検索（スケーラビリティ対応）
    const { data: tracksWithPlaylists, error: tracksError } = await supabase
      .from('playlist_tracks')
      .select(`
        id,
        title,
        position,
        playlists!inner(
          id,
          name,
          user_id,
          is_public,
          created_at,
          updated_at
        )
      `)
      .eq('song_id', songId)
      .eq('playlists.user_id', userId);
    
    if (tracksError) {
      console.error('Tracks search error:', tracksError);
      return Response.json({ 
        error: 'Failed to search tracks',
        details: tracksError.message 
      }, { status: 500 });
    }
    
    // 結果を整形してソート
    const foundPlaylists = tracksWithPlaylists?.map(track => ({
      id: track.playlists.id,
      name: track.playlists.name,
      user_id: track.playlists.user_id,
      is_public: track.playlists.is_public,
      created_at: track.playlists.created_at,
      updated_at: track.playlists.updated_at,
      track_info: {
        id: track.id,
        title: track.title,
        position: track.position
      }
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) || [];
    
    return Response.json({ 
      playlists: foundPlaylists,
      total: foundPlaylists.length,
      song_id: songId
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    return Response.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
