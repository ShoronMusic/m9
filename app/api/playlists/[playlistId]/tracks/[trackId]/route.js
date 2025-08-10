import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PUT(request, { params }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { playlistId, trackId } = params;
    
    // ユーザー認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { position } = await request.json();

    // 曲の順番を変更
    const { data: track, error } = await supabase
      .from('playlist_tracks')
      .update({ position })
      .eq('id', trackId)
      .eq('playlist_id', playlistId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    return Response.json({ track });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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
    
    const { playlistId, trackId } = params;
    
    // ユーザー認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // プレイリストの所有者チェック
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('user_id')
      .eq('id', playlistId)
      .single();

    if (playlistError || playlist.user_id !== user.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // トラックを削除
    const { error } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('id', trackId)
      .eq('playlist_id', playlistId);

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}