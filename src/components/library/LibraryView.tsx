import React, { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  Clock,
  ExternalLink,
  History,
  KeyRound,
  ListVideo,
  Play,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { formatCount, supabase, timeAgo } from "../../lib/supabase";
import { avatarStyle, formatDuration, initials } from "../../lib/utils";
import type { Notice, PlaylistRow, Profile, VideoRow } from "../../types";
import {
  connectWeb3Wallet,
  formatAddress,
  getInjectedProvider,
  SUPPORTED_CHAINS,
  type WalletState,
} from "../../lib/web3";
import { InstallWalletModal } from "../monetization/InstallWalletModal";

export type LibraryTab =
  | "watch_later"
  | "history"
  | "liked"
  | "playlists"
  | "memberships"
  | "unlocked_ppv";

export function LibraryView({
  userId,
  wallet,
  onWalletChange,
  notify,
  onPlayVideo,
  initialTab,
}: {
  userId: string;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onPlayVideo: (v: VideoRow) => void;
  initialTab?: LibraryTab;
}) {
  const [tab, setTab] = useState<LibraryTab>(initialTab || "watch_later");

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
  const [userMemberships, setUserMemberships] = useState<
    Array<{
      id: number;
      creatorId: string;
      tier: string;
      txHash: string;
      expiresAt: string;
      perks: string[];
      creator?: Profile;
    }>
  >([]);
  const [unlockedMedia, setUnlockedMedia] = useState<
    Array<{
      id: number;
      videoId: string;
      txHash: string;
      amountPaid: string;
      tokenSymbol: string;
      chain: string;
      unlockedAt: string;
      video?: VideoRow;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);

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

  // Load Channel Memberships
  const loadMemberships = async () => {
    setLoading(true);
    if (!wallet?.address) {
      setUserMemberships([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/monetization/user-memberships?subscriberAddress=${wallet.address}`);
      if (res.ok) {
        const data = await res.json();
        const memberships = data.memberships || [];
        const creatorIds = Array.from(new Set(memberships.map((m: any) => m.creatorId))) as string[];
        let profMap = new Map<string, Profile>();
        if (creatorIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,bio,is_verified")
            .in("id", creatorIds);
          if (profs) {
            profMap = new Map((profs as Profile[]).map((p) => [p.id, p]));
          }
        }
        setUserMemberships(
          memberships.map((m: any) => ({
            ...m,
            creator: profMap.get(m.creatorId),
          }))
        );
      } else {
        setUserMemberships([]);
      }
    } catch {
      setUserMemberships([]);
    } finally {
      setLoading(false);
    }
  };

  // Load Unlocked PPV Media
  const loadUnlockedPPV = async () => {
    setLoading(true);
    if (!wallet?.address) {
      setUnlockedMedia([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/monetization/user-unlocks?userAddress=${wallet.address}`);
      if (res.ok) {
        const data = await res.json();
        const unlocks = data.unlocks || [];
        const videoIds = Array.from(new Set(unlocks.map((u: any) => u.videoId))) as string[];
        let vidMap = new Map<string, VideoRow>();
        if (videoIds.length > 0) {
          const { data: vids } = await supabase
            .from("videos")
            .select(
              "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at"
            )
            .in("id", videoIds);
          if (vids) {
            vidMap = new Map((vids as VideoRow[]).map((v) => [v.id, v]));
          }
        }
        setUnlockedMedia(
          unlocks.map((u: any) => ({
            ...u,
            video: vidMap.get(u.videoId),
          }))
        );
      } else {
        setUnlockedMedia([]);
      }
    } catch {
      setUnlockedMedia([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "watch_later") void loadWatchLater();
    else if (tab === "history") void loadHistory();
    else if (tab === "liked") void loadLiked();
    else if (tab === "playlists") void loadPlaylists();
    else if (tab === "memberships") void loadMemberships();
    else if (tab === "unlocked_ppv") void loadUnlockedPPV();
  }, [tab, userId, wallet?.address]);

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
        <button
          className={`lib-tab-btn ${tab === "memberships" ? "active" : ""}`}
          onClick={() => {
            setTab("memberships");
            setSelectedPlaylist(null);
          }}
        >
          <Sparkles size={16} /> Channel Memberships ({userMemberships.length})
        </button>
        <button
          className={`lib-tab-btn ${tab === "unlocked_ppv" ? "active" : ""}`}
          onClick={() => {
            setTab("unlocked_ppv");
            setSelectedPlaylist(null);
          }}
        >
          <KeyRound size={16} /> Unlocked PPV ({unlockedMedia.length})
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

          {/* CHANNEL MEMBERSHIPS */}
          {tab === "memberships" && (
            <div>
              {!wallet?.connected ? (
                <div className="p-8 bg-panel-2 rounded-2xl border border-border text-center max-w-lg mx-auto">
                  <Wallet size={40} className="mx-auto mb-3 text-mint opacity-80" />
                  <h3 className="text-base font-bold text-white mb-2">Connect Web3 Wallet</h3>
                  <p className="text-xs text-muted mb-4">
                    Link your MetaMask, Binance Web3 Wallet, or EVM wallet to inspect verified channel memberships and member-only perks.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!getInjectedProvider()) {
                        setShowInstallModal(true);
                      } else if (onWalletChange) {
                        try {
                          const w = await connectWeb3Wallet();
                          onWalletChange(w);
                        } catch (e: any) {
                          notify("Wallet connection failed", e.message, "error");
                        }
                      }
                    }}
                  >
                    <Wallet size={15} /> Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {userMemberships.map((m) => {
                    const isDiamond = m.tier === "diamond";
                    const isGold = m.tier === "gold";
                    const tierColor = isDiamond ? "#38bdf8" : isGold ? "#eab308" : "#94a3b8";
                    const tierBadgeBg = isDiamond
                      ? "rgba(56, 189, 248, 0.12)"
                      : isGold
                      ? "rgba(234, 179, 8, 0.12)"
                      : "rgba(148, 163, 184, 0.12)";

                    return (
                      <div
                        key={m.id}
                        className="p-5 bg-panel-2 rounded-2xl border border-border flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className="px-2.5 py-1 rounded-full text-2xs font-extrabold uppercase tracking-wider"
                              style={{
                                color: tierColor,
                                backgroundColor: tierBadgeBg,
                                border: `1px solid ${tierColor}40`,
                              }}
                            >
                              {m.tier} Member
                            </span>
                            <span className="text-2xs text-mint font-semibold flex items-center gap-1">
                              <ShieldCheck size={12} /> Active
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mb-4">
                            <span
                              className="avatar avatar-md"
                              style={avatarStyle(m.creator || ({} as any))}
                            >
                              {!m.creator?.avatar_url && initials(m.creator || ({} as any))}
                            </span>
                            <div className="min-w-0">
                              <strong className="text-sm text-white block truncate">
                                {m.creator?.display_name || "Creator Channel"}
                              </strong>
                              <span className="text-2xs text-muted block mt-0.5">
                                Expires {new Date(m.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {m.perks && m.perks.length > 0 && (
                            <div className="space-y-1 mb-4">
                              <span className="text-2xs uppercase tracking-wider text-muted font-bold block mb-1">
                                Your Perks
                              </span>
                              {m.perks.map((p, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-slate-300 flex items-center gap-2"
                                >
                                  <BadgeCheck size={13} className="text-mint shrink-0" />
                                  <span className="truncate">{p}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {m.txHash && (
                          <div className="pt-3 border-t border-border flex justify-between items-center text-2xs text-muted">
                            <span className="font-mono">Receipt: {formatAddress(m.txHash)}</span>
                            <a
                              href={`https://bscscan.com/tx/${m.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-mint inline-flex items-center gap-1"
                            >
                              Verify <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!loading && userMemberships.length === 0 && (
                    <div className="col-span-3 p-12 text-center text-muted">
                      <Sparkles size={36} className="mx-auto mb-2 opacity-50" />
                      <h3>No active channel memberships</h3>
                      <p className="text-xs">
                        Join creator memberships on their channel or video pages to access members-only streams, custom badges, and exclusive drops.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* UNLOCKED PPV MEDIA */}
          {tab === "unlocked_ppv" && (
            <div>
              {!wallet?.connected ? (
                <div className="p-8 bg-panel-2 rounded-2xl border border-border text-center max-w-lg mx-auto">
                  <KeyRound size={40} className="mx-auto mb-3 text-yellow-400 opacity-80" />
                  <h3 className="text-base font-bold text-white mb-2">Connect Web3 Wallet</h3>
                  <p className="text-xs text-muted mb-4">
                    Connect your wallet to retrieve your on-chain ownership passes and stream unlocked Pay-Per-View videos.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!getInjectedProvider()) {
                        setShowInstallModal(true);
                      } else if (onWalletChange) {
                        try {
                          const w = await connectWeb3Wallet();
                          onWalletChange(w);
                        } catch (e: any) {
                          notify("Wallet connection failed", e.message, "error");
                        }
                      }
                    }}
                  >
                    <Wallet size={15} /> Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="library-video-grid">
                  {unlockedMedia.map((m) => (
                    <div key={m.id} className="library-card">
                      <div
                        className="library-card-thumb cursor-pointer relative"
                        onClick={() => m.video && onPlayVideo(m.video)}
                      >
                        {m.video?.thumbnail_path ? (
                          <img
                            src={
                              supabase.storage
                                .from("omnitube-thumbnails")
                                .getPublicUrl(m.video.thumbnail_path).data.publicUrl
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play size={20} className="thumb-play-icon" />
                          </div>
                        )}
                        <span className="duration-tag">
                          {formatDuration(m.video?.duration_seconds || 0)}
                        </span>
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-mint/40 text-mint text-2xs font-bold uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck size={10} /> PPV UNLOCKED
                        </div>
                      </div>
                      <div className="library-card-meta">
                        <strong
                          className="cursor-pointer hover:text-mint block truncate"
                          onClick={() => m.video && onPlayVideo(m.video)}
                        >
                          {m.video?.title || "Premium Video Title"}
                        </strong>
                        <div className="flex items-center justify-between text-muted text-xs mt-1">
                          <span>
                            {m.amountPaid} {m.tokenSymbol} ({m.chain})
                          </span>
                          <span className="text-2xs">{timeAgo(m.unlockedAt)}</span>
                        </div>
                        {m.txHash && (
                          <div className="mt-2 pt-1 border-t border-border flex justify-between items-center text-2xs text-muted">
                            <span className="font-mono">{formatAddress(m.txHash)}</span>
                            <a
                              href={`https://bscscan.com/tx/${m.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-mint inline-flex items-center gap-1"
                            >
                              Tx <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {!loading && unlockedMedia.length === 0 && (
                    <div className="col-span-full p-12 text-center text-muted">
                      <KeyRound size={36} className="mx-auto mb-2 opacity-50" />
                      <h3>No unlocked pay-per-view media</h3>
                      <p className="text-xs">
                        When you purchase pay-per-view videos with Web3 tokens, they will permanently show here for instant unlimited access.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Extension auto-redirect and install modal */}
      <InstallWalletModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        preferredWallet="all"
      />
    </div>
  );
}
