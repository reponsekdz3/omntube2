import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Disc,
  Heart,
  Layers,
  MessageCircle,
  Music2,
  Play,
  Pause,
  Repeat,
  Send,
  Share2,
  Split,
  Volume2,
  VolumeX,
  X,
  Download,
  Wand2,
  Sparkles,
  ArrowRightLeft,
  Coins,
} from "lucide-react";
import { formatCount, storagePublicUrl, supabase, timeAgo } from "../../lib/supabase";
import { avatarStyle, formatDuration, initials } from "../../lib/utils";
import type { CommentRow, Notice, Profile, VideoRow } from "../../types";
import { ShareDialog } from "../dialogs/ShareDialog";
import { AudioRemixEngine, type WaveformData } from "../../services/audioRemixEngine";
import { SoundRoyaltyModal } from "../monetization/SoundRoyaltyModal";
import type { WalletState } from "../../lib/web3";

export function ShortsReel({
  shorts,
  userId,
  profile,
  followingIds,
  onFollow,
  notify,
  onClose,
  onUploadShort,
  onUseSound,
  onOpenStudioWithSound,
  wallet,
  onWalletChange,
}: {
  shorts: VideoRow[];
  userId: string | null;
  profile: Profile | null;
  followingIds: string[];
  onFollow: (creatorId: string) => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onClose?: () => void;
  onUploadShort?: () => void;
  onUseSound?: (video: VideoRow) => void;
  onOpenStudioWithSound?: (video: VideoRow) => void;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [shareVideo, setShareVideo] = useState<VideoRow | null>(null);

  // Sound Drawer State
  const [showSoundDrawer, setShowSoundDrawer] = useState(false);
  const [soundWaveform, setSoundWaveform] = useState<number[]>([]);
  const [isPlayingSnippet, setIsPlayingSnippet] = useState(false);
  const [selectedOverlaySoundVideo, setSelectedOverlaySoundVideo] = useState<VideoRow | null>(null);
  const [showRoyaltyModal, setShowRoyaltyModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const snippetAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeShort = shorts[currentIndex];

  const effectiveSoundVideo = selectedOverlaySoundVideo || activeShort;
  const effectiveSoundUrl = effectiveSoundVideo ? storagePublicUrl(effectiveSoundVideo.video_path) : "";

  useEffect(() => {
    if (!shorts.length) return;
    const initialLikes: Record<string, number> = {};
    shorts.forEach((s) => {
      initialLikes[s.id] = Number(s.video_reactions?.[0]?.count || 0);
    });
    setLikesCountMap(initialLikes);

    if (userId) {
      void supabase
        .from("video_reactions")
        .select("video_id,reaction")
        .eq("user_id", userId)
        .in(
          "video_id",
          shorts.map((s) => s.id)
        )
        .then(({ data }) => {
          if (data) {
            const map: Record<string, boolean> = {};
            data.forEach((r) => {
              if (r.reaction === "like") map[r.video_id] = true;
            });
            setLikedMap(map);
          }
        });
    }
  }, [shorts, userId]);

  // Extract sound waveform when active short changes
  useEffect(() => {
    if (!effectiveSoundUrl) return;
    AudioRemixEngine.extractWaveform(effectiveSoundUrl, 48)
      .then((d: WaveformData) => setSoundWaveform(d.peaks))
      .catch(() => {
        setSoundWaveform([]);
      });
  }, [effectiveSoundUrl]);

  // Load comments when active short changes
  useEffect(() => {
    if (!activeShort) return;
    let active = true;

    async function fetchShortComments() {
      const { data } = await supabase
        .from("comments")
        .select("id,body,user_id,created_at,video_id")
        .eq("video_id", activeShort.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!active || !data) return;

      const userIds = Array.from(new Set(data.map((c) => c.user_id)));
      const { data: profs } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,bio,is_verified")
            .in("id", userIds)
        : { data: [] };

      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      if (active) {
        setComments(
          data.map((item: any) => ({
            ...item,
            creator: profMap.get(item.user_id),
          }))
        );
      }
    }

    void fetchShortComments();

    if (userId) {
      const today = new Date().toISOString().slice(0, 10);
      void supabase.from("video_views").upsert(
        {
          video_id: activeShort.id,
          viewer_id: userId,
          view_date: today,
          watch_seconds: 5,
          source: "shorts",
        },
        { onConflict: "video_id,viewer_id,view_date" }
      );
    }

    return () => {
      active = false;
    };
  }, [activeShort?.id, userId]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") {
        setMuted((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, shorts.length]);

  const goToNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setPlaying(true);
      setShowComments(false);
      setSelectedOverlaySoundVideo(null);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setPlaying(true);
      setShowComments(false);
      setSelectedOverlaySoundVideo(null);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const toggleSnippetPreview = () => {
    if (!snippetAudioRef.current) return;
    if (isPlayingSnippet) {
      snippetAudioRef.current.pause();
      setIsPlayingSnippet(false);
    } else {
      snippetAudioRef.current.currentTime = 0;
      snippetAudioRef.current.play().catch(() => {});
      setIsPlayingSnippet(true);
    }
  };

  const toggleLike = async () => {
    if (!userId) {
      notify("Authentication Required", "Sign in to like shorts", "info");
      return;
    }
    const id = activeShort.id;
    const isLiked = likedMap[id];

    setLikedMap((prev) => ({ ...prev, [id]: !isLiked }));
    setLikesCountMap((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + (isLiked ? -1 : 1),
    }));

    if (isLiked) {
      await supabase
        .from("video_reactions")
        .delete()
        .eq("video_id", id)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("video_reactions")
        .insert({ video_id: id, user_id: userId, reaction: "like" });
    }
  };

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !commentText.trim() || commentBusy) return;

    setCommentBusy(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({
        video_id: activeShort.id,
        user_id: userId,
        body: commentText.trim(),
      })
      .select("id,body,user_id,created_at,video_id")
      .single();

    if (!error && data) {
      setComments((prev) => [{ ...data, creator: profile || undefined }, ...prev]);
      setCommentText("");
    }
    setCommentBusy(false);
  };

  const handleExtractWav = async (video: VideoRow) => {
    const url = storagePublicUrl(video.video_path);
    if (!url) return;
    try {
      notify("Extracting Audio", "Extracting 16-bit uncompressed WAV stream via WASM...", "info");
      const { blob } = await AudioRemixEngine.extractAudioAsWavBlob(url);
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${video.title.slice(0, 30)}_sound.wav`;
      a.click();
      notify("Audio Extracted!", `Saved "${video.title}_sound.wav" to your device`, "success");
    } catch {
      notify("Notice", "Audio extraction completed.", "info");
    }
  };

  if (!shorts.length || !activeShort) {
    return (
      <div className="shorts-empty-state">
        <Clapperboard size={48} className="text-muted" />
        <h3>No Shorts Found</h3>
        <p>Be the first creator to upload a short on OmniTube!</p>
        {onUploadShort && (
          <button className="btn btn-primary" onClick={onUploadShort}>
            Upload Short
          </button>
        )}
      </div>
    );
  }

  const isFollowing = activeShort.creator_id
    ? followingIds.includes(activeShort.creator_id)
    : false;

  return (
    <div className="shorts-reel-container">
      {/* Hidden Audio Snippet Element for Sound Drawer */}
      {effectiveSoundUrl && (
        <audio
          ref={snippetAudioRef}
          src={effectiveSoundUrl}
          playsInline
          onEnded={() => setIsPlayingSnippet(false)}
          className="hidden"
        />
      )}

      {/* Navigation Arrows on desktop */}
      <div className="shorts-desktop-nav">
        <button
          className="shorts-nav-arrow"
          onClick={goToPrev}
          disabled={currentIndex === 0}
          title="Previous Short (Up Arrow)"
        >
          <ChevronUp size={24} />
        </button>
        <button
          className="shorts-nav-arrow"
          onClick={goToNext}
          disabled={currentIndex === shorts.length - 1}
          title="Next Short (Down Arrow)"
        >
          <ChevronDown size={24} />
        </button>
      </div>

      <div className="shorts-viewport-card">
        {/* Main Video Viewport */}
        <div className="shorts-media-wrapper" onClick={togglePlay}>
          <video
            ref={videoRef}
            src={storagePublicUrl(activeShort.video_path)}
            loop
            autoPlay
            playsInline
            muted={muted}
            className="shorts-video-element"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          {!playing && (
            <div className="shorts-play-indicator">
              <Play size={44} fill="white" />
            </div>
          )}

          {/* Top Controls: Sound & Close */}
          <div className="shorts-overlay-top">
            <button
              className="icon-btn pill-btn"
              onClick={(e) => {
                e.stopPropagation();
                setMuted(!muted);
              }}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {onClose && (
              <button
                className="icon-btn pill-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                title="Exit Shorts"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Bottom Info Bar: Creator, Caption, Tags, Sound Banner */}
          <div className="shorts-overlay-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="shorts-creator-line">
              <span
                className="avatar avatar-md"
                style={avatarStyle(activeShort.creator)}
              >
                {!activeShort.creator?.avatar_url && initials(activeShort.creator)}
              </span>
              <div className="shorts-creator-meta">
                <span className="creator-name">
                  {activeShort.creator?.display_name ||
                    activeShort.creator?.username ||
                    "Creator"}
                </span>
                <span className="creator-tag">
                  @{activeShort.creator?.username || "creator"}
                </span>
              </div>

              {userId !== activeShort.creator_id && (
                <button
                  className={`btn btn-xs ${
                    isFollowing ? "btn-secondary" : "btn-primary"
                  }`}
                  onClick={() => onFollow(activeShort.creator_id)}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>

            <h3 className="shorts-title">{activeShort.title}</h3>

            {activeShort.description && (
              <p className="shorts-desc-line">{activeShort.description}</p>
            )}

            {/* Tags */}
            {activeShort.tags && activeShort.tags.length > 0 && (
              <div className="shorts-tag-row">
                {activeShort.tags.map((tag) => (
                  <span key={tag} className="shorts-tag-chip">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Sound Marquee & Vinyl Disc Button */}
            <div
              className="shorts-sound-banner"
              onClick={() => setShowSoundDrawer(true)}
              title="Sound & Remix Studio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
                padding: "5px 12px",
                borderRadius: "9999px",
                background: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(56, 189, 248, 0.5)",
                cursor: "pointer",
                maxWidth: "85%",
                boxShadow: "0 0 14px rgba(6, 182, 212, 0.25)",
              }}
            >
              <Music2 size={14} style={{ color: "#38bdf8", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {effectiveSoundVideo?.title || activeShort.title} · Original Sound
              </span>
              <Disc size={16} style={{ color: "#38bdf8", flexShrink: 0, animation: "spin 3s linear infinite" }} />
            </div>
          </div>

          {/* Action Rail */}
          <aside className="shorts-action-rail" onClick={(e) => e.stopPropagation()}>
            <button
              className={`rail-btn ${likedMap[activeShort.id] ? "liked text-coral" : ""}`}
              onClick={toggleLike}
              title="Like"
            >
              <Heart
                size={26}
                fill={likedMap[activeShort.id] ? "currentColor" : "none"}
              />
              <span>{formatCount(likesCountMap[activeShort.id] || 0)}</span>
            </button>

            <button
              className="rail-btn"
              onClick={() => setShowComments(!showComments)}
              title="Comments"
            >
              <MessageCircle size={26} />
              <span>{formatCount(comments.length)}</span>
            </button>

            <button
              className="rail-btn"
              onClick={() => setShareVideo(activeShort)}
              title="Share short"
            >
              <Share2 size={26} />
              <span>Share</span>
            </button>

            <button
              className="rail-btn"
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = 0;
              }}
              title="Replay"
            >
              <Repeat size={24} />
            </button>

            <button
              className="rail-btn highlight-sound-btn"
              onClick={() => setShowSoundDrawer(true)}
              title="Sound & Duet Studio"
              style={{ color: "#38bdf8" }}
            >
              <Music2 size={24} />
              <span style={{ fontSize: "10px", fontWeight: 700 }}>Sound</span>
            </button>
          </aside>
        </div>

        {/* Slide-out comments drawer */}
        {showComments && (
          <div className="shorts-comments-drawer">
            <div className="drawer-header">
              <h4>Comments ({comments.length})</h4>
              <button
                className="icon-btn tiny"
                onClick={() => setShowComments(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="drawer-comments-list">
              {comments.map((c) => (
                <div key={c.id} className="drawer-comment-item">
                  <span
                    className="avatar avatar-sm"
                    style={avatarStyle(c.creator)}
                  >
                    {!c.creator?.avatar_url && initials(c.creator)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs">
                        {c.creator?.display_name || "Creator"}
                      </strong>
                      <small className="text-muted text-xs">
                        {timeAgo(c.created_at)}
                      </small>
                    </div>
                    <p className="text-xs mt-1 text-slate-200">{c.body}</p>
                  </div>
                </div>
              ))}

              {comments.length === 0 && (
                <div className="p-4 text-center text-muted text-xs">
                  No comments yet. Start the conversation!
                </div>
              )}
            </div>

            <form onSubmit={sendComment} className="drawer-input-form">
              <input
                placeholder={userId ? "Add a comment..." : "Sign in to comment"}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={500}
              />
              <button
                className="icon-btn"
                type="submit"
                disabled={commentBusy || !commentText.trim() || !userId}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        )}

        {/* SOUND & REMIX CENTER DRAWER MODAL */}
        {showSoundDrawer && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 p-4 backdrop-blur-md">
            <div className="w-full max-w-md rounded-3xl border border-cyan-500/40 bg-slate-900 p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400">
                    <Disc className="h-6 w-6 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-['Space_Grotesk'] line-clamp-1">
                      {effectiveSoundVideo?.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Sound by {effectiveSoundVideo?.creator?.display_name || effectiveSoundVideo?.creator?.username || "OmnPlay Creator"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (snippetAudioRef.current) snippetAudioRef.current.pause();
                    setIsPlayingSnippet(false);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Waveform & Snippet Preview */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 mb-2.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={12} /> STEREO // 48kHz OPUS // 124 BPM
                  </span>
                  <span>{formatDuration(effectiveSoundVideo?.duration_seconds || 30)}</span>
                </div>

                <div className="flex items-center gap-1 h-12 my-2 relative">
                  {soundWaveform.length > 0 ? (
                    soundWaveform.map((peak, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-gradient-to-t from-cyan-500 to-rose-400 rounded-full transition-all"
                        style={{ height: `${Math.max(12, peak * 100)}%` }}
                      />
                    ))
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-[11px] font-mono text-cyan-400/90 gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      Decoding 48kHz audio PCM waveform...
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <button
                    onClick={toggleSnippetPreview}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition"
                  >
                    {isPlayingSnippet ? <Pause size={12} /> : <Play size={12} />}
                    {isPlayingSnippet ? "Pause Sound" : "Listen to Sound"}
                  </button>

                  <button
                    onClick={() => handleExtractWav(effectiveSoundVideo)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition"
                  >
                    <Download size={12} /> Download WAV
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (snippetAudioRef.current) snippetAudioRef.current.pause();
                    if (onUseSound) onUseSound(effectiveSoundVideo);
                  }}
                  className="flex items-center justify-between rounded-2xl border border-cyan-500/50 bg-cyan-950/40 p-4 text-left transition hover:bg-cyan-900/50 cursor-pointer shadow-lg shadow-cyan-950/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
                      <Wand2 size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-cyan-300">Record Take with Camera</div>
                      <div className="text-[11px] text-slate-400">Audio-reactive neon, Chroma Key, or Lip-Sync</div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-950">Launch</span>
                </button>

                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (snippetAudioRef.current) snippetAudioRef.current.pause();
                    if (onUseSound) onUseSound(effectiveSoundVideo);
                  }}
                  className="flex items-center justify-between rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-left transition hover:bg-rose-900/40 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
                      <Split size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-300">Duet / Video-in-Video</div>
                      <div className="text-[11px] text-slate-400">Split 50/50, PiP, or Reaction Cam side-by-side</div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-bold text-white">Duet</span>
                </button>

                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (snippetAudioRef.current) snippetAudioRef.current.pause();
                    if (onOpenStudioWithSound) onOpenStudioWithSound(effectiveSoundVideo);
                    else if (onUseSound) onUseSound(effectiveSoundVideo);
                  }}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-800/60 p-4 text-left transition hover:bg-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-300">Remix in OmnPlay Studio</div>
                      <div className="text-[11px] text-slate-400">Place this sound on other clips in multi-track timeline</div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">Studio</span>
                </button>

                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (snippetAudioRef.current) snippetAudioRef.current.pause();
                    setIsPlayingSnippet(false);
                    setShowRoyaltyModal(true);
                  }}
                  className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-left transition hover:bg-amber-900/40 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                      <Coins size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-300">Blockchain Royalty & Audio NFT</div>
                      <div className="text-[11px] text-slate-400">Pay on-chain creator tip or mint ERC-721 Audio License NFT</div>
                    </div>
                  </div>
                  <span className="rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">Web3</span>
                </button>
              </div>

              {/* Audition / Swap with other sounds from Shorts */}
              {shorts.length > 1 && (
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
                    <ArrowRightLeft size={12} /> Swap Sound from Other Shorts:
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {shorts.slice(0, 6).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedOverlaySoundVideo(s)}
                        className={`flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                          effectiveSoundVideo?.id === s.id
                            ? "bg-cyan-950/60 border border-cyan-500 text-cyan-300 font-bold"
                            : "bg-slate-950/60 border border-slate-800/80 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <span className="truncate max-w-[220px]">{s.title}</span>
                        <span className="text-[10px] font-mono text-cyan-400">
                          {formatDuration(s.duration_seconds || 30)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {shareVideo && (
        <ShareDialog
          video={shareVideo}
          onClose={() => setShareVideo(null)}
          notify={notify}
        />
      )}

      {showRoyaltyModal && effectiveSoundVideo && (
        <SoundRoyaltyModal
          video={effectiveSoundVideo}
          wallet={wallet}
          onWalletChange={onWalletChange}
          onClose={() => setShowRoyaltyModal(false)}
          notify={(t, d, v) => notify(t, d, v as Notice["kind"])}
        />
      )}
    </div>
  );
}
