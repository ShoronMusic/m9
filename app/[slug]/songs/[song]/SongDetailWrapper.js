"use client";
import dynamic from "next/dynamic";

const SongDetailClient = dynamic(() => import("./SongDetailClient"), { ssr: false });
 
export default function SongDetailWrapper(props) {
  return <SongDetailClient {...props} />;
} 