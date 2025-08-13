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
    if (track.style_id && track.style_name) {
      // 直接設定されたスタイル情報を最優先
      styleId = track.style_id;
      styleName = track.style_name;
      console.log('🎨 PlayTracker - Using direct style info:', { styleId, styleName });
    } else if (track.styles && Array.isArray(track.styles) && track.styles.length > 0) {
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
      console.log('🎨 PlayTracker - Using styles array:', { styleId, styleName, styles: track.styles });
    } else if (track.style && Array.isArray(track.style) && track.style.length > 0) {
      const styleIdFromArray = track.style[0];
      if (typeof styleIdFromArray === 'number') {
        styleId = styleIdFromArray;
        styleName = this.getStyleName(styleId);
      } else if (typeof styleIdFromArray === 'object' && styleIdFromArray !== null) {
        styleId = styleIdFromArray.id || styleIdFromArray.term_id || null;
        styleName = styleIdFromArray.name || this.getStyleName(styleId);
      }
      console.log('🎨 PlayTracker - Using style array:', { styleId, styleName, style: track.style });
    } else if (track.acf?.style_id) {
      styleId = track.acf.style_id;
      styleName = this.getStyleName(styleId);
      console.log('🎨 PlayTracker - Using acf style info:', { styleId, styleName });
    } else {
      console.log('🎨 PlayTracker - No style info found in track:', {
        trackKeys: track ? Object.keys(track) : [],
        style: track?.style,
        styles: track?.styles,
        style_id: track?.style_id,
        style_name: track?.style_name,
        acf: track?.acf
      });
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
    // より確実なIDの取得
    const trackId = track?.id || track?.spotifyTrackId || track?.spotify_track_id || track?.track_id;
    const finalSongId = songId || trackId || track?.song_id;
    
    // ソース情報のデバッグログ
    console.log('📊 PlayTracker - startTracking called:', {
      trackId,
      songId,
      finalSongId,
      source,
      userId: this.userId,
      trackTitle: track?.title?.rendered || track?.title,
      artistName: track?.artists?.[0]?.name || track?.artist,
      trackKeys: track ? Object.keys(track) : []
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
    this.songId = finalSongId;
    this.source = source;
    this.isTracking = true;
    this.hasRecorded = false; // 記録フラグをリセット
    
    console.log('✅ PlayTracker - Tracking started for:', {
      source,
      startTime: new Date(this.startTime).toISOString(),
      finalSongId
    });
    
    // 定期的に再生時間を記録（30秒ごと）
    this.timer = setInterval(() => {
      this.updatePlayDuration();
    }, 30000);
  }

  stopTracking(completed = false) {
    console.log('🛑 PlayTracker - stopTracking called:', {
      completed,
      hasCurrentTrack: !!this.currentTrack,
      hasStartTime: !!this.startTime,
      isTracking: this.isTracking,
      source: this.source
    });
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    if (this.currentTrack && this.startTime && this.isTracking) {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      
      console.log('📊 PlayTracker - Recording play session:', {
        duration,
        completed,
        source: this.source,
        trackTitle: this.currentTrack?.title?.rendered || this.currentTrack?.title
      });
      
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
      console.log('⚠️ PlayTracker - No valid tracking data to record');
    }
    
    this.currentTrack = null;
    this.startTime = null;
    this.isTracking = false;
    this.hasRecorded = false; // 記録フラグをリセット
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
    
    // スタイル・ジャンル情報のデバッグログ
    console.log('🎨 PlayTracker - Style/Genre extraction result:', {
      styleId,
      styleName,
      genreId,
      genreName,
      trackKeys: trackData.track ? Object.keys(trackData.track) : [],
      trackStyle: trackData.track?.style,
      trackStyles: trackData.track?.styles,
      trackStyleId: trackData.track?.style_id,
      trackStyleName: trackData.track?.style_name
    });

    // アーティスト名の取得
    let artistName = 'Unknown Artist';
    if (trackData.track.artists && Array.isArray(trackData.track.artists) && Array.isArray(trackData.track.artists) && trackData.track.artists.length > 0) {
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

    // 非同期で記録を実行
    this.recordPlayData(playData);
  }

  // 記録データを直接処理するメソッド
  async recordPlayData(playData) {
    if (!this.userId) {
      return;
    }

    const currentTime = Date.now();
    const currentTrackId = playData.track_id || playData.song_id;

    // 最後に記録した曲と同じ場合は記録しない
    if (this.lastRecordedTrack && 
        this.lastRecordedTrack.trackId === currentTrackId && 
        this.lastRecordedTrack.songId === playData.song_id &&
        currentTime - this.lastRecordedTime < 60000) {
      console.log('⚠️ PlayTracker - Skipping duplicate record for same track');
      return;
    }

    // ソース情報のデバッグログ
    console.log('📊 PlayTracker - Recording play data directly:', {
      source: playData.source,
      artistName: playData.artist_name,
      trackTitle: playData.track_title,
      duration: playData.play_duration
    });

    try {
      console.log('📤 PlayTracker - Sending API request to /api/play-history:', {
        url: '/api/play-history',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: playData
      });
      
      // 送信データの詳細ログ
      console.log('📋 PlayTracker - Request body details:', {
        user_id: playData.user_id,
        track_id: playData.track_id,
        song_id: playData.song_id,
        play_duration: playData.play_duration,
        completed: playData.completed,
        source: playData.source,
        artist_name: playData.artist_name,
        track_title: playData.track_title,
        is_favorite: playData.is_favorite,
        style_id: playData.style_id,
        style_name: playData.style_name,
        genre_id: playData.genre_id,
        genre_name: playData.genre_name
      });
      
      // データの型チェック
      console.log('🔍 PlayTracker - Data type validation:', {
        user_id_type: typeof playData.user_id,
        track_id_type: typeof playData.track_id,
        song_id_type: typeof playData.song_id,
        play_duration_type: typeof playData.play_duration,
        completed_type: typeof playData.completed,
        source_type: typeof playData.source,
        artist_name_type: typeof playData.artist_name,
        track_title_type: typeof playData.track_title,
        is_favorite_type: typeof playData.is_favorite
      });
      
      const response = await fetch('/api/play-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playData)
      });

      console.log('📥 PlayTracker - API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        let responseData;
        try {
          responseData = await response.json();
          console.log('📄 PlayTracker - Response data:', responseData);
        } catch (e) {
          console.log('⚠️ PlayTracker - Response is not JSON:', await response.text());
          responseData = null;
        }
        
        console.log('✅ PlayTracker - Play history recorded successfully:', {
          source: playData.source,
          trackTitle: playData.track_title,
          duration: playData.play_duration,
          responseData
        });
        
        // 記録成功後、最後に記録した曲の情報を更新
        this.lastRecordedTrack = {
          trackId: currentTrackId,
          songId: playData.song_id
        };
        this.lastRecordedTime = currentTime;
        
        // 記録成功後、保留データをクリア
        this.pendingRecord = null;
      } else {
        console.log('❌ PlayTracker - API request failed with status:', response.status);
        
        // レスポンスの内容を確認
        let errorData;
        try {
          errorData = await response.text();
          console.log('📄 PlayTracker - Error response body:', errorData);
        } catch (e) {
          console.log('⚠️ PlayTracker - Could not read error response body');
        }
        
        // Supabaseが設定されていない場合は警告のみ表示
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
          try {
            const data = JSON.parse(errorData);
            if (data.message === 'Play history disabled') {
              console.log('ℹ️ PlayTracker - Play history is disabled');
              return;
            }
          } catch (e) {
            // JSONパースエラーは無視
          }
        }
        console.error('❌ PlayTracker - Failed to record play history:', response.status, errorData);
      }
    } catch (error) {
      console.error('❌ PlayTracker - Error recording play history:', error);
      console.error('❌ PlayTracker - Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }

  updatePlayDuration() {
    if (this.currentTrack && this.startTime) {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      
      // 30秒以上再生された場合のログ
      if (duration >= 30) {
        console.log('⏱️ PlayTracker - Play duration update:', {
          duration,
          source: this.source,
          trackTitle: this.currentTrack?.title?.rendered || this.currentTrack?.title,
          hasCurrentTrack: !!this.currentTrack,
          isTracking: this.isTracking
        });
        
        // 30秒以上再生された場合、自動的に記録を開始
        if (duration >= 30 && !this.hasRecorded && this.isTracking) {
          console.log('📊 PlayTracker - Auto-recording after 30 seconds:', {
            duration,
            source: this.source,
            trackTitle: this.currentTrack?.title?.rendered || this.currentTrack?.title,
            currentTrackId: this.currentTrack?.id || this.currentTrack?.spotifyTrackId
          });
          
          this.hasRecorded = true;
          
          // アーティスト名の取得を改善
          let artistName = 'Unknown Artist';
          console.log('🔍 PlayTracker - Artist extraction debug:', {
            artists: this.currentTrack?.artists,
            artist: this.currentTrack?.artist,
            acfArtistName: this.currentTrack?.acf?.artist_name,
            currentTrackKeys: this.currentTrack ? Object.keys(this.currentTrack) : []
          });
          
          if (this.currentTrack?.artists && Array.isArray(this.currentTrack.artists) && this.currentTrack.artists.length > 0) {
            const firstArtist = this.currentTrack.artists[0];
            console.log('🔍 PlayTracker - First artist data:', {
              firstArtist,
              type: typeof firstArtist,
              hasName: firstArtist?.name
            });
            
            if (typeof firstArtist === 'string') {
              try {
                const parsedArtist = JSON.parse(firstArtist);
                artistName = parsedArtist.name || firstArtist;
                console.log('✅ PlayTracker - Parsed artist from string:', parsedArtist);
              } catch (e) {
                artistName = firstArtist;
                console.log('⚠️ PlayTracker - Failed to parse artist string, using as-is:', firstArtist);
              }
            } else if (firstArtist.name) {
              artistName = firstArtist.name;
              console.log('✅ PlayTracker - Using artist object name:', firstArtist.name);
            }
          } else if (this.currentTrack?.artist) {
            artistName = this.currentTrack.artist;
            console.log('✅ PlayTracker - Using fallback artist field:', this.currentTrack.artist);
          } else if (this.currentTrack?.acf?.artist_name) {
            artistName = this.currentTrack.acf.artist_name;
            console.log('✅ PlayTracker - Using ACF artist name:', this.currentTrack.acf.artist_name);
          }
          
          console.log('🎯 PlayTracker - Final artist name:', artistName);
          
          // より確実なIDの取得
          const trackId = this.currentTrack?.spotifyTrackId || this.currentTrack?.spotify_track_id || this.currentTrack?.id || this.currentTrack?.track_id || this.songId;
          const songId = this.songId || this.currentTrack?.id || this.currentTrack?.song_id;
          
          console.log('🔍 PlayTracker - ID extraction for recording:', {
            trackId,
            songId,
            currentTrackKeys: this.currentTrack ? Object.keys(this.currentTrack) : [],
            spotifyTrackId: this.currentTrack?.spotifyTrackId,
            spotify_track_id: this.currentTrack?.spotify_track_id,
            id: this.currentTrack?.id,
            track_id: this.currentTrack?.track_id,
            song_id: this.currentTrack?.song_id
          });
          
          // スタイル・ジャンル情報の抽出
          const { styleId, styleName, genreId, genreName } = this.extractStyleAndGenreInfo(this.currentTrack);
          
          // スタイル・ジャンル情報のデバッグログ
          console.log('🎨 PlayTracker - Auto-recording style/genre extraction:', {
            styleId,
            styleName,
            genreId,
            genreName,
            currentTrackKeys: this.currentTrack ? Object.keys(this.currentTrack) : [],
            currentTrackStyle: this.currentTrack?.style,
            currentTrackStyles: this.currentTrack?.styles,
            currentTrackStyleId: this.currentTrack?.style_id,
            currentTrackStyleName: this.currentTrack?.style_name
          });
          
          // 記録データを直接作成して記録
          const playData = {
            user_id: this.userId,
            track_id: trackId,
            song_id: songId,
            play_duration: duration,
            completed: false,
            source: this.source,
            artist_name: artistName,
            track_title: this.currentTrack?.title?.rendered || this.currentTrack?.title || 'Unknown Title',
            is_favorite: this.currentTrack?.acf?.is_favorite || false,
            style_id: styleId,
            style_name: styleName,
            genre_id: genreId,
            genre_name: genreName
          };
          
          // 非同期で記録を実行
          this.recordPlayData(playData);
        }
      }
    }
  }
}

