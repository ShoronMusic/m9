"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Fuse from "fuse.js";

// 先頭の "the " を除去し小文字化する関数
const normalize = (str) => str.toLowerCase().replace(/^(the\s+)/, "");

export default function ArtistSearch() {
  const [artists, setArtists] = useState([]);
  const [query, setQuery] = useState("");
  const [exactMatches, setExactMatches] = useState([]);
  const [partialMatches, setPartialMatches] = useState([]);

  // JSONデータの読み込みと normalizedName の追加
  useEffect(() => {
    fetch("/artists.json")
      .then((response) => response.json())
      .then((data) => {
        // data は { "NIGHT FLIGHT ORCHESTRA": { ... }, "Night Game": { ... } } の形式
        const artistArray = Object.entries(data).map(([name, details]) => ({
          name,
          normalizedName: normalize(name),
          ...details,
        }));
        setArtists(artistArray);
      })
      .catch((error) => console.error("Error loading artists:", error));
  }, []);

  // 入力が変更されたら検索を実行
  useEffect(() => {
    if (!query) {
      // クエリが空の場合はリセット
      setExactMatches([]);
      setPartialMatches([]);
      return;
    }

    const normalizedQuery = normalize(query);

    // Fuse.js の設定（normalizedName をキーに）
    const fuse = new Fuse(artists, {
      keys: ["normalizedName"],
      includeScore: true,
      threshold: 0.3,
    });

    // 検索を実行
    const fuseResults = fuse.search(normalizedQuery).map(({ item, score }) => ({
      ...item,
      score,
    }));

    // 完全一致と部分一致に仕分け
    const exact = [];
    const partial = [];
    fuseResults.forEach((artist) => {
      if (artist.normalizedName === normalizedQuery) {
        exact.push(artist);
      } else {
        partial.push(artist);
      }
    });

    setExactMatches(exact);
    setPartialMatches(partial);
  }, [query, artists]);

  return (
    <div style={{ textAlign: "center", marginTop: "40px" }}>
      <input
        type="text"
        placeholder="Enter artist name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ padding: "4px", width: "200px" }}
      />
      {/* 完全一致結果 */}
      {exactMatches.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "20px auto 0 auto",
            display: "inline-block",
            textAlign: "left",
          }}
        >
          {exactMatches.map((artist) => (
            <li key={artist.id}>
              ・
              <Link href={`/${artist.slug}/`} legacyBehavior>{artist.name}</Link>
            </li>
          ))}
        </ul>
      )}
      {/* 部分一致結果 */}
      {partialMatches.length > 0 && (
        <>
          <br />
          <br />
          <ul
            style={{
              color: "#999",
              listStyle: "none",
              padding: 0,
              margin: "0 auto",
              display: "inline-block",
              textAlign: "left",
            }}
          >
            {partialMatches.map((artist) => (
              <li key={artist.id}>
                ・
                <Link href={`/${artist.slug}/`} legacyBehavior>{artist.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
