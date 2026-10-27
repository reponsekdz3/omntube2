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
  Repeat,
  Send,
  Share2,
  Split,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatCount, supabase, timeAgo } from "../../lib/supabase";
import { avatarStyle, initials } from "../../lib/utils";
import type { CommentRow, Notice, Profile, VideoRow } from "../../types";
import { ShareDialog } from "../dialogs/ShareDialog";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeShort = shorts[currentIndex];

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

    // Track view in DB
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
        goNext();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, shorts.length]);

  const goNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setPlaying(true);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setPlaying(true);
    }
  };

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

  const toggleLike = async () => {
    if (!userId) {
      notify("Sign in to like this short.");
      return;
    }
    const shortId = activeShort.id;
    const isLiked = likedMap[shortId];

    if (isLiked) {
      const { error } = await supabase
        .from("video_reactions")
        .delete()
        .eq("video_id", shortId)
        .eq("user_id", userId);
      if (!error) {
        setLikedMap((prev) => ({ ...prev, [shortId]: false }));
        setLikesCountMap((prev) => ({
          ...prev,
          [shortId]: Math.max(0, (prev[shortId] || 1) - 1),
        }));
      }
    } else {
      const { error } = await supabase
        .from("video_reactions")
        .upsert({ video_id: shortId, user_id: userId, reaction: "like" });
      if (!error) {
        setLikedMap((prev) => ({ ...prev, [shortId]: true }));
        setLikesCountMap((prev) => ({
          ...prev,
          [shortId]: (prev[shortId] || 0) + 1,
        }));
      }
    }
  };

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      notify("Sign in to comment.");
      return;
    }
    const body = commentText.trim();
    if (!body || commentBusy) return;

    setCommentBusy(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ video_id: activeShort.id, user_id: userId, body })
      .select("id,body,user_id,created_at,video_id")
      .single();

    setCommentBusy(false);
    if (error) {
      notify("Could not post comment", error.message, "error");
    } else if (data) {
      setComments((prev) => [{ ...data, creator: profile }, ...prev]);
      setCommentText("");
    }
  };

  if (!shorts.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Clapperboard size={28} />
        </div>
        <h3>No shorts published yet</h3>
        <p>Omni Shorts features 9:16 vertical videos. Upload your short to reach thousands of viewers!</p>
        {onUploadShort && (
          <button className="btn btn-primary mt-3" onClick={onUploadShort}>
            <Clapperboard size={15} /> Upload First Short
          </button>
        )}
      </div>
    );
  }

  const isFollowing = followingIds.includes(activeShort.creator_id);

  // Playback URL helper
  const videoSrc = supabase.storage
    .from("omnitube-videos")
    .getPublicUrl(activeShort.video_path).data.publicUrl;

  return (
    <div className="shorts-reel-container">
      <div className="shorts-reel-viewport">
        {/* Navigation arrows */}
        <div className="shorts-nav-arrows">
          <button
            className="shorts-arrow-btn"
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="Previous Short"
          >
            <ChevronUp size={24} />
          </button>
          <button
            className="shorts-arrow-btn"
            onClick={goNext}
            disabled={currentIndex === shorts.length - 1}
            aria-label="Next Short"
          >
            <ChevronDown size={24} />
          </button>
        </div>

        {/* Video Card Frame */}
        <div className="shorts-phone-frame">
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            autoPlay
            loop
            muted={muted}
            onEnded={goNext}
            onClick={togglePlay}
            className="shorts-video-element"
          />

          {!playing && (
            <div className="shorts-paused-overlay" onClick={togglePlay}>
              <div className="play-burst">
                <Play size={40} fill="currentColor" />
              </div>
            </div>
          )}

          {/* Top Controls: Sound & Close */}
          <div className="shorts-top-bar">
            <button
              className="icon-btn tiny glass-btn"
              onClick={() => setMuted(!muted)}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {onClose && (
              <button
                className="icon-btn tiny glass-btn"
                onClick={onClose}
                aria-label="Exit shorts reel"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Bottom Meta */}
          <div className="shorts-meta-overlay">
            <div className="shorts-creator-row">
              <span
                className="avatar avatar-sm"
                style={avatarStyle(activeShort.creator)}
              >
                {!activeShort.creator?.avatar_url && initials(activeShort.creator)}
              </span>
              <strong className="text-sm font-semibold">
                {activeShort.creator?.display_name || "Creator"}
              </strong>
              {userId && activeShort.creator_id !== userId && (
                <button
                  className={`btn-follow-compact ${isFollowing ? "following" : ""}`}
                  onClick={() => onFollow(activeShort.creator_id)}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>

            <h3 className="shorts-title-line">{activeShort.title}</h3>
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

            {/* Sound Marquee & Vinyl Disc */}
            <div
              className="shorts-sound-banner"
              onClick={() => onUseSound?.(activeShort)}
              title="Use this sound"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
                padding: "4px 10px",
                borderRadius: "9999px",
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                cursor: "pointer",
                maxWidth: "85%",
              }}
            >
              <Music2 size={13} style={{ color: "#38bdf8", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeShort.title} · Original Sound
              </span>
              <Disc size={15} style={{ color: "#38bdf8", flexShrink: 0, animation: "spin 3s linear infinite" }} />
            </div>
          </div>

          {/* Action Rail */}
          <aside className="shorts-action-rail">
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

            {onUseSound && (
              <button
                className="rail-btn highlight-sound-btn"
                onClick={() => onUseSound(activeShort)}
                title="Use this sound / Duet video"
                style={{ color: "#38bdf8" }}
              >
                <Music2 size={24} />
                <span style={{ fontSize: "10px", fontWeight: 700 }}>Sound</span>
              </button>
            )}
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
      </div>

      {shareVideo && (
        <ShareDialog
          video={shareVideo}
          onClose={() => setShareVideo(null)}
          notify={notify}
        />
      )}
    </div>
  );
}
