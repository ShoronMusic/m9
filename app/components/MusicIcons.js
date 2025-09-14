import React from "react";
import styles from "./SongList.module.css"; // スタイル適用

const MusicIcons = ({ ytVideoId, spotifyTrackId, openExternalLink }) => {
  return (
    <div className={styles.iconContainer}>
      {ytVideoId && (
        <img
          src="/icons/youtube.svg"
          alt="YouTube"
          className={styles.musicIcon}
          onClick={() => openExternalLink(`https://www.youtube.com/watch?v=${ytVideoId}`)}
        />
      )}
      {spotifyTrackId && (
        <img
          src="/svg/spotify.svg"
          alt="Spotify"
          className={styles.musicIcon}
          onClick={() => openExternalLink(`https://open.spotify.com/track/${spotifyTrackId}`)}
        />
      )}
    </div>
  );
};

export default MusicIcons;
