import React, { useEffect, useState } from "react";
import {
  Bookmark,
  Clock,
  History,
  ListVideo,
  Play,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { formatCount, supabase, timeAgo } from "../../lib/supabase";
import { formatDuration } from "../../lib/utils";
import type { Notice, PlaylistRow, VideoRow } from "../../types";

export function LibraryView({
  userId,
  notify,
  onPlayVideo,
  initialTab,
}: {
  userId: string;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onPlayVideo: (v: VideoRow) => void;
  initialTab?: "watch_later" | "history" | "liked" | "playlists";
}) {
  const [tab, setTab] = useState<"watch_later" | "history" | "liked" | "playlists">(
    initialTab || "watch_later"
  );

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);
  const [watchLaterVideos, setWatchLaterVideos] = useState<VideoRow[]>([]);
  const [historyVideos, setHistoryVideos] = useState<{ view: any; video: VideoRow }[]>([]);
  const [likedVideos, setLikedVideos] = useState<VideoRow[]>([]);
  const [customPlaylists, setCustomPlaylists] = useState<PlaylistRow[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistRow | null>(null);
  const [selectedPlaylistVideos, setSelectedPlaylistVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Watch Later
  const loadWatchLater = async () => {
    setLoading(true);
    const { data: pl } = await supabase
      .from("playlists")
      .select("id")
      .eq("owner_id", userId)
      .eq("title", "Watch later")
      .maybeSingle();

    if (!pl) {
      setWatchLaterVideos([]);
      setLoading(false);
      return;
    }

    const { data: items } = await supabase
      .from("playlist_items")
      .select("video_id")
      .eq("playlist_id", pl.id)
      .order("position", { ascending: true });

    const ids = (items || []).map((i: any) => i.video_id);
    if (!ids.length) {
      setWatchLaterVideos([]);
      setLoading(false);
      return;
    }

    const { data: vids } = await supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at"
      )
      .in("id", ids);

    setWatchLaterVideos((vids || []) as VideoRow[]);
    setLoading(false);
  };

  // Load History
  const loadHistory = async () => {
    setLoading(true);
    const { data: views } = await supabase
      .from("video_views")
      .select("id,video_id,viewer_id,view_date,watch_seconds,created_at")
      .eq("viewer_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (!views || !views.length) {
      setHistoryVideos([]);
      setLoading(false);
      return;
    }

    const ids = Array.from(new Set(views.map((v) => v.video_id)));
    const { data: vids } = await supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at"
      )
      .in("id", ids);

    const vMap = new Map((vids || []).map((v) => [v.id, v as VideoRow]));
    setHistoryVideos(
      views
        .map((view) => ({
          view,
          video: vMap.get(view.video_id)!,
        }))
        .filter((item) => Boolean(item.video))
    );
    setLoading(false);
  };

  // Load Liked
  const loadLiked = async () => {
    setLoading(true);
    const { data: reactions } = await supabase
      .from("video_reactions")
      .select("video_id,created_at")
      .eq("user_id", userId)
      .eq("reaction", "like")
      .order("created_at", { ascending: false })
      .limit(60);

    const ids = (reactions || []).map((r: any) => r.video_id);
    if (!ids.length) {
      setLikedVideos([]);
      setLoading(false);
      return;
    }

    const { data: vids } = await supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at"
      )
      .in("id", ids);

    setLikedVideos((vids || []) as VideoRow[]);
    setLoading(false);
  };

  // Load Custom Playlists
  const loadPlaylists = async () => {
    setLoading(true);
    const { data: pls } = await supabase
      .from("playlists")
      .select("id,owner_id,title,description,visibility,created_at,updated_at")
      .eq("owner_id", userId)
      .neq("title", "Watch later")
      .order("created_at", { ascending: false });

    setCustomPlaylists((pls || []) as PlaylistRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "watch_later") void loadWatchLater();
    else if (tab === "history") void loadHistory();
    else if (tab === "liked") void loadLiked();
    else if (tab === "playlists") void loadPlaylists();
  }, [tab, userId]);

  // Open playlist details
  const openPlaylist = async (pl: PlaylistRow) => {
    setSelectedPlaylist(pl);
    const { data: items } = await supabase
      .from("playlist_items")
      .select("video_id")
      .eq("playlist_id", pl.id)
      .order("position", { ascending: true });

    const ids = (items || []).map((i: any) => i.video_id);
    if (ids.length) {
      const { data: vids } = await supabase
        .from("videos")
        .select(
          "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at"
        )
        .in("id", ids);
      setSelectedPlaylistVideos((vids || []) as VideoRow[]);
    } else {
      setSelectedPlaylistVideos([]);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear your entire watch history?")) return;
    const { error } = await supabase
      .from("video_views")
      .delete()
      .eq("viewer_id", userId);
    if (error) {
      notify("Failed to clear watch history", error.message, "error");
    } else {
      setHistoryVideos([]);
      notify("Watch history cleared.", undefined, "success");
    }
  };

  const removeFromWatchLater = async (videoId: string) => {
    const { data: pl } = await supabase
      .from("playlists")
      .select("id")
      .eq("owner_id", userId)
      .eq("title", "Watch later")
      .maybeSingle();
    if (!pl) return;

    await supabase
      .from("playlist_items")
      .delete()
      .eq("playlist_id", pl.id)
      .eq("video_id", videoId);

    setWatchLaterVideos((prev) => prev.filter((v) => v.id !== videoId));
    notify("Removed from Watch later.");
  };

  return (
    <div className="library-suite-container">
      {/* Library Tabs */}
      <div className="library-subnav">
        <button
          className={`lib-tab-btn ${tab === "watch_later" ? "active" : ""}`}
          onClick={() => {
            setTab("watch_later");
            setSelectedPlaylist(null);
          }}
        >
          <Bookmark size={16} /> Watch Later ({watchLaterVideos.length})
        </button>
        <button
          className={`lib-tab-btn ${tab === "history" ? "active" : ""}`}
          onClick={() => {
            setTab("history");
            setSelectedPlaylist(null);
          }}
        >
          <History size={16} /> Watch History ({historyVideos.length})
        </button>
        <button
          className={`lib-tab-btn ${tab === "liked" ? "active" : ""}`}
          onClick={() => {
            setTab("liked");
            setSelectedPlaylist(null);
          }}
        >
          <ThumbsUp size={16} /> Liked Videos ({likedVideos.length})
        </button>
        <button
          className={`lib-tab-btn ${tab === "playlists" ? "active" : ""}`}
          onClick={() => {
            setTab("playlists");
            setSelectedPlaylist(null);
          }}
        >
          <ListVideo size={16} /> Playlists ({customPlaylists.length})
        </button>
      </div>

      {/* Selected Playlist Detailed View */}
      {selectedPlaylist ? (
        <div className="playlist-detail-screen mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                className="btn btn-quiet btn-sm"
                onClick={() => setSelectedPlaylist(null)}
              >
                ← Back to playlists
              </button>
              <div>
                <h2>{selectedPlaylist.title}</h2>
                <small className="text-muted">
                  {selectedPlaylistVideos.length} videos · {selectedPlaylist.visibility}
                </small>
              </div>
            </div>

            {selectedPlaylistVideos.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={() => onPlayVideo(selectedPlaylistVideos[0])}
              >
                <Play size={16} fill="currentColor" /> Play All
              </button>
            )}
          </div>

          <div className="playlist-video-queue">
            {selectedPlaylistVideos.map((v, idx) => (
              <div key={v.id} className="queue-row-item">
                <span className="queue-index">{idx + 1}</span>
                <div
                  className="queue-thumb cursor-pointer"
                  onClick={() => onPlayVideo(v)}
                >
                  <Play size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <strong
                    className="cursor-pointer hover:text-mint block truncate"
                    onClick={() => onPlayVideo(v)}
                  >
                    {v.title}
                  </strong>
                  <small className="text-muted text-xs">
                    {formatDuration(v.duration_seconds)} · {formatCount(v.views_count)} views
                  </small>
                </div>
              </div>
            ))}

            {selectedPlaylistVideos.length === 0 && (
              <div className="p-8 text-center text-muted">
                This playlist does not contain any videos yet. Add videos from any video player or card.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="library-content-view mt-6">
          {/* WATCH LATER */}
          {tab === "watch_later" && (
            <div className="library-video-grid">
              {watchLaterVideos.map((v) => (
                <div key={v.id} className="library-card">
                  <div
                    className="library-card-thumb cursor-pointer"
                    onClick={() => onPlayVideo(v)}
                  >
                    <Play size={20} className="thumb-play-icon" />
                    <span className="duration-tag">
                      {formatDuration(v.duration_seconds)}
                    </span>
                  </div>
                  <div className="library-card-meta">
                    <strong
                      className="cursor-pointer hover:text-mint block truncate"
                      onClick={() => onPlayVideo(v)}
                    >
                      {v.title}
                    </strong>
                    <div className="flex items-center justify-between mt-1">
                      <small className="text-muted text-xs">
                        {formatCount(v.views_count)} views
                      </small>
                      <button
                        className="icon-btn tiny text-muted hover:text-coral"
                        title="Remove from Watch Later"
                        onClick={() => void removeFromWatchLater(v.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!loading && watchLaterVideos.length === 0 && (
                <div className="col-span-full p-12 text-center text-muted">
                  <Bookmark size={36} className="mx-auto mb-2 opacity-50" />
                  <h3>Your Watch Later queue is empty</h3>
                  <p className="text-xs">
                    Save videos while exploring OmniTube to keep them close for later sessions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* WATCH HISTORY */}
          {tab === "history" && (
            <div>
              {historyVideos.length > 0 && (
                <div className="flex justify-end mb-4">
                  <button className="btn btn-quiet btn-sm" onClick={clearHistory}>
                    <Trash2 size={14} /> Clear Watch History
                  </button>
                </div>
              )}

              <div className="library-history-list">
                {historyVideos.map(({ view, video }) => (
                  <div key={view.id} className="history-row-item">
                    <div
                      className="history-thumb cursor-pointer"
                      onClick={() => onPlayVideo(video)}
                    >
                      <Play size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <strong
                        className="cursor-pointer hover:text-mint block truncate"
                        onClick={() => onPlayVideo(video)}
                      >
                        {video.title}
                      </strong>
                      <small className="text-muted text-xs">
                        Watched {formatDuration(view.watch_seconds)} ·{" "}
                        {timeAgo(view.created_at)}
                      </small>
                    </div>
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => onPlayVideo(video)}
                    >
                      Watch Again
                    </button>
                  </div>
                ))}

                {!loading && historyVideos.length === 0 && (
                  <div className="p-12 text-center text-muted">
                    <History size={36} className="mx-auto mb-2 opacity-50" />
                    <h3>No viewing history recorded</h3>
                    <p className="text-xs">
                      Videos you watch will be seamlessly logged here so you can pick up where you left off.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LIKED VIDEOS */}
          {tab === "liked" && (
            <div className="library-video-grid">
              {likedVideos.map((v) => (
                <div key={v.id} className="library-card">
                  <div
                    className="library-card-thumb cursor-pointer"
                    onClick={() => onPlayVideo(v)}
                  >
                    <Play size={20} className="thumb-play-icon" />
                    <span className="duration-tag">
                      {formatDuration(v.duration_seconds)}
                    </span>
                  </div>
                  <div className="library-card-meta">
                    <strong
                      className="cursor-pointer hover:text-mint block truncate"
                      onClick={() => onPlayVideo(v)}
                    >
                      {v.title}
                    </strong>
                    <small className="text-muted text-xs block mt-1">
                      {formatCount(v.views_count)} views · {v.category}
                    </small>
                  </div>
                </div>
              ))}

              {!loading && likedVideos.length === 0 && (
                <div className="col-span-full p-12 text-center text-muted">
                  <ThumbsUp size={36} className="mx-auto mb-2 opacity-50" />
                  <h3>No liked videos yet</h3>
                  <p className="text-xs">
                    Hit Like on videos you enjoy to bookmark them in your liked collection.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PLAYLISTS */}
          {tab === "playlists" && (
            <div className="grid grid-cols-3 gap-4">
              {customPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  className="studio-playlist-card cursor-pointer hover:border-mint"
                  onClick={() => void openPlaylist(pl)}
                >
                  <div className="playlist-icon-banner">
                    <ListVideo size={28} />
                  </div>
                  <div className="p-4">
                    <strong className="text-sm block">{pl.title}</strong>
                    <small className="text-muted text-xs block mt-1">
                      {pl.visibility.toUpperCase()} · Click to view tracks
                    </small>
                  </div>
                </div>
              ))}

              {!loading && customPlaylists.length === 0 && (
                <div className="col-span-3 p-12 text-center text-muted">
                  <ListVideo size={36} className="mx-auto mb-2 opacity-50" />
                  <h3>No custom playlists created yet</h3>
                  <p className="text-xs">
                    Create playlists in Creator Studio or save videos from the player to start building your library.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
