// app/mypage/Tabs.js

"use client";
import React from "react";

export default function Tabs({ activeTab, setActiveTab }) {
  return (
    <div style={{ display: "flex", marginBottom: "20px", borderBottom: "1px solid #ccc" }}>
      <button
        onClick={() => setActiveTab("playlists")}
        style={{
          width: "100%",
          padding: "10px",
          backgroundColor: activeTab === "playlists" ? "white" : "#f0f0f0",
          color: activeTab === "playlists" ? "black" : "#888",
          border: "none",
          borderBottom: activeTab === "playlists" ? "none" : "1px solid #ccc",
          cursor: "pointer",
          fontWeight: activeTab === "playlists" ? "bold" : "normal",
        }}
      >
        Playlists
      </button>
    </div>
  );
}