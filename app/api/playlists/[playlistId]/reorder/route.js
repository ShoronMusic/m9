import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/authOptions';

export async function PUT(request, { params }) {
  try {
    const { playlistId } = params;
    const { trackOrder } = await request.json();

    // セッションを取得
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    // Supabaseクライアントを作成
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // プレイリストの所有者を確認
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('user_id')
      .eq('id', playlistId)
      .single();

    if (playlistError || !playlist) {
      return NextResponse.json({ error: 'プレイリストが見つかりません' }, { status: 404 });
    }

    if (playlist.user_id !== session.user.id) {
      return NextResponse.json({ error: 'このプレイリストを編集する権限がありません' }, { status: 403 });
    }

    // 各トラックの順序を更新
    const updates = trackOrder.map(({ id, position }) => ({
      id,
      position: position + 1 // 1ベースの位置に変換
    }));

    // バッチ更新を実行
    const { error: updateError } = await supabase
      .from('playlist_tracks')
      .upsert(updates, { onConflict: 'id' });

    if (updateError) {
      console.error('Track order update error:', updateError);
      return NextResponse.json({ error: '曲の順序の更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '曲の順序が更新されました' 
    });

  } catch (error) {
    console.error('Reorder tracks error:', error);
    return NextResponse.json({ 
      error: 'サーバーエラーが発生しました' 
    }, { status: 500 });
  }
}
