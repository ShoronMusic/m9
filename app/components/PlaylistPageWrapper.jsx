'use client';

import PlaylistDetail from './PlaylistDetail';

export default function PlaylistPageWrapper({ playlist, tracks, session, autoPlayFirst }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <PlaylistDetail 
        playlist={playlist} 
        tracks={tracks || []} 
        session={session}
        autoPlayFirst={autoPlayFirst}
      />
    </div>
  );
}
