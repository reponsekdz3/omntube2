import { supabase } from "./supabase";
import type { Profile } from "../types";

export function initials(profile?: Profile | null): string {
  return (profile?.display_name || "Creator")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function avatarStyle(profile?: Profile | null): React.CSSProperties | undefined {
  return profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0:00";
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remainder = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${mins}:${String(remainder).padStart(2, "0")}`;
}

export function formatWatchTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export type VideoChapter = {
  seconds: number;
  label: string;
};

export function parseChapters(description: string | null | undefined): VideoChapter[] {
  if (!description) return [];
  const lines = description.split("\n");
  const chapters: VideoChapter[] = [];
  const regex = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+[-–—]?\s*(.+)/;
  for (const line of lines) {
    const match = line.trim().match(regex);
    if (match) {
      const hours = match[1] ? parseInt(match[1], 10) : 0;
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      const label = match[4].trim();
      chapters.push({ seconds: totalSeconds, label });
    }
  }
  return chapters.sort((a, b) => a.seconds - b.seconds);
}

export async function captureVideoFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.currentTime = 1;

    video.onloadeddata = () => {
      video.currentTime = Math.min(2, Math.max(0.5, (video.duration || 2) * 0.15));
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1280, video.videoWidth || 640);
        canvas.height = Math.min(720, video.videoHeight || 360);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              resolve(blob);
            },
            "image/jpeg",
            0.85
          );
          return;
        }
      } catch {
        // Fallback
      }
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
  });
}
