// app/mypage/Playlists.js

"use client";
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "../components/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Playlists() {
  const [user, loading] = useAuthState(auth);
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [sortOption, setSortOption] = useState("alphabetical");
  const router = useRouter();
  const [activeRow, setActiveRow] = useState(null);

  useEffect(() => {
    async function fetchPlaylists() {
      if (user) {
        setLoadingPlaylists(true);
        try {
          const q = query(
            collection(firestore, "playlists"),
            where("userId", "==", user.uid),
            orderBy(
              sortOption === "alphabetical" ? "title" : "updatedAt",
              sortOption === "alphabetical" ? "asc" : "desc"
            )
          );
          const querySnapshot = await getDocs(q);
          let playlistsData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          if (sortOption === "alphabetical") {
            playlistsData.sort((a, b) =>
              a.title.toLowerCase().localeCompare(b.title.toLowerCase())
            );
          }
          setPlaylists(playlistsData);
        } catch (error) {
          console.error("Error fetching playlists:", error);
        } finally {
          setLoadingPlaylists(false);
        }
      }
    }
    fetchPlaylists();
  }, [user, sortOption]);

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  return (
    <div style={{ padding: "20px"}}>
     
      <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '8px 24px', border: '1px solid #cbd5e1' }}>
          <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', gap: '6px' }}>
            <input
              type="radio"
              value="alphabetical"
              checked={sortOption === "alphabetical"}
              onChange={handleSortChange}
              style={{ accentColor: '#007bff' }}
            />
            Alphabetical
          </label>
          <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', gap: '6px' }}>
            <input
              type="radio"
              value="updatedAt"
              checked={sortOption === "updatedAt"}
              onChange={handleSortChange}
              style={{ accentColor: '#007bff' }}
            />
            Updated Order
          </label>
        </div>
      </div>
      {loadingPlaylists ? (
        <p>Loading playlists...</p>
      ) : playlists.length > 0 ? (
        <table style={{ tableLayout: 'fixed', width: '100%', marginTop: '16px' }}>
          <colgroup>
            <col style={{ width: '67%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}> Play list title</th>
              <th style={{ textAlign: 'center' }}>Songs</th>
              <th style={{ textAlign: 'center' }}>Update</th>
              <th style={{ textAlign: 'left' }}></th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((playlist, idx) => (
              <tr
                key={playlist.id}
                style={{
                  backgroundColor: activeRow === playlist.id ? '#dbeafe' : undefined,
                  borderBottom: '1px solid #e5e7eb',
                }}
                onMouseEnter={() => setActiveRow(playlist.id)}
                onMouseLeave={() => setActiveRow(null)}
              >
                <td style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '8px 0', paddingLeft: '12px' }}>
                  {playlist.title}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 0', paddingRight: '12px' }}>{playlist.songIds?.length || 0}</td>
                <td style={{ textAlign: 'left', padding: '8px 0', paddingLeft: '8px' }}>{(() => {
                  const d = new Date(playlist.updatedAt.seconds * 1000);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  return `${y}.${m}.${day}`;
                })()}</td>
                <td style={{ textAlign: 'right', padding: '8px 0', paddingRight: '12px' }}>
                  <button
                    onClick={() => router.push(`/playlists/${playlist.id}`)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.9em',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '5px',
                    }}
                  >
                    PLAY
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No playlists available.</p>
      )}
    </div>
  );
}
