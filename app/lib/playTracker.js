export class PlayTracker {
  constructor(userId) {
    this.userId = userId;
    this.currentTrack = null;
    this.startTime = null;
    this.timer = null;
    this.isTracking = false;
    this.pendingRecord = null; // 保留中の記録データ
    
    if (process.env.NODE_ENV === 'development') {
      console.log('PlayTracker: Initialized with userId:', userId);
    }
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

    const playData = {
      track_id: trackData.track.spotifyTrackId,
      song_id: trackData.songId,
      play_duration: trackData.duration,
      completed: trackData.completed,
      source: trackData.source,
      artist_name: artistName,
      track_title: trackTitle,
      is_favorite: isFavorite
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
