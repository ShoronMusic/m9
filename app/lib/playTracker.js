export class PlayTracker {
  constructor(userId) {
    this.userId = userId;
    this.currentTrack = null;
    this.startTime = null;
    this.timer = null;
    this.isTracking = false;
    this.pendingRecord = null; // 保留中の記録データ
    this.lastRecordedTrack = null; // 最後に記録した曲の情報
    this.lastRecordedTime = 0; // 最後に記録した時刻
    
    if (process.env.NODE_ENV === 'development') {
      console.log('PlayTracker: Initialized with userId:', userId);
    }
  }

  // スタイルIDからスタイル名を取得する関数
  getStyleName(styleId) {
    const styleMap = {
      2844: 'Pop',
      2845: 'Alternative',
      4686: 'Dance',      // 正しいDance ID
      2846: 'Electronica', // 正しいElectronica ID
      2847: 'R&B',         // 正しいR&B ID
      2848: 'Hip-Hop',     // 正しいHip-Hop ID
      6703: 'Rock',        // 正しいRock ID
      2849: 'Metal',       // 正しいMetal ID
      2873: 'Others'       // 正しいOthers ID
    };
    return styleMap[styleId] || 'Unknown';
  }

  // 楽曲データからスタイル・ジャンル情報を抽出する関数
  extractStyleAndGenreInfo(track) {
    let styleId = null;
    let styleName = 'Unknown';
    let genreId = null;
    let genreName = 'Unknown';

    if (process.env.NODE_ENV === 'development') {
      console.log('PlayTracker: extractStyleAndGenreInfo - track data:', {
        trackId: track.spotifyTrackId || track.id,
        trackTitle: track.title?.rendered || track.title,
        hasStyles: !!track.styles,
        styles: track.styles,
        hasStyle: !!track.style,
        style: track.style,
        hasGenres: !!track.genres,
        genres: track.genres,
        hasGenreData: !!track.genre_data,
        genre_data: track.genre_data,
        trackKeys: Object.keys(track),
        fullTrack: track
      });
    }

    // スタイル情報の取得（複数の可能性をチェック）
    if (track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
      // スタイルページのデータ構造（数値IDの配列）
      const styleIdFromArray = track.styles[0];
      if (typeof styleIdFromArray === 'number') {
        styleId = styleIdFromArray;
        styleName = this.getStyleName(styleId);
        if (process.env.NODE_ENV === 'development') {
          console.log('PlayTracker: Found style from track.styles array:', { styleId, styleName });
        }
      } else if (typeof styleIdFromArray === 'object' && styleIdFromArray !== null) {
        // オブジェクト形式の場合
        styleId = styleIdFromArray.id || styleIdFromArray.term_id || null;
        styleName = styleIdFromArray.name || this.getStyleName(styleId);
        if (process.env.NODE_ENV === 'development') {
          console.log('PlayTracker: Found style from track.styles object:', { styleId, styleName });
        }
      }
    } else if (track.style && Array.isArray(track.style) && track.style.length > 0) {
      const styleIdFromArray = track.style[0];
      if (typeof styleIdFromArray === 'number') {
        styleId = styleIdFromArray;
        styleName = this.getStyleName(styleId);
        if (process.env.NODE_ENV === 'development') {
          console.log('PlayTracker: Found style from track.style array:', { styleId, styleName });
        }
      } else if (typeof styleIdFromArray === 'object' && styleIdFromArray !== null) {
        styleId = styleIdFromArray.id || styleIdFromArray.term_id || null;
        styleName = styleIdFromArray.name || this.getStyleName(styleId);
        if (process.env.NODE_ENV === 'development') {
          console.log('PlayTracker: Found style from track.style object:', { styleId, styleName });
        }
      }
    } else if (track.acf?.style_id) {
      styleId = track.acf.style_id;
      styleName = this.getStyleName(styleId);
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Found style from track.acf.style_id:', { styleId, styleName });
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: No style information found in track');
      }
    }

    // ジャンル情報の取得（複数の可能性をチェック）
    if (track.genre_data && Array.isArray(track.genre_data) && track.genre_data.length > 0) {
      // アーティストページではgenre_dataに詳細情報が含まれている
      const firstGenre = track.genre_data[0];
      genreId = firstGenre.term_id || null;
      genreName = firstGenre.name || 'Unknown';
    } else if (track.genres && Array.isArray(track.genres) && track.genres.length > 0) {
      const firstGenre = track.genres[0];
      genreId = firstGenre.term_id || null;
      genreName = firstGenre.name || 'Unknown';
    } else if (track.genre && Array.isArray(track.genre) && track.genre.length > 0) {
      // アーティストページではgenreが数値IDの配列
      genreId = track.genre[0];
      genreName = 'Unknown'; // ジャンル名は別途取得が必要
    } else if (track.acf?.genre_id) {
      genreId = track.acf.genre_id;
      genreName = track.acf.genre_name || 'Unknown';
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('PlayTracker: extractStyleAndGenreInfo - extracted:', {
        styleId,
        styleName,
        genreId,
        genreName
      });
    }

    return { styleId, styleName, genreId, genreName };
  }

  startTracking(track, songId, source) {
    // 前の曲の記録が保留されている場合は先に処理
    if (this.pendingRecord) {
      this.processPendingRecord();
    }
    
    if (this.isTracking) {
      console.log('PlayTracker: Already tracking, stopping previous track');
      this.stopTracking(false);
    }

    this.currentTrack = track;
    this.startTime = Date.now();
    this.songId = songId;
    this.source = source;
    this.isTracking = true;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('PlayTracker: Started tracking', {
        track: track?.title || track?.name,
        trackId: track?.spotifyTrackId || track?.id,
        songId,
        source,
        userId: this.userId,
        startTime: new Date(this.startTime).toISOString()
      });
    }
    
    // 定期的に再生時間を記録（30秒ごと）
    this.timer = setInterval(() => {
      this.updatePlayDuration();
    }, 30000);
  }

  stopTracking(completed = false) {
    console.log('PlayTracker: stopTracking called', { completed });
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('PlayTracker: Timer cleared');
    }
    
    if (this.currentTrack && this.startTime && this.isTracking) {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Stopped tracking', {
          track: this.currentTrack?.title || this.currentTrack?.name,
          duration,
          completed,
          userId: this.userId,
          endTime: new Date().toISOString()
        });
      }
      
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
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: No tracking data to record', {
          hasCurrentTrack: !!this.currentTrack,
          hasStartTime: !!this.startTime,
          isTracking: this.isTracking,
          currentTrack: this.currentTrack,
          startTime: this.startTime
        });
      }
    }
    
    this.currentTrack = null;
    this.startTime = null;
    this.isTracking = false;
  }

  processPendingRecord() {
    if (this.pendingRecord) {
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Processing pending record:', this.pendingRecord);
      }
      this.pendingRecord = null;
    }
  }

  async recordPlay(duration, completed) {
    console.log('PlayTracker: recordPlay called', { duration, completed });
    
    if (!this.userId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Cannot record play - missing userId');
      }
      return;
    }

    // 記録データを取得（保留中のデータまたは現在のデータ）
    let trackData = this.pendingRecord;
    if (!trackData && this.currentTrack) {
      trackData = {
        track: this.currentTrack,
        songId: this.songId,
        source: this.source,
        duration,
        completed
      };
    }

    if (!trackData) {
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Cannot record play - no track data available');
      }
      return;
    }

    // 重複チェック: 同じ曲が短時間で連続記録されることを防ぐ
    const currentTrackId = trackData.track.spotifyTrackId || trackData.track.id;
    const currentSongId = trackData.songId;
    const currentTime = Date.now();
    const minInterval = 5 * 60 * 1000; // 5分間隔
    
    if (this.lastRecordedTrack && 
        this.lastRecordedTrack.trackId === currentTrackId && 
        this.lastRecordedTrack.songId === currentSongId &&
        (currentTime - this.lastRecordedTime) < minInterval) {
      
      const timeDiff = (currentTime - this.lastRecordedTime) / 1000;
      console.log('PlayTracker: Duplicate record detected, skipping. Time since last record:', timeDiff, 'seconds');
      
      // 保留データをクリア
      this.pendingRecord = null;
      return;
    }

    // アーティスト名とタイトルの取得を改善
    const artistName = trackData.track.artist || 
                      trackData.track.artistName || 
                      (trackData.track.artists && trackData.track.artists.length > 0 
                        ? trackData.track.artists.map(a => a.name).join(', ')
                        : trackData.track.artists?.[0]?.name) ||
                      'Unknown Artist';
    
    const trackTitle = trackData.track.title || 
                      trackData.track.name ||
                      (typeof trackData.track.title?.rendered === 'string' ? trackData.track.title.rendered : null) ||
                      'Unknown Track';

    // Spotify APIからお気に入り情報を取得
    let isFavorite = false;
    if (trackData.track.spotifyTrackId) {
      try {
        // セッションからアクセストークンを取得
        const sessionResponse = await fetch('/api/auth/session');
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          const accessToken = sessionData?.accessToken;
          
          if (accessToken) {
            // Spotify APIでお気に入り状態を確認
            const spotifyResponse = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackData.track.spotifyTrackId}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            
            if (spotifyResponse.ok) {
              const likedArray = await spotifyResponse.json();
              isFavorite = likedArray[0] || false;
              
              if (process.env.NODE_ENV === 'development') {
                console.log('PlayTracker: Spotify favorite status:', { 
                  trackId: trackData.track.spotifyTrackId, 
                  isFavorite 
                });
              }
            }
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('PlayTracker: Error fetching Spotify favorite status:', error);
        }
      }
    }

    // スタイル・ジャンル情報を抽出
    const { styleId, styleName, genreId, genreName } = this.extractStyleAndGenreInfo(trackData.track);

    const playData = {
      track_id: trackData.track.spotifyTrackId,
      song_id: trackData.songId,
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

    if (process.env.NODE_ENV === 'development') {
      console.log('PlayTracker: Recording play data:', playData);
    }

    try {
      console.log('PlayTracker: Sending API request to /api/play-history');
      const response = await fetch('/api/play-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playData)
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: API response status:', response.status);
        console.log('PlayTracker: API response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (response.ok) {
        const responseData = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.log('PlayTracker: Recorded play history successfully', {
            artist: artistName,
            title: trackTitle,
            duration: trackData.duration,
            completed: trackData.completed,
            responseData
          });
        }
        
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
            if (process.env.NODE_ENV === 'development') {
              console.log('PlayTracker: Play history disabled (Supabase not configured)');
            }
            return;
          }
        }
        if (process.env.NODE_ENV === 'development') {
          console.error('PlayTracker: Failed to record play history', {
            status: response.status,
            statusText: response.statusText
          });
          
          // エラーレスポンスの詳細を確認
          try {
            const errorData = await response.text();
            console.error('PlayTracker: Error response body:', errorData);
          } catch (e) {
            console.error('PlayTracker: Could not read error response');
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('PlayTracker: Error recording play history:', error);
        console.error('PlayTracker: Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
    }
  }

  updatePlayDuration() {
    if (this.currentTrack && this.startTime) {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Updated duration', {
          track: this.currentTrack?.title || this.currentTrack?.name,
          duration
        });
      }
    }
  }
}
