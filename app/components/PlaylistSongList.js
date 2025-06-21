"use client";

import React, { useState, useEffect, useRef } from "react";
import LazyComponent from "./LazyComponent";
import MicrophoneIcon from "./MicrophoneIcon";
import SaveToPlaylistPopup from "./SaveToPlaylistPopup";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  where,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { firestore, auth } from "./firebase";
import styles from "./PlaylistSongList.module.css";

/** 
 * Decode minimal HTML entities: 
 *   &amp; => &
 *   &lt; => <
 *   &gt; => >
 *   &quot; => "
 *   &#039; => '
 * You can expand this if you have more HTML entities.
 */
function decodeHtmlEntities(str = "") {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'");
}

function removeLeadingThe(str = "") {
  return str.replace(/^The\s+/i, "").trim();
}

function normalizeArtistName(str = "") {
  const decoded = decodeHtmlEntities(str); // decode &amp;, etc.
  return removeLeadingThe(decoded).toLowerCase().trim();
}

function findArtistByName(categories, artistNameLower) {
  return categories.find((cat) => {
    // decode the category name as well
    const catNameDecoded = decodeHtmlEntities(cat.name || "");
    const catNameLower = removeLeadingThe(catNameDecoded).toLowerCase();
    return catNameLower === artistNameLower;
  });
}

/** 
 * Determine the best artist order for a single song:
 * 1) acf.artist_order (if present)
 * 2) content.rendered
 * 3) acf.spotify_artists
 * 4) fallback => categories as-is
 */
function determineArtistOrder(song) {
  const categories = song._embedded?.["wp:term"]?.[0] || [];

  // 1) acf.artist_order
  if (song.acf?.artist_order) {
    const orderNames = song.acf.artist_order
      .split(",")
      .map((n) => normalizeArtistName(n));
    const matched = [];
    orderNames.forEach((artistNameLower) => {
      const foundCat = findArtistByName(categories, artistNameLower);
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) {
      return matched;
    }
  }

  // 2) content.rendered => remove HTML tags, decode HTML
  if (song.content?.rendered) {
    let plainText = song.content.rendered.replace(/<[^>]+>/g, "");
    plainText = decodeHtmlEntities(plainText); // decode &amp; => &
    const contentStr = plainText.split("-")[0];
    const contentArtists = contentStr.split(",").map((n) => normalizeArtistName(n));
    const matched = [];
    contentArtists.forEach((artistNameLower) => {
      const foundCat = findArtistByName(categories, artistNameLower);
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) {
      return matched;
    }
  }

  // 3) acf.spotify_artists => decode
  if (song.acf?.spotify_artists) {
    const decodedSpotify = decodeHtmlEntities(song.acf.spotify_artists);
    const spotifyNames = decodedSpotify.split(",").map((n) => normalizeArtistName(n));
    const matched = [];
    spotifyNames.forEach((artistNameLower) => {
      const foundCat = findArtistByName(categories, artistNameLower);
      if (foundCat) matched.push(foundCat);
    });
    if (matched.length > 0) {
      return matched;
    }
  }

  // 4) fallback
  return categories;
}

/** 
 * Build the displayed "Artist1 (XX), Artist2 (XX)" string 
 */
function buildArtistString(song) {
  const ordered = determineArtistOrder(song);
  if (!ordered || ordered.length === 0) return "Unknown Artist";

  return ordered
    .map((cat, idx) => {
      // decode name
      const decodedName = decodeHtmlEntities(cat.name || "Unknown Artist");
      const origin =
        cat.acf?.artistorigin && cat.acf.artistorigin.trim() !== ""
          ? cat.acf.artistorigin
          : "Unknown Origin";
      return (
        <React.Fragment key={cat.id || idx}>
          {decodedName}
          {" "}
          <span style={{ fontSize: "80%", fontWeight: "normal" }}>
            ({origin})
          </span>
        </React.Fragment>
      );
    })
    .reduce((acc, curr, idx) => {
      if (idx > 0) acc.push(<span key={`sep-${idx}`}>, </span>);
      acc.push(curr);
      return acc;
    }, []);
}

function renderVocalIcons(vocalData = []) {
  if (!Array.isArray(vocalData) || vocalData.length === 0) return null;
  const icons = [];
  if (vocalData.some((v) => v.name.toLowerCase() === "f")) {
    icons.push(<MicrophoneIcon key="F" color="#fd5a5a" />);
  }
  if (vocalData.some((v) => v.name.toLowerCase() === "m")) {
    icons.push(<MicrophoneIcon key="M" color="#00A0E9" />);
  }
  return icons.length > 0 ? (
    <span style={{ marginLeft: "4px", display: "inline-flex", alignItems: "center", gap: "2px" }}>{icons}</span>
  ) : null;
}

function formatYearMonth(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "Invalid Date";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit" }).replace(/-/g, ".");
}

function buildGenreText(song) {
  if (!song.genre_data || song.genre_data.length === 0) return "";
  const joined = song.genre_data.map((g) => g.name).join(" / ");
  return `(${joined})`;
}

function copySongInfo(song) {
  try {
    // アーティスト情報を生成する
    const ordered = determineArtistOrder(song);
    const artistTexts = ordered.map((cat) => {
      const decodedName = decodeHtmlEntities(cat.name || "Unknown Artist");
      const origin =
        cat.acf?.artistorigin && cat.acf.artistorigin.trim() !== ""
          ? cat.acf.artistorigin
          : "Unknown Origin";
      return `${decodedName} (${origin})`;
    });
    const artistInfo = artistTexts.join(", ");

    // タイトル
    const songTitle = song.title?.rendered || "No Title";

    // 公開年月
    const dateStr = formatYearMonth(song.date);

    // ジャンルテキスト（括弧付き）
    const genreText = buildGenreText(song);

    // ボーカル情報
    let vocalText = "";
    if (Array.isArray(song.vocal_data) && song.vocal_data.length > 0) {
      const hasF = song.vocal_data.some((v) => v.name.toLowerCase() === "f");
      const hasM = song.vocal_data.some((v) => v.name.toLowerCase() === "m");
      if (hasF && hasM) {
        vocalText = "F M";
      } else if (hasF) {
        vocalText = "F";
      } else if (hasM) {
        vocalText = "M";
      }
    }

    // コピーするテキストを組み立てる
    let finalText = `${artistInfo} - ${songTitle} / ${dateStr}`;
    if (genreText) {
      finalText += genreText;
    }
    if (vocalText) {
      finalText += " " + vocalText;
    }

    navigator.clipboard.writeText(finalText);
    alert("COPYしました");
  } catch (err) {
    console.error("コピーに失敗:", err);
    alert("コピーに失敗しました");
  }
}


/** fetchViewCounts => same as before */
async function fetchViewCounts(songs) {
  const cachedViewCounts =
    typeof window !== "undefined" ? localStorage.getItem("viewCounts") : null;
  const cachedUserViewCounts =
    typeof window !== "undefined" ? localStorage.getItem("userViewCounts") : null;

  const viewCountsData = {};
  const userViewCountsData = {};

  if (cachedViewCounts) {
    Object.assign(viewCountsData, JSON.parse(cachedViewCounts));
  }
  if (cachedUserViewCounts) {
    Object.assign(userViewCountsData, JSON.parse(cachedUserViewCounts));
  }

  const songIds = songs.map((s) => String(s.id)).filter(Boolean);
  if (songIds.length > 0) {
    const chunkedIds = [];
    for (let i = 0; i < songIds.length; i += 30) {
      chunkedIds.push(songIds.slice(i, i + 30));
    }
    const promises = chunkedIds.map((chunk) => {
      const songViewsQuery = query(
        collection(firestore, "songViews"),
        where("__name__", "in", chunk)
      );
      return getDocs(songViewsQuery);
    });
    const snapshots = await Promise.all(promises);
    snapshots.forEach((snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        viewCountsData[docSnap.id] = data.totalViewCount || 0;
      });
    });

    if (auth.currentUser) {
      const userId = auth.currentUser.uid;
      const userViewPromises = songIds.map(async (songId) => {
        const userViewsRef = doc(
          firestore,
          `usersongViews/${songId}/userViews/${userId}`
        );
        const userViewDoc = await getDoc(userViewsRef);
        if (userViewDoc.exists()) {
          const userData = userViewDoc.data();
          userViewCountsData[songId] = userData.viewCount2 || 0;
        } else {
          userViewCountsData[songId] = 0;
        }
      });
      await Promise.all(userViewPromises);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("viewCounts", JSON.stringify(viewCountsData));
      localStorage.setItem("userViewCounts", JSON.stringify(userViewCountsData));
    }
  }

  return { viewCountsData, userViewCountsData };
}

// CloudinaryのベースURL
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dniwclyhj/image/upload/thumbnails/';

const PlaylistSongList = ({ songs, setSongs, handleActivateSong, deleteSongFromPlaylist, currentSongIndex, playlistId, openExternalLink, isOwner }) => {
  const [mergedSongs, setMergedSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [viewCounts, setViewCounts] = useState({});
  const [userViewCounts, setUserViewCounts] = useState({});

  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupSong, setPopupSong] = useState(null);
  const [popupIndex, setPopupIndex] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  const [showSavePopup, setShowSavePopup] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState(null);

  const menuRef = useRef(null);
  const [menuHeight, setMenuHeight] = useState(0);

  useEffect(() => {
    if (isPopupVisible && menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [isPopupVisible]);

  // Merge categories => _embedded
  useEffect(() => {
    const newMerged = songs.map((song) => {
      const clone = { ...song };
      if (!clone._embedded) clone._embedded = {};
      if (!clone._embedded["wp:term"]) clone._embedded["wp:term"] = [];
      if (clone.custom_fields?.categories) {
        clone._embedded["wp:term"][0] = clone.custom_fields.categories;
      }
      return clone;
    });
    setMergedSongs(newMerged);
  }, [songs]);

  // fetchViewCounts
  useEffect(() => {
    (async () => {
      if (mergedSongs.length === 0) return;
      const { viewCountsData, userViewCountsData } = await fetchViewCounts(mergedSongs);
      setViewCounts(viewCountsData);
      setUserViewCounts(userViewCountsData);
    })();
  }, [mergedSongs]);

  // fetchLikes
  useEffect(() => {
    const fetchLikes = async () => {
      if (mergedSongs.length === 0) return;
      const likeCountsData = {};
      const likedSongsData = {};

      const qSnap = await getDocs(collection(firestore, "likes"));
      qSnap.forEach((docSnap) => {
        const data = docSnap.data();
        likeCountsData[docSnap.id] = data.likeCount || 0;
      });

      if (auth.currentUser) {
        const userId = auth.currentUser.uid;
        const userLikedQuery = query(
          collection(firestore, "likes"),
          where("userIds", "array-contains", userId)
        );
        const userLikedSnapshot = await getDocs(userLikedQuery);
        userLikedSnapshot.forEach((docSnap) => {
          likedSongsData[docSnap.id] = true;
        });
      }
      setLikeCounts(likeCountsData);
      setLikedSongs(likedSongsData);
    };
    fetchLikes();
  }, [mergedSongs]);

  // toggleLike
  const toggleLike = async (songId) => {
    if (!auth.currentUser) {
      alert("ログインしてください");
      return;
    }
    const userId = auth.currentUser.uid;
    const likeRef = doc(firestore, "likes", songId);
    try {
      const likeDoc = await getDoc(likeRef);
      if (!likeDoc.exists()) {
        await setDoc(likeRef, { likeCount: 0, userIds: [] });
      }
      if (likedSongs[songId]) {
        await updateDoc(likeRef, {
          userIds: arrayRemove(userId),
          likeCount: (likeCounts[songId] || 0) - 1,
        });
        setLikedSongs((prev) => ({ ...prev, [songId]: false }));
      } else {
        await updateDoc(likeRef, {
          userIds: arrayUnion(userId),
          likeCount: (likeCounts[songId] || 0) + 1,
        });
        setLikedSongs((prev) => ({ ...prev, [songId]: true }));
      }
    } catch (error) {
      console.error("Error updating likes:", error);
      alert("いいねの更新中にエラーが発生しました。");
    }
  };

  // handleAddToPlaylist
  const handleAddToPlaylistClick = (songId) => {
    setSelectedSongId(songId);
    setShowSavePopup(true);
    setIsPopupVisible(false);
  };
  const closeSavePopup = () => {
    setShowSavePopup(false);
    setSelectedSongId(null);
  };

  // handleOnDragEnd
  const handleOnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(mergedSongs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setMergedSongs(items);

    const newSongIds = items.map((s) => s.id.toString());
    const playlistRef = doc(firestore, "playlists", playlistId);
    updateDoc(playlistRef, { songIds: newSongIds }).catch((err) => {
      console.error("プレイリストの更新中にエラー:", err);
      alert("プレイリストの更新中にエラーが発生しました。");
    });
  };

  // handleActivateSongWithHashRemoval
  const handleActivateSongWithHashRemoval = (index) => {
    handleActivateSong(index);
    if (typeof window !== "undefined" && window.history.replaceState) {
      const urlWithoutHash = window.location.href.split("#")[0];
      window.history.replaceState(null, "", urlWithoutHash);
    }
  };

  // handleThreeDotsClick
  const handleThreeDotsClick = (e, song, index) => {
    e.stopPropagation();
    const iconRect = e.currentTarget.getBoundingClientRect();
    // position: fixed なのでビューポート基準
    let top = iconRect.bottom - menuHeight;
    let left = iconRect.right;
    const menuWidth = 220;
    const menuHeightPx = menuRef.current ? menuRef.current.offsetHeight : 240;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    // 右端はみ出し対策
    if (left + menuWidth > winWidth - 8) {
      left = winWidth - menuWidth - 8;
    }
    // 下端はみ出し対策
    if (top + menuHeightPx > winHeight - 8) {
      top = winHeight - menuHeightPx - 8;
    }
    if (top < 8) {
      top = 8;
    }
    setPopupPosition({ top, left });
    setPopupSong(song);
    setPopupIndex(index);
    setIsPopupVisible(true);
  };

  // close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isPopupVisible &&
        !e.target.closest(".popup-menu") &&
        !e.target.closest(".three-dots-icon")
      ) {
        setIsPopupVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPopupVisible]);

  // handleDeleteFromPlaylist
  const handleDeleteFromPlaylist = () => {
    if (popupIndex !== null) {
      deleteSongFromPlaylist(popupIndex);
      setIsPopupVisible(false);
    }
  };

  // getThumbnailPath => .webp
  const getThumbnailPath = (featuredUrl) => {
    if (!featuredUrl) return "/placeholder.jpg";
    const fileName = featuredUrl.split("/").pop().replace(/\.[a-zA-Z0-9]+$/, ".webp");
    return `${CLOUDINARY_BASE_URL}${fileName}`;
  };

  // ヘルパー: ポップアップ内リンククリック時にイベント伝播を止める
  const handlePopupLinkClick = (e, url) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = url;
  };
  

  return (
    <DragDropContext onDragEnd={handleOnDragEnd}>
      <Droppable droppableId="songs">
        {(provided) => (
          <ul className={styles.songList} ref={provided.innerRef} {...provided.droppableProps}>
            {mergedSongs.map((song, index) => {
              const artistElems = buildArtistString(song);
              const songTitle = song.title?.rendered || "No Title";
              const dateStr = formatYearMonth(song.date);
              const genreText = buildGenreText(song);
              const vocalIcons = renderVocalIcons(song.vocal_data);
              const viewCount = viewCounts[song.id] || 0;
              const userViewCount = userViewCounts[song.id] || 0;
              const isLiked = likedSongs[song.id] || false;
              const likeCount = likeCounts[song.id] || 0;

              let thumbnailPath = "/placeholder.jpg";
              if (song.featured_media_url) {
                thumbnailPath = getThumbnailPath(song.featured_media_url);
              }

              return (
                <Draggable key={song.id} draggableId={String(song.id)} index={index}>
                  {(provided) => (
                    <li
                      className={styles.songItem}
                      id={`song-${song.id}`}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{
                        ...provided.draggableProps.style,
                        borderBottom: "1px solid #e0e0e0",
                        padding: "8px 0",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {/* No. column */}
                      <div
                        style={{
                          width: "36px",
                          textAlign: "center",
                          marginRight: "8px",
                          fontWeight: "bold",
                        }}
                      >
                        {index + 1}
                      </div>

                      {/* Drag handle */}
                      {isOwner && (
                      <div
                        className={styles.dragHandle}
                        {...provided.dragHandleProps}
                        style={{ marginRight: "8px" }}
                      >
                        <img
                          src="/svg/drag-handle.svg"
                          alt="Drag"
                          className={styles.dragIcon}
                          style={{ width: "12px", height: "12px", cursor: "grab" }}
                        />
                      </div>
                      )}

                      {/* Thumbnail */}
                      <div
                          className={styles.thumbnailContainer}
                          onClick={() => handleActivateSongWithHashRemoval(index)}
                          style={{ marginRight: "8px", cursor: "pointer" }}
                        >
                          <LazyComponent height={50}>
                            <img
                              src={thumbnailPath}
                              alt={songTitle}
                              className={`${styles.thumbnail} ${currentSongIndex === index ? styles.playingBorder : ""}`}
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.jpg";
                                e.currentTarget.onerror = null;
                              }}
                            />
                          </LazyComponent>
                        </div>


                      {/* Text container */}
                      <div style={{ flex: 1 }}>
                        {/* 1st line: Artist - Title */}
                        <div>
                          {artistElems} <span style={{ margin: "0 4px" }}>-</span> {songTitle}
                        </div>
                        {/* 2nd line: date, genre, vocal, like, view, 3-dots */}
                        <div style={{ marginTop: "2px", fontSize: "0.9em", display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span>{dateStr}</span>
                          {genreText && <span style={{ marginLeft: "4px" }}>{genreText}</span>}
                          {vocalIcons && <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center' }}>{vocalIcons}</span>}
                          <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '12px' }}>
                            <img
                              src={isLiked ? "/svg/heart-solid.svg" : "/svg/heart-regular.svg"}
                              alt="Like"
                              style={{
                                width: "16px",
                                height: "16px",
                                cursor: "pointer",
                                verticalAlign: "middle",
                              }}
                              onClick={() => toggleLike(String(song.id))}
                            />
                            {likeCount > 0 && (
                              <span style={{ marginLeft: "2px" }}>{likeCount}</span>
                            )}
                          </span>
                          {isOwner && viewCount > 0 && (
                            <span style={{ marginLeft: "12px" }}>
                              ({viewCount}
                              {userViewCount > 0 ? ` / ${userViewCount}` : ""})
                            </span>
                          )}
                          <img
                            src="/svg/three-dots-line.svg"
                            alt="Menu"
                            className="three-dots-icon"
                            style={{ width: "20px", height: "20px", cursor: "pointer", marginLeft: '12px' }}
                            onClick={(e) => handleThreeDotsClick(e, song, index)}
                          />
                        </div>
                      </div>
                    </li>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>

      {/* Popup menu */}
      {isPopupVisible && popupSong && (
        <div
          className="popup-menu"
          ref={menuRef}
          style={{
            position: "fixed",
            top: popupPosition.top,
            left: popupPosition.left,
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            padding: "10px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            zIndex: 10,
            display: "inline-block",
            width: "auto",
            height: "auto",
          }}
        >
          {/* Artist link (ordered) */}
          <div>
            {determineArtistOrder(popupSong).map((artist, idx) => {
              // decode the name for display
              const decodedName = decodeHtmlEntities(artist.name || "");
              return (
                <div key={artist.id || idx} style={{ marginBottom: "4px" }}>
                  <a
                    href={`/${artist.slug}/`}
                    style={{ display: "flex", alignItems: "flex-start", textDecoration: "none", color: "#1e6ebb" }}
                    onClick={(e) => handlePopupLinkClick(e, `/${artist.slug}/`)}
                    >
                    <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                      <img
                        src="/svg/musician.png"
                        alt="Musician"
                        style={{ width: "16px", height: "16px" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>{decodedName}</div>
                  </a>
                </div>
              );
            })}
          </div>
          <hr />
          {/* Song detail link: first artist's slug */}
          <div style={{ marginBottom: "4px" }}>
            {(() => {
              const ordered = determineArtistOrder(popupSong);
              const firstArtistSlug = ordered.length > 0 ? ordered[0].slug : "unknown-artist";
              const detailLink = `/${firstArtistSlug}/songs/${popupSong.slug}/`;
              return (
                <a
                   href={detailLink}
                  style={{ display: "flex", alignItems: "flex-start", textDecoration: "none", color: "#1e6ebb" }}
                  onClick={(e) => handlePopupLinkClick(e, detailLink)}
                >
                  <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                    <img
                      src="/svg/song.png"
                      alt="Song"
                      style={{ width: "16px", height: "16px" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    {popupSong.title?.rendered || "No Title"}
                  </div>
                </a>
              );
            })()}
          </div>
          <hr />
          {/* Genre */}
          <div>
            {popupSong.genre_data?.map((g) => (
              <div key={g.slug} style={{ marginBottom: "4px" }}>
                <a
                  href={`/genres/${g.slug}/1`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    textDecoration: "none",
                    color: "#1e6ebb",
                  }}
                  onClick={(e) => handlePopupLinkClick(e, `/genres/${g.slug}/1`)}
                >
                  <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                    <img
                      src="/svg/genre.png"
                      alt="Genre"
                      style={{ width: "16px", height: "16px" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>{g.name}</div>
                </a>
              </div>
            ))}
          </div>
          <hr />
          {/* Add to playlist */}
          <div
            style={{ marginBottom: "4px", cursor: "pointer" }}
            onClick={() => handleAddToPlaylistClick(popupSong.id)}
          >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                <img src="/svg/add.svg" alt="Add" style={{ width: "16px", height: "16px" }} />
              </div>
              <div style={{ flex: 1 }}>プレイリストに追加</div>
            </div>
          </div>
          <hr />
          {/* Delete */}
          { isOwner && (
        <div
            style={{ marginBottom: "4px", cursor: "pointer" }}
             onClick={handleDeleteFromPlaylist}
          >
             <div style={{ display: "flex", alignItems: "flex-start" }}>
               <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                 <img
                    src="/svg/delete.svg"
                   alt="Delete"
                    style={{ width: "16px", height: "16px" }}
                 />
                </div>
                <div style={{ flex: 1 }}>削除</div>
             </div>
            </div>
         )}
         <hr />
          {/* COPY */}
          <div
            style={{ marginBottom: "4px", cursor: "pointer" }}
            onClick={() => copySongInfo(popupSong)}
          >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                <img src="/svg/copy.svg" alt="Copy" style={{ width: "16px", height: "16px" }} />
              </div>
              <div style={{ flex: 1 }}>Text Copy</div>
            </div>
          </div>
          <hr />
          {/* YouTube */}
          {popupSong.acf?.ytvideoid && (
            <>
              <div style={{ marginBottom: "4px" }}>
                <a
                  href={`https://www.youtube.com/watch?v=${popupSong.acf.ytvideoid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    textDecoration: "none",
                    color: "#1e6ebb",
                  }}
                  onClick={openExternalLink}
                >
                  <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                    <img
                      src="/svg/youtube.svg"
                      alt="YouTube"
                      style={{ width: "20px", height: "20px" }}
                    />
                  </div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <span>YouTube</span>
                    <img
                      src="/svg/new-window.svg"
                      alt="New Window"
                      style={{
                        width: "16px",
                        height: "16px",
                        marginLeft: "4px",
                        verticalAlign: "middle",
                      }}
                    />
                  </div>
                </a>
              </div>
              <hr />
            </>
          )}
          {/* Spotify */}
          {popupSong.acf?.spotify_track_id && (
            <div>
              <a
                href={`https://open.spotify.com/track/${popupSong.acf.spotify_track_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  textDecoration: "none",
                  color: "#1e6ebb",
                }}
                onClick={openExternalLink}
              >
                <div style={{ width: "20px", flexShrink: 0, marginRight: "4px" }}>
                  <img
                    src="/svg/spotify.svg"
                    alt="Spotify"
                    style={{ width: "20px", height: "20px" }}
                  />
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <span>Spotify</span>
                  <img
                    src="/svg/new-window.svg"
                    alt="New Window"
                    style={{ width: "16px", height: "16px", marginLeft: "4px" }}
                  />
                </div>
              </a>
            </div>
          )}
        </div>
      )}

      {showSavePopup && (
        <SaveToPlaylistPopup songId={selectedSongId} onClose={closeSavePopup} />
      )}
    </DragDropContext>
  );
};

export default PlaylistSongList;