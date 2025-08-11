import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PUT(request, { params }) {
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
    
    // Supabaseクライアントを作成
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
    
    console.log('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Request received:', {
      params,
      cookies: cookieStore.getAll().map(c => ({ name: c.name, value: c.value.substring(0, 20) + '...' })),
      headers: Object.fromEntries(request.headers.entries())
    });
    
    const { playlistId, trackId } = params;
    
    // ユーザー認証チェック（複数の方法を試行）
    let user = null;
    let authError = null;
    
    // 1. フロントエンドセッション情報からの認証を最初に試行
    try {
      const body = await request.json().catch(() => ({}));
      console.log('DELETE - Request body:', body);
      
      if (body.session && body.session.user) {
        // Spotify IDからSupabase users テーブルのIDを取得
        const { data: supabaseUser, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('spotify_id', body.session.user.id)
          .single();
        
        if (supabaseUser && !userError) {
          user = {
            id: supabaseUser.id,
            email: body.session.user.email
          };
          console.log('DELETE - Session-based authentication successful with Supabase user ID:', supabaseUser.id);
        } else {
          console.log('DELETE - Could not find Supabase user for Spotify ID:', body.session.user.id);
        }
      }
    } catch (bodyError) {
      console.log('DELETE - Could not parse request body:', bodyError.message);
    }
    
    // 2. クッキーからの認証を試行
    if (!user) {
      try {
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
        
        const { data: cookieUser, error: cookieError } = await supabase.auth.getUser();
        if (cookieUser && !cookieError) {
          user = cookieUser;
          console.log('DELETE - Authentication via cookies successful');
        } else {
          console.log('DELETE - Cookie authentication failed:', cookieError);
        }
      } catch (cookieAuthError) {
        console.log('DELETE - Cookie authentication error:', cookieAuthError.message);
      }
    }
    
    // 3. Authorizationヘッダーからの認証を試行（JWT形式の場合のみ）
    if (!user) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log('DELETE - Attempting token-based authentication with token length:', token.length);
        
        // JWTトークンの形式チェック（3セグメント）
        if (token.split('.').length === 3) {
          console.log('DELETE - Token format appears valid (3 segments)');
          
          try {
            // トークンを使用してSupabaseクライアントを作成
            const tokenSupabase = createServerClient(
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
            
            const { data: tokenUser, error: tokenError } = await tokenSupabase.auth.getUser(token);
            
            if (tokenUser && !tokenError) {
              user = tokenUser;
              console.log('DELETE - Token authentication successful');
            } else {
              authError = tokenError;
              console.log('DELETE - Token authentication failed:', tokenError);
            }
          } catch (tokenAuthError) {
            console.log('DELETE - Token authentication error:', tokenAuthError.message);
            authError = tokenAuthError;
          }
        } else {
          console.log('DELETE - Token format invalid, segments:', token.split('.').length);
          // JWT形式でない場合はエラーとしない（Spotifyトークンの可能性）
          console.log('DELETE - Token appears to be non-JWT format (possibly Spotify token)');
        }
      } else {
        console.log('DELETE - No authorization header found');
      }
    }
    
    console.log('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Auth result:', {
      user: user ? { id: user.id, email: user.email } : null,
      authError: authError ? authError.message : null
    });
    
    if (authError || !user) {
      console.error('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Authentication failed:', authError);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // プレイリストの所有者チェック
    // プレイリストの詳細情報を取得
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('*')
      .eq('id', playlistId)
      .single();

    // プレイリスト作成者の詳細情報も取得
    let playlistOwnerDetails = null;
    if (playlist && playlist.user_id) {
      try {
        const { data: ownerUser, error: ownerError } = await supabase.auth.admin.getUserById(playlist.user_id);
        if (!ownerError && ownerUser) {
          playlistOwnerDetails = {
            id: ownerUser.user.id,
            email: ownerUser.user.email,
            created_at: ownerUser.user.created_at
          };
        }
      } catch (adminError) {
        console.log('Could not get playlist owner details:', adminError.message);
      }
    }

    console.log('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Playlist check:', {
      playlist,
      playlistError: playlistError ? playlistError.message : null,
      userId: user.id,
      playlistUserId: playlist?.user_id,
      playlistTitle: playlist?.name,
      playlistCreatedAt: playlist?.created_at,
      userEmail: user.email,
      userSessionId: user.id,
      // ユーザーIDの比較結果
      userIdsMatch: user.id === playlist?.user_id,
      userIdType: typeof user.id,
      playlistUserIdType: typeof playlist?.user_id,
      // プレイリスト作成者の詳細
      playlistOwnerDetails
    });

    if (playlistError) {
      console.error('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Playlist not found:', playlistError);
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (!playlist) {
      console.error('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Playlist is null');
      return Response.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.user_id !== user.id) {
      console.error('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Access denied:', {
        playlistError: playlistError?.message,
        playlistUserId: playlist?.user_id,
        userId: user.id,
        playlistTitle: playlist?.title,
        userEmail: user.email
      });
      return Response.json({ 
        error: 'Access denied', 
        details: 'You can only delete tracks from your own playlists',
        playlistOwner: playlist?.user_id,
        currentUser: user.id
      }, { status: 403 });
    }

    // トラックを削除
    const { error } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('id', trackId)
      .eq('playlist_id', playlistId);

    if (error) {
      console.error('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Delete error:', error);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Success:', { trackId, playlistId });
    return Response.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/playlists/[playlistId]/tracks/[trackId] - Unexpected error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}