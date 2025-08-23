import fs from 'fs';
import path from 'path';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    console.log('🔍 Search API called');
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    console.log('🔍 Query received:', query);
    
    if (!query || query.trim() === '') {
      console.log('❌ Empty query, returning empty results');
      return Response.json({ results: [], total: 0 });
    }
    
    // 環境に応じてローカルファイルまたはリモートURLを使用
    let songsData;
    
    if (process.env.NODE_ENV === 'development') {
      // ローカル環境ではローカルファイルを使用
      const filePath = path.join(process.cwd(), 'public', 'data', 'compact-songs-minimal.json');
      console.log('📁 Reading local file from:', filePath);
      
      if (!fs.existsSync(filePath)) {
        console.error('❌ Local file not found:', filePath);
        return Response.json(
          { error: 'ローカルの検索データファイルが見つかりません' },
          { status: 500 }
        );
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      songsData = JSON.parse(fileContent);
      console.log('📊 Loaded songs data from local file, total songs:', songsData.length);
    } else {
      // 本番環境ではリモートURLを使用
      const remoteUrl = 'https://xs867261.xsrv.jp/data/data/compact-songs-minimal.json';
      console.log('📁 Fetching data from remote:', remoteUrl);
      
      try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        songsData = await response.json();
        console.log('📊 Loaded songs data from remote, total songs:', songsData.length);
      } catch (fetchError) {
        console.error('❌ Failed to fetch remote data:', fetchError);
        return Response.json(
          { error: 'リモートの検索データファイルの取得に失敗しました' },
          { status: 500 }
        );
      }
    }
    console.log('📊 Loaded songs data, total songs:', songsData.length);
    
    // 検索クエリを正規化（小文字化、ハイフンをスペースに変換、複数スペースを単一スペースに）
    const normalizedQuery = query.toLowerCase()
      .replace(/-/g, ' ')  // ハイフンをスペースに変換
      .replace(/\s+/g, ' ')  // 複数スペースを単一スペースに
      .trim();
    
    console.log('🔧 Normalized query:', normalizedQuery);
    
    // 検索実行
    const results = songsData.filter(song => {
      // アーティスト名で検索
      const artistMatch = song.artists_name && 
        song.artists_name.some(artist => {
          const normalizedArtist = artist.toLowerCase()
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return normalizedArtist.includes(normalizedQuery);
        });
      
      // タイトルで検索
      const titleMatch = song.title && 
        song.title.toLowerCase()
          .replace(/-/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .includes(normalizedQuery);
      
      // アーティスト名 + タイトルの組み合わせで検索
      const combinedMatch = song.artists_name && song.title && (() => {
        const combinedText = `${song.artists_name.join(' ')} ${song.title}`.toLowerCase()
          .replace(/-/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return combinedText.includes(normalizedQuery);
      })();
      
      return artistMatch || titleMatch || combinedMatch;
    });
    
    console.log('🔍 Search completed, found results:', results.length);
    
    // 結果を整形（最大50件まで）
    const limitedResults = results.slice(0, 50).map(song => ({
      id: song.id,
      title: song.title,
      artists_name: song.artists_name,
      url: song.url,
      spotify_track_id: song.spotify_track_id,
      ytvideoid: song.ytvideoid
    }));
    
    const response = {
      results: limitedResults,
      total: results.length,
      query: query
    };
    
    console.log('📤 Sending response with', limitedResults.length, 'results');
    
    return Response.json(response);
    
  } catch (error) {
    console.error('❌ Search API error:', error);
    return Response.json(
      { error: `検索中にエラーが発生しました: ${error.message}` },
      { status: 500 }
    );
  }
}
