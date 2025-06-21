"use client";

import React from "react";
import { ThemeProvider } from "@mui/material/styles";
import Link from "next/link";
import Image from "next/image";
import theme from "../css/theme";
import artistStyles from "./ArtistPage.module.css";

export default function ArtistDetailClient({ artistData }) {
  if (!artistData) {
    return <div>データが取得できませんでした。</div>;
  }

  const artistOrigin = artistData.acf?.artistorigin || "Unknown";
  const artistActiveYearStart = artistData.acf?.artistactiveyearstart || "Unknown";
  const artistJpName = artistData.acf?.artistjpname || artistData.name;

  return (
    <ThemeProvider theme={theme}>
      <div className={artistStyles.container}>
        <div className={artistStyles.imageContainer}>
          <Image
            src={artistData.acf?.spotify_artist_images || "/placeholder.jpg"}
            alt={artistData.name}
            width={300}
            height={300}
            className={artistStyles.artistImage}
            priority
          />
        </div>
        <div className={artistStyles.infoContainer}>
          <h1 className={artistStyles.artistName}>{artistData.name}</h1>
          <p className={artistStyles.artistJpName}>{artistJpName}</p>
          <div className={artistStyles.artistInfo}>
            <p>Country: {artistOrigin}</p>
            <p>Active: {artistActiveYearStart}</p>
          </div>
          {artistData.acf?.member && artistData.acf.member.length > 0 && (
            <div className={artistStyles.members}>
              <h2>Members</h2>
              <ul>
                {artistData.acf.member.map((member, index) => (
                  <li key={index}>
                    <Link href={`/artists/${member.slug}`}>
                      {member.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
} 