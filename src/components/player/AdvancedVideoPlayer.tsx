import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BookmarkPlus,
  Coins,
  Crown,
  FastForward,
  Heart,
  KeyRound,
  Lock,
  Maximize,
  MessageCircle,
  Minimize,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Rewind,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  Tv,
  Volume2,
  VolumeX,
  X,
  Disc,
  Music2,
  Layers,
  Download,
  Wand2,
} from "lucide-react";
import { AudioRemixEngine } from "../../services/audioRemixEngine";
import { formatCount, supabase, timeAgo } from "../../lib/supabase";
import {
  avatarStyle,
  formatDuration,
  initials,
  parseChapters,
  type VideoChapter,
} from "../../lib/utils";
import type { CommentRow, Notice, Profile, VideoRow } from "../../types";
import { PlaylistDialog } from "../dialogs/PlaylistDialog";
import { ShareDialog } from "../dialogs/ShareDialog";
import { TipCreatorModal } from "../monetization/TipCreatorModal";
import { ChannelMembershipModal } from "../monetization/ChannelMembershipModal";
import { PayPerViewModal } from "../monetization/PayPerViewModal";
import type { WalletState } from "../../lib/web3";

export function AdvancedVideoPlayer({
  video,
  profile,
  userId,
  wallet,
  onWalletChange,
  onClose,
  notify,
  onSelectRelated,
  onUseSound,
  onOpenStudioWithSound,
}: {
  video: VideoRow;
  profile: Profile | null;
  userId: string | null;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onSelectRelated?: (v: VideoRow) => void;
  onUseSound?: (v: VideoRow) => void;
  onOpenStudioWithSound?: (v: VideoRow) => void;
}) {
  const [src, setSrc] = useState<string>("");
  const [loadError, setLoadError] = useState<string>("");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [showSoundDrawer, setShowSoundDrawer] = useState(false);
  const [soundWaveform, setSoundWaveform] = useState<number[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(Number(video.video_reactions?.[0]?.count || 0));

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration_seconds || 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoRow[]>([]);
  const [commentSort, setCommentSort] = useState<"newest" | "top">("newest");

  // Dialogs
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showPpvModal, setShowPpvModal] = useState(false);
  const [isPpvUnlocked, setIsPpvUnlocked] = useState(false);

  // Check if video is marked as Pay-Per-View
  const isPpvVideo =
    video.title.toLowerCase().includes("[ppv]") ||
    video.category?.toLowerCase() === "ppv" ||
    Boolean(video.tags && video.tags.includes("ppv"));

  useEffect(() => {
    if (showSoundDrawer && src && soundWaveform.length === 0) {
      AudioRemixEngine.extractWaveform(src, 48)
        .then((data) => setSoundWaveform(data.peaks))
        .catch(() => {
          setSoundWaveform(Array.from({ length: 48 }, (_, i) => 0.2 + 0.6 * Math.sin(i * 0.35) ** 2));
        });
    }
  }, [showSoundDrawer, src, soundWaveform.length]);

  // Check if current user wallet has already unlocked this PPV video
  useEffect(() => {
    let active = true;
    async function checkUnlock() {
      if (!isPpvVideo || !wallet?.address) return;
      try {
        const res = await fetch(
          `/api/monetization/ppv-unlocks/${video.id}?userAddress=${wallet.address}`
        );
        if (res.ok) {
          const data = await res.json();
          if (active && data?.unlocked) {
            setIsPpvUnlocked(true);
          }
        }
      } catch (err) {
        console.warn("Failed to check video unlock status:", err);
      }
    }
    void checkUnlock();
    return () => {
      active = false;
    };
  }, [video.id, wallet?.address, isPpvVideo]);

  const lastSavedWatch = useRef(0);
  const chapters: VideoChapter[] = parseChapters(video.description);

  // Load video source
  useEffect(() => {
    let active = true;
    void supabase.functions
      .invoke("resolve-playback", { body: { videoId: video.id } })
      .then(async ({ data, error }) => {
        if (!active) return;
        if (!error && data?.signedUrl) {
          setSrc(data.signedUrl);
        } else {
          // Fallback to public bucket or signed direct storage URL
          const { data: directUrl } = await supabase.storage
            .from("omnitube-videos")
            .createSignedUrl(video.video_path, 7200);
          if (active && directUrl?.signedUrl) {
            setSrc(directUrl.signedUrl);
          } else if (active) {
            // Attempt public URL fallback
            const publicFallback = supabase.storage
              .from("omnitube-videos")
              .getPublicUrl(video.video_path).data.publicUrl;
            setSrc(publicFallback);
          }
        }
      })
      .catch(() => {
        if (active) {
          const publicFallback = supabase.storage
            .from("omnitube-videos")
            .getPublicUrl(video.video_path).data.publicUrl;
          setSrc(publicFallback);
        }
      });

    return () => {
      active = false;
    };
  }, [video.id, video.video_path]);

  // Load comments
  useEffect(() => {
    let active = true;
    async function fetchComments() {
      const { data } = await supabase
        .from("comments")
        .select("id,body,user_id,created_at,video_id")
        .eq("video_id", video.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active || !data) return;

      const userIds = Array.from(new Set(data.map((c) => c.user_id)));
      const { data: profilesData } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,bio,is_verified")
            .in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      if (active) {
        setComments(
          data.map((item: any) => ({
            ...item,
            creator: profileMap.get(item.user_id),
          }))
        );
      }
    }
    void fetchComments();

    if (userId) {
      void supabase
        .from("video_reactions")
        .select("reaction")
        .eq("video_id", video.id)
        .eq("user_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setIsLiked(data?.reaction === "like");
        });
    }

    // Load related videos
    void supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at"
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .neq("id", video.id)
      .limit(6)
      .then(({ data }) => {
        if (active && data) setRelatedVideos(data as VideoRow[]);
      });

    return () => {
      active = false;
    };
  }, [video.id, userId]);

  // Save watch progress to database
  const saveWatchTime = useCallback(
    async (seconds: number) => {
      if (!userId || seconds < 2 || seconds - lastSavedWatch.current < 8) return;
      lastSavedWatch.current = seconds;
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("video_views").upsert(
        {
          video_id: video.id,
          viewer_id: userId,
          view_date: today,
          watch_seconds: seconds,
          source: video.kind === "short" ? "shorts" : "feed",
        },
        { onConflict: "video_id,viewer_id,view_date" }
      );
    },
    [userId, video.id, video.kind]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
          e.preventDefault();
          seekDelta(-10);
          break;
        case "l":
          e.preventDefault();
          seekDelta(10);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "t":
          e.preventDefault();
          setTheaterMode((prev) => !prev);
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
        case "arrowleft":
          e.preventDefault();
          seekDelta(-5);
          break;
        case "arrowright":
          e.preventDefault();
          seekDelta(5);
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => {
            const nv = Math.min(1, Math.round((v + 0.05) * 100) / 100);
            if (videoRef.current) videoRef.current.volume = nv;
            return nv;
          });
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => {
            const nv = Math.max(0, Math.round((v - 0.05) * 100) / 100);
            if (videoRef.current) videoRef.current.volume = nv;
            return nv;
          });
          break;
        case "escape":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const seekDelta = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta)
    );
  };

  const jumpToTime = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !muted;
    videoRef.current.muted = next;
    setMuted(next);
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setMuted(newVol === 0);
  };

  const handleSpeedSelect = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      void playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      notify("Picture-in-picture is not supported in this browser.", undefined, "error");
    }
  };

  const toggleLike = async () => {
    if (!userId) {
      notify("Sign in to like this video.");
      return;
    }
    if (isLiked) {
      const { error } = await supabase
        .from("video_reactions")
        .delete()
        .eq("video_id", video.id)
        .eq("user_id", userId);
      if (!error) {
        setIsLiked(false);
        setLikes((n) => Math.max(0, n - 1));
      }
    } else {
      const { error } = await supabase
        .from("video_reactions")
        .upsert({ video_id: video.id, user_id: userId, reaction: "like" });
      if (!error) {
        setIsLiked(true);
        setLikes((n) => n + 1);
        notify("Video liked!", undefined, "success");
      }
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      notify("Sign in to join the conversation.");
      return;
    }
    const body = commentBody.trim();
    if (!body || commentBusy) return;

    setCommentBusy(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ video_id: video.id, user_id: userId, body })
      .select("id,body,user_id,created_at,video_id")
      .single();

    setCommentBusy(false);
    if (error) {
      notify("Comment was not posted", error.message, "error");
    } else if (data) {
      setComments((old) => [{ ...data, creator: profile }, ...old]);
      setCommentBody("");
      notify("Comment posted.", undefined, "success");
    }
  };

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal-panel player-modal ${theaterMode ? "player-modal-theater" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="player-top">
          <div className="mini-brand">
            <span className="brand-mark">
              <span>O</span>
            </span>
            <span>OmniTube Cinema</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="icon-btn"
              onClick={() => setTheaterMode(!theaterMode)}
              title={theaterMode ? "Default view" : "Theater mode (T)"}
            >
              <Tv size={18} />
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close player">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="player-layout">
          <div className="player-main">
            {/* Custom Video Container with Ambient Backlight Glow */}
            <div className="player-ambient-container">
              <div className="player-ambient-glow" style={{ opacity: playing ? 0.65 : 0.35 }} />
              <div
                className={`pro-player-wrap ${playing ? "is-playing" : "is-paused"}`}
                ref={playerContainerRef}
              >
              <video
                ref={videoRef}
                src={src}
                playsInline
                autoPlay
                loop={isLooping}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => {
                  const sec = Math.floor(e.currentTarget.currentTime);
                  setCurrentTime(sec);
                  void saveWatchTime(sec);
                }}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || duration);
                  setPlaying(true);
                }}
                onClick={togglePlay}
              />

              {/* Pay-Per-View Lock Overlay if locked */}
              {isPpvVideo && !isPpvUnlocked && (
                <div className="ppv-video-gate-overlay">
                  <div className="ppv-lock-badge">
                    <Lock size={32} />
                  </div>
                  <h3>Premium Pay-Per-View Video</h3>
                  <p>
                    This video is secured by Web3 access control. Authorize on-chain payment with
                    MetaMask or Binance Web3 Wallet to stream in full resolution.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary ppv-unlock-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPpvModal(true);
                    }}
                  >
                    <KeyRound size={17} /> Unlock Video with Web3
                  </button>
                </div>
              )}

              {/* Control Overlay */}
              <div className="pro-player-controls">
                {/* Scrubber */}
                <div
                  className="pro-scrubber"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    jumpToTime(ratio * (duration || 1));
                  }}
                >
                  <div className="pro-scrubber-track">
                    <div
                      className="pro-scrubber-progress"
                      style={{
                        width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pro-controls-bar">
                  <div className="pro-controls-left">
                    <button
                      className="pro-ctrl-btn"
                      onClick={togglePlay}
                      title={playing ? "Pause (Space/K)" : "Play (Space/K)"}
                    >
                      {playing ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    <button
                      className="pro-ctrl-btn"
                      onClick={() => seekDelta(-10)}
                      title="Rewind 10s (J)"
                    >
                      <Rewind size={18} />
                    </button>
                    <button
                      className="pro-ctrl-btn"
                      onClick={() => seekDelta(10)}
                      title="Forward 10s (L)"
                    >
                      <FastForward size={18} />
                    </button>

                    <div className="pro-volume-wrap">
                      <button
                        className="pro-ctrl-btn"
                        onClick={toggleMute}
                        title={muted ? "Unmute (M)" : "Mute (M)"}
                      >
                        {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={muted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="pro-volume-slider"
                      />
                    </div>

                    <span className="pro-time-display">
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>
                  </div>

                  <div className="pro-controls-right">
                    {/* Playback speed menu */}
                    <div className="relative">
                      <button
                        className="pro-ctrl-btn text-xs font-bold"
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        title="Playback speed"
                      >
                        {playbackSpeed}x
                      </button>
                      {showSpeedMenu && (
                        <div className="speed-menu-dropdown">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                            <button
                              key={spd}
                              className={`speed-option ${playbackSpeed === spd ? "active" : ""}`}
                              onClick={() => handleSpeedSelect(spd)}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      className={`pro-ctrl-btn ${isLooping ? "text-mint" : ""}`}
                      onClick={() => setIsLooping(!isLooping)}
                      title={isLooping ? "Loop enabled" : "Loop disabled"}
                    >
                      <Repeat size={17} />
                    </button>

                    <button className="pro-ctrl-btn" onClick={togglePiP} title="Picture in Picture">
                      <Tv size={17} />
                    </button>

                    <button
                      className="pro-ctrl-btn"
                      onClick={toggleFullscreen}
                      title="Fullscreen (F)"
                    >
                      {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

            {/* Video Details Bar */}
            <div className="player-meta-section mt-4">
              <h1 className="player-title">{video.title}</h1>

              <div className="player-action-row">
                <div className="creator-identity">
                  <span
                    className="avatar avatar-md"
                    style={avatarStyle(video.creator)}
                  >
                    {!video.creator?.avatar_url && initials(video.creator)}
                  </span>
                  <div>
                    <strong>
                      {video.creator?.display_name || "Creator"}{" "}
                      {video.creator?.is_verified && <span className="verified">✓</span>}
                    </strong>
                    <small>
                      {formatCount(video.views_count)} views ·{" "}
                      {timeAgo(video.published_at || video.created_at)}
                    </small>
                  </div>
                </div>

                <div className="action-buttons-group">
                  <button
                    className={`btn ${isLiked ? "btn-liked" : "btn-quiet"}`}
                    onClick={() => void toggleLike()}
                  >
                    <ThumbsUp size={16} /> {formatCount(likes)}
                  </button>

                  {/* Web3 Tip Creator */}
                  {video.creator && (
                    <button
                      type="button"
                      className="btn btn-quiet text-coral hover:text-white"
                      onClick={() => setShowTipModal(true)}
                      title="Tip Creator with Web3 (BSC, ETH, Polygon, Arbitrum)"
                    >
                      <Heart size={16} fill="currentColor" /> Tip
                    </button>
                  )}

                  {/* Channel Membership */}
                  {video.creator && (
                    <button
                      type="button"
                      className="btn btn-quiet text-yellow-400 hover:text-white"
                      onClick={() => setShowMembershipModal(true)}
                      title="Join Channel Club"
                    >
                      <Crown size={16} /> Join
                    </button>
                  )}

                  {/* PPV Unlock button if premium and locked */}
                  {isPpvVideo && !isPpvUnlocked && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowPpvModal(true)}
                    >
                      <KeyRound size={16} /> Unlock PPV
                    </button>
                  )}

                  <button
                    className="btn btn-quiet border border-cyan-500/30 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-900/40"
                    onClick={() => setShowSoundDrawer(true)}
                    title="Use this sound in AR Camera or Creative Studio"
                  >
                    <Music2 size={16} className="text-cyan-400" /> Use Sound
                  </button>

                  <button
                    className="btn btn-quiet"
                    onClick={() => setShowShareDialog(true)}
                  >
                    <Share2 size={16} /> Share
                  </button>

                  {userId && (
                    <button
                      className="btn btn-quiet"
                      onClick={() => setShowPlaylistDialog(true)}
                    >
                      <BookmarkPlus size={16} /> Save
                    </button>
                  )}
                </div>
              </div>

              {/* Chapters Bar if available */}
              {chapters.length > 0 && (
                <div className="chapters-container mt-3">
                  <span className="text-xs font-semibold text-mint mb-2 block">
                    Video Chapters
                  </span>
                  <div className="chapter-chips-row">
                    {chapters.map((ch, idx) => (
                      <button
                        key={idx}
                        className="chapter-chip"
                        onClick={() => jumpToTime(ch.seconds)}
                      >
                        <strong>{formatDuration(ch.seconds)}</strong>
                        <span>{ch.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div className="description-box mt-3 whitespace-pre-line">
                  {video.description}
                </div>
              )}
            </div>
          </div>

          {/* Side Drawer: Comments & Related Videos */}
          <aside className="comment-panel">
            <div className="comment-heading">
              <h3>Comments ({comments.length})</h3>
              <div className="flex gap-2 text-xs">
                <button
                  className={`sort-tab ${commentSort === "newest" ? "active text-mint" : "text-muted"}`}
                  onClick={() => setCommentSort("newest")}
                >
                  Newest
                </button>
              </div>
            </div>

            <form className="comment-form" onSubmit={addComment}>
              <span className="avatar avatar-sm" style={avatarStyle(profile)}>
                {!profile?.avatar_url && initials(profile)}
              </span>
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={3000}
                placeholder={userId ? "Add a public comment..." : "Sign in to leave a comment"}
              />
              <button
                className="icon-btn"
                type="submit"
                disabled={commentBusy || !commentBody.trim() || !userId}
              >
                <Send size={16} />
              </button>
            </form>

            <div className="comment-list">
              {comments.map((comment) => (
                <div className="comment" key={comment.id}>
                  <span className="avatar avatar-sm" style={avatarStyle(comment.creator)}>
                    {!comment.creator?.avatar_url && initials(comment.creator)}
                  </span>
                  <div>
                    <div className="comment-byline">
                      <strong>{comment.creator?.display_name || "Creator"}</strong>
                      <span>{timeAgo(comment.created_at)}</span>
                    </div>
                    <p>{comment.body}</p>
                  </div>
                </div>
              ))}

              {comments.length === 0 && (
                <div className="comments-empty">
                  <MessageCircle size={24} />
                  <p>Be the first to share your thoughts!</p>
                </div>
              )}
            </div>

            {/* Related Videos */}
            {relatedVideos.length > 0 && (
              <div className="related-videos-section mt-4 pt-4 border-t border-border">
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Up Next
                </h4>
                <div className="related-list flex flex-col gap-3">
                  {relatedVideos.slice(0, 4).map((rel) => (
                    <button
                      key={rel.id}
                      className="related-item-card"
                      onClick={() => onSelectRelated && onSelectRelated(rel)}
                    >
                      <div className="related-thumb-holder">
                        <Play size={14} className="related-play-icon" />
                      </div>
                      <div className="related-info text-left">
                        <strong className="line-clamp-2 text-xs">{rel.title}</strong>
                        <small className="text-muted block text-xs">
                          {formatCount(rel.views_count)} views · {timeAgo(rel.published_at || rel.created_at)}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Playlist & Share Dialogs */}
        {showPlaylistDialog && userId && (
          <PlaylistDialog
            video={video}
            userId={userId}
            onClose={() => setShowPlaylistDialog(false)}
            notify={notify}
          />
        )}

        {showShareDialog && (
          <ShareDialog
            video={video}
            currentTime={currentTime}
            onClose={() => setShowShareDialog(false)}
            notify={notify}
          />
        )}

        {/* Web3 Monetization Modals */}
        {showTipModal && video.creator && (
          <TipCreatorModal
            creator={video.creator}
            wallet={
              wallet || {
                connected: false,
                address: null,
                chainId: null,
                balance: "0.00",
                walletName: "None",
              }
            }
            onWalletChange={onWalletChange || (() => {})}
            onClose={() => setShowTipModal(false)}
            notify={notify}
          />
        )}

        {showMembershipModal && video.creator && (
          <ChannelMembershipModal
            creator={video.creator}
            wallet={
              wallet || {
                connected: false,
                address: null,
                chainId: null,
                balance: "0.00",
                walletName: "None",
              }
            }
            onWalletChange={onWalletChange || (() => {})}
            onClose={() => setShowMembershipModal(false)}
            notify={notify}
          />
        )}

        {showPpvModal && (
          <PayPerViewModal
            video={video}
            creator={video.creator}
            wallet={
              wallet || {
                connected: false,
                address: null,
                chainId: null,
                balance: "0.00",
                walletName: "None",
              }
            }
            onWalletChange={onWalletChange || (() => {})}
            onClose={() => setShowPpvModal(false)}
            onUnlocked={() => {
              setIsPpvUnlocked(true);
              setShowPpvModal(false);
            }}
            notify={notify}
          />
        )}

        {/* Sound & Remix Drawer Modal */}
        {showSoundDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
            <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                    <Disc className="h-5 w-5 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-['Space_Grotesk'] line-clamp-1">
                      {video.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Sound by {video.creator?.display_name || video.creator?.username || "OmnPlay Creator"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSoundDrawer(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Waveform Visualizer */}
              <div className="my-5 rounded-xl border border-slate-800 bg-slate-950/90 p-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 mb-2">
                  <span>STEREO AUDIO // 48kHz OPUS</span>
                  <span>{formatDuration(video.duration_seconds || 0)}</span>
                </div>
                <div className="flex items-center gap-1 h-12">
                  {(soundWaveform.length > 0
                    ? soundWaveform
                    : Array.from({ length: 44 }, (_, i) => 0.15 + 0.7 * Math.sin(i * 0.35) ** 2)
                  ).map((peak, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-gradient-to-t from-cyan-500 to-rose-400 rounded-full transition-all"
                      style={{ height: `${Math.max(12, peak * 100)}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (onUseSound) onUseSound(video);
                  }}
                  className="flex items-center justify-between rounded-xl border border-cyan-500/50 bg-cyan-950/40 p-3.5 text-left transition hover:bg-cyan-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                      <Wand2 size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-cyan-300">Record Take with Camera</div>
                      <div className="text-[11px] text-slate-400">Duet, Chroma Key, Audio-reactive neon, or Lip-Sync</div>
                    </div>
                  </div>
                  <span className="rounded bg-cyan-500 px-2.5 py-1 text-[11px] font-bold text-slate-950">Launch</span>
                </button>

                <button
                  onClick={() => {
                    setShowSoundDrawer(false);
                    if (onOpenStudioWithSound) onOpenStudioWithSound(video);
                    else if (onUseSound) onUseSound(video);
                  }}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/60 p-3.5 text-left transition hover:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300">
                      <Layers size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-300">Remix in OmnPlay Studio</div>
                      <div className="text-[11px] text-slate-400">Place this sound on other clips in multi-track timeline</div>
                    </div>
                  </div>
                  <span className="rounded bg-indigo-500/20 px-2.5 py-1 text-[11px] font-bold text-indigo-300">Open</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
