export class PlayTracker {
  constructor(userId) {
    this.userId = userId;
    this.currentTrack = null;
    this.startTime = null;
    this.timer = null;
    this.isTracking = false;
  }

  startTracking(track, songId, source) {
    if (this.isTracking) {
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
        songId,
        source
      });
    }
    
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
      this.recordPlay(duration, completed);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('PlayTracker: Stopped tracking', {
          track: this.currentTrack?.title || this.currentTrack?.name,
          duration,
          completed
        });
      }
    }
    
    this.currentTrack = null;
    this.startTime = null;
    this.isTracking = false;
  }

  async recordPlay(duration, completed) {
    if (!this.userId || !this.currentTrack) return;

    // アーティスト名とタイトルの取得を改善
    const artistName = this.currentTrack.artist || 
                      this.currentTrack.artistName || 
                      this.currentTrack.artists?.[0]?.name ||
                      'Unknown Artist';
    
    const trackTitle = this.currentTrack.title || 
                      this.currentTrack.name ||
                      (typeof this.currentTrack.title?.rendered === 'string' ? this.currentTrack.title.rendered : null) ||
                      'Unknown Track';

    try {
      const response = await fetch('/api/play-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: this.currentTrack.spotifyTrackId,
          song_id: this.songId,
          play_duration: duration,
          completed,
          source: this.source,
          artist_name: artistName,
          track_title: trackTitle
        })
      });

      if (response.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.log('PlayTracker: Recorded play history successfully', {
            artist: artistName,
            title: trackTitle,
            duration,
            completed
          });
        }
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
          console.error('PlayTracker: Failed to record play history');
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('PlayTracker: Error recording play history:', error);
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
