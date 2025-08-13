export class PlayTracker {
  constructor(userId) {
    this.userId = userId;
    this.currentTrack = null;
    this.startTime = null;
    this.timer = null;
    this.isTracking = false;
    this.pendingRecord = null;
    this.lastRecordedTrack = null;
    this.lastRecordedTime = 0;
  }

  // スタイルIDからスタイル名を取得する関数
  getStyleName(styleId) {
    const styleMap = {
      2844: 'Pop',
      2845: 'Alternative',
      4686: 'Dance',
      2846: 'Electronica',
      2847: 'R&B',
      2848: 'Hip-Hop',
      6703: 'Rock',
      2849: 'Metal',
      2873: 'Others'
    };
    return styleMap[styleId] || 'Unknown';
  }

  // ジャンルIDからジャンル名を取得する関数
  getGenreName(genreId) {
    const genreMap = {
      2844: 'Pop',
      2845: 'Alternative',
      4686: 'Dance',
      2846: 'Electronica',
      2847: 'R&B',
      2848: 'Hip-Hop',
      6703: 'Rock',
      2849: 'Metal',
      2873: 'Others'
    };
    return genreMap[genreId] || 'Unknown';
  }

  // 楽曲データからスタイル・ジャンル情報を抽出する関数
  extractStyleAndGenreInfo(track) {
    let styleId = null;
    let styleName = 'Unknown';
    let genreId = null;
    let genreName = 'Unknown';

    // スタイル情報の取得（複数の可能性をチェック）
    if (track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
      // スタイルページのデータ構造（数値IDの配列）
      const styleIdFromArray = track.styles[0];
      if (typeof styleIdFromArray === 'number') {
        styleId = styleIdFromArray;
        styleName = this.getStyleName(styleId);
      } else if (typeof styleIdFromArray === 'object' && styleIdFromArray !== null) {
        // オブジェクト形式の場合
        styleId = styleIdFromArray.id || styleIdFromArray.term_id || null;
        styleName = styleIdFromArray.name || this.getStyleName(styleId);
      }
    } else if (track.style && Array.isArray(track.style) && track.style.length > 0) {
      const styleIdFromArray = track.style[0];
      if (typeof styleIdFromArray === 'number') {
        styleId = styleIdFromArray;
        styleName = this.getStyleName(styleId);
      } else if (typeof styleIdFromArray === 'object' && styleIdFromArray !== null) {
        styleId = styleIdFromArray.id || styleIdFromArray.term_id || null;
        styleName = styleIdFromArray.name || this.getStyleName(styleId);
      }
    } else if (track.acf?.style_id) {
      styleId = track.acf.style_id;
      styleName = this.getStyleName(styleId);
    }

    // ジャンル情報の取得（複数の可能性をチェック）
    if (track.genres && Array.isArray(track.genres) && track.genres.length > 0) {
      const genreFromArray = track.genres[0];
      if (typeof genreFromArray === 'number') {
        genreId = genreFromArray;
        genreName = this.getGenreName(genreId);
      } else if (typeof genreFromArray === 'object' && genreFromArray !== null) {
        genreId = genreFromArray.id || genreFromArray.term_id || null;
        genreName = genreFromArray.name || this.getGenreName(genreId);
      }
    } else if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
      const genreFromArray = track.genre_data[0];
      if (typeof genreFromArray === 'number') {
        genreId = genreFromArray;
        genreName = this.getGenreName(genreId);
      } else if (typeof genreFromArray === 'object' && genreFromArray !== null) {
        genreId = genreFromArray.id || genreFromArray.term_id || null;
        genreName = genreFromArray.name || this.getGenreName(genreId);
      }
    } else if (track.acf?.genre_id) {
      genreId = track.acf.genre_id;
      genreName = track.acf.genre_name || this.getGenreName(genreId);
    }

    return { styleId, styleName, genreId, genreName };
  }

  startTracking(track, songId, source) {
    // ソース情報のデバッグログ
    console.log('📊 PlayTracker - startTracking called:', {
      trackId: track?.id || track?.spotifyTrackId,
      songId,
      source,
      userId: this.userId
    });
    
    // 前の曲の記録が保留されている場合は先に処理
    if (this.pendingRecord) {
      this.processPendingRecord();
    }
    
    if (this.isTracking) {
      this.stopTracking(false);
    }

    this.currentTrack = track;
    this.startTime = Date.now();
    this.songId = songId;
    this.source = source;
    this.isTracking = true;
    
    // 定期的に再生時間を記録（30秒ごと）
    this.timer = setInterval(() => {
      this.updatePlayDuration();
    }, 30000);
  }

  stopTracking(completed = false) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    if (this.currentTrack && this.startTime && this.isTracking) {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      
      // 記録データを保留
      this.pendingRecord = {
        track: this.currentTrack,
        songId: this.songId,
        source: this.source,
        duration,
        completed
      };
      
      // 非同期で記録を実行
      this.recordPlay(duration, completed);
    }
    
    this.currentTrack = null;
    this.startTime = null;
    this.isTracking = false;
  }

  processPendingRecord() {
    if (this.pendingRecord) {
      this.pendingRecord = null;
    }
  }

  async recordPlay(duration, completed) {
    if (!this.userId) {
      return;
    }

    const currentTime = Date.now();
    const currentTrackId = this.currentTrack?.spotifyTrackId || this.currentTrack?.id;
    const currentSongId = this.songId;

    // 最後に記録した曲と同じ場合は記録しない
    if (this.lastRecordedTrack && 
        this.lastRecordedTrack.trackId === currentTrackId && 
        this.lastRecordedTrack.songId === currentSongId &&
        currentTime - this.lastRecordedTime < 60000) {
      return;
    }

    const trackData = this.pendingRecord || {
      track: this.currentTrack,
      songId: this.songId,
      source: this.source,
      duration,
      completed
    };

    if (!trackData.track) {
      return;
    }

    // 楽曲情報の抽出
    const { styleId, styleName, genreId, genreName } = this.extractStyleAndGenreInfo(trackData.track);

    // アーティスト名の取得
    let artistName = 'Unknown Artist';
    if (trackData.track.artists && Array.isArray(trackData.track.artists) && trackData.track.artists.length > 0) {
      artistName = trackData.track.artists[0].name || 'Unknown Artist';
    } else if (trackData.track.artist) {
      artistName = trackData.track.artist;
    } else if (trackData.track.acf?.artist_name) {
      artistName = trackData.track.acf.artist_name;
    }

    // 楽曲タイトルの取得
    let trackTitle = 'Unknown Title';
    if (trackData.track.title?.rendered) {
      trackTitle = trackData.track.title.rendered;
    } else if (trackData.track.title) {
      trackTitle = trackData.track.title;
    } else if (trackData.track.name) {
      trackTitle = trackData.track.name;
    }

    // お気に入りフラグの取得
    let isFavorite = false;
    if (trackData.track.acf?.is_favorite !== undefined) {
      isFavorite = trackData.track.acf.is_favorite;
    } else if (trackData.track.is_favorite !== undefined) {
      isFavorite = trackData.track.is_favorite;
    }

    // ソース情報のデバッグログ
    console.log('📊 PlayTracker - Recording play data:', {
      source: trackData.source,
      artistName,
      trackTitle,
      duration: trackData.duration
    });
    
    const playData = {
      user_id: this.userId,
      track_id: currentTrackId,
      song_id: currentSongId,
      play_duration: trackData.duration,
      completed: trackData.completed,
      source: trackData.source,
      artist_name: artistName,
      track_title: trackTitle,
      is_favorite: isFavorite,
      style_id: styleId,
      style_name: styleName,
      genre_id: genreId,
      genre_name: genreName
    };

    try {
      const response = await fetch('/api/play-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playData)
      });

      if (response.ok) {
        const responseData = await response.json();
        
        // 記録成功後、最後に記録した曲の情報を更新
        this.lastRecordedTrack = {
          trackId: currentTrackId,
          songId: currentSongId
        };
        this.lastRecordedTime = currentTime;
        
        // 記録成功後、保留データをクリア
        this.pendingRecord = null;
      } else {
        // Supabaseが設定されていない場合は警告のみ表示
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.json();
          if (data.message === 'Play history disabled') {
            return;
          }
        }
      }
    } catch (error) {
      // エラーハンドリング
    }
  }

  updatePlayDuration() {
    if (this.currentTrack && this.startTime) {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
    }
  }
}

