import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  FolderPlus,
  Heart,
  Layers,
  ListVideo,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  Settings,
  Sparkles,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Tv,
  Upload,
  UserCheck,
  Users,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { formatCount, supabase, timeAgo } from "../../lib/supabase";
import { avatarStyle, formatDuration, formatWatchTime, initials } from "../../lib/utils";
import type {
  CommentRow,
  Notice,
  PlaylistRow,
  Profile,
  StudioTab,
  VideoRow,
  VideoViewRow,
} from "../../types";
import { EditVideoDialog } from "../dialogs/EditVideoDialog";
import { MonetizationHubTab } from "./MonetizationHubTab";
import { OmnPlayStudio } from "./OmnPlayStudio";
import type { WalletState } from "../../lib/web3";

export function CreatorStudio({
  user,
  profile,
  wallet,
  onProfileUpdated,
  onOpenUpload,
  onOpenLiveSetup,
  notify,
  onPlayVideo,
  initialTab,
  initialSoundVideo,
}: {
  user: any;
  profile: Profile | null;
  wallet?: WalletState;
  initialTab?: StudioTab;
  initialSoundVideo?: VideoRow | null;
  onProfileUpdated: (updated: Profile) => void;
  onOpenUpload: () => void;
  onOpenLiveSetup: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onPlayVideo: (v: VideoRow) => void;
}) {
  const [activeTab, setActiveTab] = useState<StudioTab>(
    initialSoundVideo ? "editor" : initialTab || "overview"
  );

  useEffect(() => {
    if (initialSoundVideo) {
      setActiveTab("editor");
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, initialSoundVideo]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [allComments, setAllComments] = useState<CommentRow[]>([]);
  const [viewsData, setViewsData] = useState<VideoViewRow[]>([]);
  const [followersCount, setFollowersCount] = useState(0);

  // Content tab filters
  const [contentFilterKind, setContentFilterKind] = useState<"all" | "video" | "short">("all");
  const [contentVisibility, setContentVisibility] = useState<"all" | "public" | "unlisted" | "private">("all");
  const [contentSearch, setContentSearch] = useState("");
  const [contentSort, setContentSort] = useState<"date" | "views" | "title">("date");
  const [editingVideo, setEditingVideo] = useState<VideoRow | null>(null);

  // Comments moderation tab
  const [commentFilterVideoId, setCommentFilterVideoId] = useState<string>("all");
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingMap, setReplyingMap] = useState<Record<string, boolean>>({});

  // Profile customization tab
  const [editDisplayName, setEditDisplayName] = useState(profile?.display_name || "");
  const [editUsername, setEditUsername] = useState(profile?.username || "");
  const [editBio, setEditBio] = useState(profile?.bio || "");
  const [editWebsite, setEditWebsite] = useState(profile?.website || "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(profile?.avatar_url || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Playlists tab state
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [newPlaylistVisibility, setNewPlaylistVisibility] = useState<"public" | "private">("public");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Live tab media preview test
  const [cameraPreviewActive, setCameraPreviewActive] = useState(false);
  const videoPreviewRef = React.useRef<HTMLVideoElement>(null);

  // Sync profile fields
  useEffect(() => {
    if (profile) {
      setEditDisplayName(profile.display_name || "");
      setEditUsername(profile.username || "");
      setEditBio(profile.bio || "");
      setEditWebsite(profile.website || "");
      setEditAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  // Load creator videos
  const loadVideos = useCallback(async () => {
    if (!user?.id) return;
    setLoadingVideos(true);
    const { data, error } = await supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at,updated_at,allow_comments,tags,video_reactions(count),comments(count)"
      )
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      notify("Could not load your videos", error.message, "error");
    } else {
      setVideos((data || []) as unknown as VideoRow[]);
    }
    setLoadingVideos(false);
  }, [user?.id, notify]);

  // Load playlists
  const loadPlaylists = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("playlists")
      .select("id,owner_id,title,description,visibility,created_at,updated_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setPlaylists(data as PlaylistRow[]);
  }, [user?.id]);

  // Load follower count
  const loadFollowers = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user.id);
    setFollowersCount(count || 0);
  }, [user?.id]);

  // Load views data for analytics
  const loadAnalytics = useCallback(async () => {
    if (!user?.id) return;
    const { data: vIds } = await supabase
      .from("videos")
      .select("id")
      .eq("creator_id", user.id);
    const ids = (vIds || []).map((v) => v.id);

    if (ids.length > 0) {
      const { data: views } = await supabase
        .from("video_views")
        .select("id,video_id,viewer_id,view_date,watch_seconds,source")
        .in("video_id", ids);
      if (views) setViewsData(views as VideoViewRow[]);

      // Load comments for moderation
      const { data: comms } = await supabase
        .from("comments")
        .select("id,body,user_id,created_at,video_id")
        .in("video_id", ids)
        .order("created_at", { ascending: false })
        .limit(100);

      if (comms && comms.length > 0) {
        const uIds = Array.from(new Set(comms.map((c) => c.user_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,bio,is_verified")
          .in("id", uIds);
        const map = new Map((profs || []).map((p: any) => [p.id, p]));
        setAllComments(
          comms.map((c: any) => ({
            ...c,
            creator: map.get(c.user_id),
          }))
        );
      }
    }
  }, [user?.id]);

  useEffect(() => {
    void loadVideos();
    void loadPlaylists();
    void loadFollowers();
    void loadAnalytics();
  }, [loadVideos, loadPlaylists, loadFollowers, loadAnalytics]);

  // Handle camera preview toggle
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (cameraPreviewActive && videoPreviewRef.current) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((s) => {
          stream = s;
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = s;
            videoPreviewRef.current.play();
          }
        })
        .catch(() => {
          notify("Camera or microphone permission was denied.", undefined, "error");
          setCameraPreviewActive(false);
        });
    }
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraPreviewActive, notify]);

  // Metric Computations
  const totalViews = useMemo(
    () => videos.reduce((acc, v) => acc + (v.views_count || 0), 0),
    [videos]
  );
  const totalWatchSeconds = useMemo(
    () => viewsData.reduce((acc, v) => acc + (v.watch_seconds || 0), 0),
    [viewsData]
  );
  const totalLikes = useMemo(
    () =>
      videos.reduce(
        (acc, v) => acc + Number(v.video_reactions?.[0]?.count || 0),
        0
      ),
    [videos]
  );
  const totalCommentsCount = useMemo(
    () =>
      videos.reduce(
        (acc, v) => acc + Number(v.comments?.[0]?.count || 0),
        0
      ),
    [videos]
  );

  // Quick visibility toggle
  const toggleVideoVisibility = async (v: VideoRow) => {
    const nextVis =
      v.visibility === "public"
        ? "unlisted"
        : v.visibility === "unlisted"
        ? "private"
        : "public";

    const { error } = await supabase
      .from("videos")
      .update({ visibility: nextVis, updated_at: new Date().toISOString() })
      .eq("id", v.id)
      .eq("creator_id", user.id);

    if (error) {
      notify("Could not update visibility", error.message, "error");
    } else {
      setVideos((all) =>
        all.map((item) => (item.id === v.id ? { ...item, visibility: nextVis } : item))
      );
      notify(`Visibility changed to ${nextVis}.`, undefined, "success");
    }
  };

  // Delete video
  const deleteVideo = async (v: VideoRow) => {
    if (
      !window.confirm(
        `Permanently delete "${v.title}"? This cannot be undone.`
      )
    )
      return;

    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", v.id)
      .eq("creator_id", user.id);

    if (error) {
      notify("Failed to delete video", error.message, "error");
      return;
    }

    // Clean up storage
    void supabase.storage.from("omnitube-videos").remove([v.video_path]);
    if (v.thumbnail_path) {
      void supabase.storage.from("omnitube-thumbnails").remove([v.thumbnail_path]);
    }

    setVideos((all) => all.filter((item) => item.id !== v.id));
    notify("Video deleted.", undefined, "success");
  };

  // Reply to comment
  const handleReplyComment = async (parentComment: CommentRow) => {
    const text = (replyTextMap[parentComment.id] || "").trim();
    if (!text || !parentComment.video_id) return;

    setReplyingMap((prev) => ({ ...prev, [parentComment.id]: true }));
    const { data, error } = await supabase
      .from("comments")
      .insert({
        video_id: parentComment.video_id,
        user_id: user.id,
        body: text,
        parent_comment_id: parentComment.id,
      })
      .select("id,body,user_id,created_at,video_id")
      .single();

    setReplyingMap((prev) => ({ ...prev, [parentComment.id]: false }));
    if (error) {
      notify("Could not send reply", error.message, "error");
    } else if (data) {
      setAllComments((all) => [{ ...data, creator: profile }, ...all]);
      setReplyTextMap((prev) => ({ ...prev, [parentComment.id]: "" }));
      notify("Reply published.", undefined, "success");
    }
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      notify("Could not delete comment", error.message, "error");
    } else {
      setAllComments((all) => all.filter((c) => c.id !== commentId));
      notify("Comment removed.");
    }
  };

  // Create playlist
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPlaylistTitle.trim();
    if (!title || creatingPlaylist) return;

    setCreatingPlaylist(true);
    const { data, error } = await supabase
      .from("playlists")
      .insert({
        owner_id: user.id,
        title,
        description: "",
        visibility: newPlaylistVisibility,
      })
      .select("id,owner_id,title,description,visibility,created_at,updated_at")
      .single();

    setCreatingPlaylist(false);
    if (error || !data) {
      notify("Failed to create playlist", error?.message, "error");
    } else {
      setPlaylists((prev) => [data as PlaylistRow, ...prev]);
      setNewPlaylistTitle("");
      notify(`Playlist "${title}" created.`, undefined, "success");
    }
  };

  // Delete playlist
  const deletePlaylist = async (playlistId: string) => {
    if (!window.confirm("Delete this playlist?")) return;
    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", playlistId)
      .eq("owner_id", user.id);

    if (error) {
      notify("Could not delete playlist", error.message, "error");
    } else {
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      notify("Playlist deleted.");
    }
  };

  // Save profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDisplayName.trim()) return;

    setSavingProfile(true);
    const cleanUsername = editUsername
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: editDisplayName.trim(),
        username: cleanUsername || null,
        bio: editBio.trim(),
        website: editWebsite.trim() || null,
        avatar_url: editAvatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id,username,display_name,avatar_url,bio,website,is_verified")
      .single();

    setSavingProfile(false);
    if (error) {
      notify("Profile could not be updated", error.message, "error");
    } else if (data) {
      onProfileUpdated(data as Profile);
      notify("Channel profile updated!", undefined, "success");
    }
  };

  // Filtered videos for Content tab
  const filteredVideos = useMemo(() => {
    return videos
      .filter((v) => {
        if (contentFilterKind !== "all" && v.kind !== contentFilterKind) return false;
        if (contentVisibility !== "all" && v.visibility !== contentVisibility) return false;
        if (
          contentSearch &&
          !v.title.toLowerCase().includes(contentSearch.toLowerCase()) &&
          !v.description?.toLowerCase().includes(contentSearch.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (contentSort === "views") return b.views_count - a.views_count;
        if (contentSort === "title") return a.title.localeCompare(b.title);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [videos, contentFilterKind, contentVisibility, contentSearch, contentSort]);

  return (
    <div className="studio-management-suite">
      {/* Studio Header */}
      <div className="studio-header-banner">
        <div className="studio-profile-lockup">
          <span className="avatar avatar-lg" style={avatarStyle(profile)}>
            {!profile?.avatar_url && initials(profile)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2>{profile?.display_name || "Creator Studio"}</h2>
              {profile?.is_verified && <span className="verified">✓</span>}
            </div>
            <p className="text-muted text-xs">
              {profile?.username ? `@${profile.username}` : user.email} · Creator Hub
            </p>
          </div>
        </div>

        <div className="studio-header-actions">
          <button className="btn btn-quiet" onClick={onOpenLiveSetup}>
            <Radio size={16} /> Broadcast Live
          </button>
          <button className="btn btn-primary" onClick={onOpenUpload}>
            <Plus size={16} /> Create Content
          </button>
        </div>
      </div>

      {/* Studio Navigation Tabs */}
      <nav className="studio-tab-bar" aria-label="Creator Studio Tabs">
        <button
          className={`studio-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <BarChart3 size={16} /> Overview
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "content" ? "active" : ""}`}
          onClick={() => setActiveTab("content")}
        >
          <Layers size={16} /> Content ({videos.length})
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          <TrendingUp size={16} /> Deep Analytics
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "monetization" ? "active" : ""}`}
          onClick={() => setActiveTab("monetization")}
        >
          <Coins size={16} /> Monetization & Web3
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "comments" ? "active" : ""}`}
          onClick={() => setActiveTab("comments")}
        >
          <MessageCircle size={16} /> Comments ({allComments.length})
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "playlists" ? "active" : ""}`}
          onClick={() => setActiveTab("playlists")}
        >
          <ListVideo size={16} /> Playlists ({playlists.length})
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "live" ? "active" : ""}`}
          onClick={() => setActiveTab("live")}
        >
          <Radio size={16} /> Live Control
        </button>
        <button
          className={`studio-tab-btn ${activeTab === "customization" ? "active" : ""}`}
          onClick={() => setActiveTab("customization")}
        >
          <Settings size={16} /> Channel Branding
        </button>
      </nav>

      {/* TAB: OMNPLAY TIMELINE & COMPRESSION STUDIO */}
      {activeTab === "editor" && (
        <OmnPlayStudio
          existingVideos={videos}
          initialSoundVideo={initialSoundVideo}
          wallet={wallet}
          notify={notify}
        />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="studio-tab-content">
          {/* Top Performance Cards */}
          <div className="grid grid-cols-4 gap-4 studio-metrics-row">
            <div className="studio-metric-card">
              <span className="metric-label">Total Views</span>
              <strong className="metric-val text-mint">{formatCount(totalViews)}</strong>
              <small className="text-muted">Lifetime video views</small>
            </div>
            <div className="studio-metric-card">
              <span className="metric-label">Estimated Watch Time</span>
              <strong className="metric-val text-blue">
                {formatWatchTime(totalWatchSeconds)}
              </strong>
              <small className="text-muted">From logged viewing sessions</small>
            </div>
            <div className="studio-metric-card">
              <span className="metric-label">Community Followers</span>
              <strong className="metric-val text-violet">
                {formatCount(followersCount)}
              </strong>
              <small className="text-muted">Subscribers to channel</small>
            </div>
            <div className="studio-metric-card">
              <span className="metric-label">Total Reactions</span>
              <strong className="metric-val text-coral">
                {formatCount(totalLikes + totalCommentsCount)}
              </strong>
              <small className="text-muted">
                {formatCount(totalLikes)} likes · {formatCount(totalCommentsCount)} comments
              </small>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="studio-quick-cards-grid mt-6">
            <div className="quick-action-card">
              <div className="quick-icon-wrap mint">
                <Upload size={22} />
              </div>
              <div>
                <strong>Publish Video or Short</strong>
                <p>Upload high-definition video with automatic frame extraction.</p>
              </div>
              <button className="btn btn-quiet" onClick={onOpenUpload}>
                Upload Media <ChevronDown size={14} />
              </button>
            </div>

            <div className="quick-action-card">
              <div className="quick-icon-wrap violet">
                <Radio size={22} />
              </div>
              <div>
                <strong>Start Live Broadcast</strong>
                <p>Stream with low-latency WebRTC and live interactive chat.</p>
              </div>
              <button className="btn btn-quiet" onClick={onOpenLiveSetup}>
                Go Live <ChevronDown size={14} />
              </button>
            </div>

            <div className="quick-action-card">
              <div className="quick-icon-wrap blue">
                <FolderPlus size={22} />
              </div>
              <div>
                <strong>Create Playlist Series</strong>
                <p>Organize your uploads into curated tracks for binge-watching.</p>
              </div>
              <button className="btn btn-quiet" onClick={() => setActiveTab("playlists")}>
                View Playlists <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Top Performing Videos Leaderboard */}
          <div className="studio-panel-box mt-6">
            <div className="studio-box-header">
              <div>
                <p className="eyebrow">CHANNEL HIGHLIGHTS</p>
                <h3>Top Performing Content</h3>
              </div>
              <button
                className="btn btn-quiet text-xs"
                onClick={() => setActiveTab("content")}
              >
                View all content →
              </button>
            </div>

            <div className="top-videos-table">
              {videos.slice(0, 5).map((v, i) => (
                <div key={v.id} className="top-video-row">
                  <span className="rank-num">#{i + 1}</span>
                  <div className="video-thumb-preview" onClick={() => onPlayVideo(v)}>
                    <Play size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong
                      className="cursor-pointer hover:text-mint truncate block text-sm"
                      onClick={() => onPlayVideo(v)}
                    >
                      {v.title}
                    </strong>
                    <small className="text-muted text-xs">
                      {v.kind.toUpperCase()} · {v.category} ·{" "}
                      {timeAgo(v.published_at || v.created_at)}
                    </small>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm block">
                      {formatCount(v.views_count)} views
                    </span>
                    <small className="text-muted text-xs">
                      {formatCount(Number(v.video_reactions?.[0]?.count || 0))} likes
                    </small>
                  </div>
                </div>
              ))}

              {videos.length === 0 && (
                <div className="p-8 text-center text-muted">
                  No videos uploaded yet. Click "Create Content" to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTENT MANAGER */}
      {activeTab === "content" && (
        <div className="studio-tab-content">
          {/* Controls Bar */}
          <div className="content-manager-controls">
            <div className="search-filter-wrap">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search uploads by title, description..."
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={contentFilterKind}
                onChange={(e) => setContentFilterKind(e.target.value as any)}
                className="studio-select"
              >
                <option value="all">All Formats</option>
                <option value="video">Standard Videos</option>
                <option value="short">Omni Shorts</option>
              </select>

              <select
                value={contentVisibility}
                onChange={(e) => setContentVisibility(e.target.value as any)}
                className="studio-select"
              >
                <option value="all">All Audiences</option>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>

              <select
                value={contentSort}
                onChange={(e) => setContentSort(e.target.value as any)}
                className="studio-select"
              >
                <option value="date">Latest Date</option>
                <option value="views">Most Views</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Videos Table */}
          <div className="content-table-wrap mt-4">
            <table className="content-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Visibility</th>
                  <th>Restrictions</th>
                  <th>Date</th>
                  <th>Views</th>
                  <th>Comments</th>
                  <th>Likes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="table-thumb cursor-pointer"
                          onClick={() => onPlayVideo(v)}
                        >
                          <Play size={14} />
                        </div>
                        <div className="min-w-0">
                          <strong
                            className="cursor-pointer hover:text-mint block truncate max-w-xs"
                            onClick={() => onPlayVideo(v)}
                          >
                            {v.title}
                          </strong>
                          <small className="text-muted text-xs">
                            {formatDuration(v.duration_seconds)} · {v.category}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        className={`visibility-badge ${v.visibility}`}
                        onClick={() => void toggleVideoVisibility(v)}
                        title="Click to cycle visibility"
                      >
                        {v.visibility}
                      </button>
                    </td>
                    <td>
                      <span className="text-xs text-muted">
                        {v.allow_comments !== false ? "None" : "Comments Off"}
                      </span>
                    </td>
                    <td className="text-xs text-muted">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-xs font-semibold">{formatCount(v.views_count)}</td>
                    <td className="text-xs text-muted">
                      {formatCount(Number(v.comments?.[0]?.count || 0))}
                    </td>
                    <td className="text-xs text-muted">
                      {formatCount(Number(v.video_reactions?.[0]?.count || 0))}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="icon-btn tiny"
                          title="Edit Details"
                          onClick={() => setEditingVideo(v)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="icon-btn tiny"
                          title="Copy Link"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              `${window.location.origin}/watch/${v.id}`
                            );
                            notify("Link copied!", undefined, "success");
                          }}
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          className="icon-btn tiny text-coral"
                          title="Delete"
                          onClick={() => void deleteVideo(v)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredVideos.length === 0 && (
              <div className="p-8 text-center text-muted">
                No videos match your active filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DEEP ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="studio-tab-content">
          <div className="analytics-banner-card">
            <h3>Channel Analytics Hub</h3>
            <p className="text-muted text-xs">
              Real metrics aggregated across viewer sessions and database records.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="analytics-card">
              <span className="text-muted text-xs uppercase tracking-wider block mb-1">
                Average Watch Time
              </span>
              <strong className="text-2xl font-bold text-mint">
                {viewsData.length > 0
                  ? formatDuration(
                      Math.round(totalWatchSeconds / viewsData.length)
                    )
                  : "0:00"}
              </strong>
              <small className="text-muted text-xs block mt-1">
                Per authenticated viewer view
              </small>
            </div>

            <div className="analytics-card">
              <span className="text-muted text-xs uppercase tracking-wider block mb-1">
                Engagement Rate
              </span>
              <strong className="text-2xl font-bold text-violet">
                {totalViews > 0
                  ? ((totalLikes / totalViews) * 100).toFixed(1) + "%"
                  : "0.0%"}
              </strong>
              <small className="text-muted text-xs block mt-1">
                Like-to-view interaction ratio
              </small>
            </div>

            <div className="analytics-card">
              <span className="text-muted text-xs uppercase tracking-wider block mb-1">
                Catalog Size
              </span>
              <strong className="text-2xl font-bold text-blue">
                {videos.filter((v) => v.kind === "video").length} Long-form ·{" "}
                {videos.filter((v) => v.kind === "short").length} Shorts
              </strong>
              <small className="text-muted text-xs block mt-1">
                {videos.filter((v) => v.visibility === "public").length} public in discovery
              </small>
            </div>
          </div>

          {/* Traffic Source Breakdown */}
          <div className="studio-panel-box mt-6">
            <div className="studio-box-header">
              <h3>Traffic Sources</h3>
              <small className="text-muted">By discovery surface</small>
            </div>
            <div className="traffic-sources-grid p-4 flex gap-6">
              <div className="traffic-bar-item flex-1">
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span>Discover Feed</span>
                  <span>
                    {viewsData.length > 0
                      ? Math.round(
                          (viewsData.filter((v) => v.source === "feed").length /
                            viewsData.length) *
                            100
                        )
                      : 70}
                    %
                  </span>
                </div>
                <div className="traffic-track">
                  <div
                    className="traffic-fill mint"
                    style={{
                      width: `${
                        viewsData.length > 0
                          ? (viewsData.filter((v) => v.source === "feed").length /
                              viewsData.length) *
                            100
                          : 70
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="traffic-bar-item flex-1">
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span>Omni Shorts Feed</span>
                  <span>
                    {viewsData.length > 0
                      ? Math.round(
                          (viewsData.filter((v) => v.source === "shorts").length /
                            viewsData.length) *
                            100
                        )
                      : 30}
                    %
                  </span>
                </div>
                <div className="traffic-track">
                  <div
                    className="traffic-fill coral"
                    style={{
                      width: `${
                        viewsData.length > 0
                          ? (viewsData.filter((v) => v.source === "shorts").length /
                              viewsData.length) *
                            100
                          : 30
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MONETIZATION & WEB3 HUB */}
      {activeTab === "monetization" && (
        <div className="studio-tab-content">
          <MonetizationHubTab
            creatorId={user.id}
            wallet={
              wallet || {
                connected: false,
                address: null,
                chainId: null,
                balance: "0.00",
                walletName: "None",
              }
            }
            videos={videos}
            notify={notify}
          />
        </div>
      )}

      {/* TAB 4: COMMENTS MODERATION */}
      {activeTab === "comments" && (
        <div className="studio-tab-content">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3>Viewer Comments Moderation</h3>
              <p className="text-muted text-xs">
                Manage replies and moderate comments posted across your uploads.
              </p>
            </div>

            <select
              value={commentFilterVideoId}
              onChange={(e) => setCommentFilterVideoId(e.target.value)}
              className="studio-select"
            >
              <option value="all">All Videos</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title.slice(0, 30)}...
                </option>
              ))}
            </select>
          </div>

          <div className="comment-moderation-list">
            {allComments
              .filter(
                (c) =>
                  commentFilterVideoId === "all" ||
                  c.video_id === commentFilterVideoId
              )
              .map((c) => {
                const targetVideo = videos.find((v) => v.id === c.video_id);
                return (
                  <div key={c.id} className="moderation-comment-card">
                    <div className="flex items-start gap-3">
                      <span
                        className="avatar avatar-sm"
                        style={avatarStyle(c.creator)}
                      >
                        {!c.creator?.avatar_url && initials(c.creator)}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <strong>{c.creator?.display_name || "Viewer"}</strong>
                          <span className="text-muted text-xs">
                            {timeAgo(c.created_at)}
                          </span>
                          {targetVideo && (
                            <span className="on-video-tag">
                              on "{targetVideo.title.slice(0, 25)}..."
                            </span>
                          )}
                        </div>
                        <p className="comment-body-text mt-1">{c.body}</p>

                        {/* Inline Reply Form */}
                        <div className="inline-reply-box mt-2">
                          <input
                            type="text"
                            placeholder="Reply as creator..."
                            value={replyTextMap[c.id] || ""}
                            onChange={(e) =>
                              setReplyTextMap({
                                ...replyTextMap,
                                [c.id]: e.target.value,
                              })
                            }
                            maxLength={500}
                          />
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => void handleReplyComment(c)}
                            disabled={
                              replyingMap[c.id] || !(replyTextMap[c.id] || "").trim()
                            }
                          >
                            <Send size={13} /> Reply
                          </button>
                        </div>
                      </div>

                      <button
                        className="icon-btn tiny text-coral"
                        title="Delete comment"
                        onClick={() => void deleteComment(c.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}

            {allComments.length === 0 && (
              <div className="p-8 text-center text-muted">
                No comments received across your uploads yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PLAYLISTS & SERIES */}
      {activeTab === "playlists" && (
        <div className="studio-tab-content">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3>Playlists & Series Collections</h3>
              <p className="text-muted text-xs">
                Group videos into serialized courses, playlists, or albums.
              </p>
            </div>
          </div>

          {/* New Playlist Form */}
          <form onSubmit={handleCreatePlaylist} className="create-playlist-bar">
            <input
              type="text"
              placeholder="New playlist name..."
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
              required
              maxLength={100}
            />
            <select
              value={newPlaylistVisibility}
              onChange={(e) => setNewPlaylistVisibility(e.target.value as any)}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingPlaylist || !newPlaylistTitle.trim()}
            >
              <Plus size={15} /> Create Collection
            </button>
          </form>

          {/* Playlist Cards Grid */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {playlists.map((pl) => (
              <div key={pl.id} className="studio-playlist-card">
                <div className="playlist-icon-banner">
                  <ListVideo size={28} />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm">{pl.title}</strong>
                    <span className="text-xs text-muted uppercase">
                      {pl.visibility}
                    </span>
                  </div>
                  <small className="text-muted text-xs block mt-1">
                    Created {new Date(pl.created_at).toLocaleDateString()}
                  </small>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <button
                      className="text-coral text-xs flex items-center gap-1 hover:underline"
                      onClick={() => void deletePlaylist(pl.id)}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {playlists.length === 0 && (
              <div className="col-span-3 p-8 text-center text-muted">
                You haven't created any custom playlists yet. Use the form above to start one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: LIVE BROADCAST CONTROL */}
      {activeTab === "live" && (
        <div className="studio-tab-content">
          <div className="studio-panel-box">
            <div className="studio-box-header">
              <div>
                <p className="eyebrow">LIVE MEDIA SUITE</p>
                <h3>WebRTC & LiveKit Broadcast Control</h3>
              </div>
              <button className="btn btn-primary" onClick={onOpenLiveSetup}>
                <Radio size={16} /> Setup New Live Stream
              </button>
            </div>

            <div className="live-studio-grid p-6 grid grid-cols-2 gap-6">
              <div>
                <h4>Hardware & Feed Preview</h4>
                <p className="text-muted text-xs mb-4">
                  Test your video input and microphone levels before going on air.
                </p>

                <div className="live-preview-box">
                  {cameraPreviewActive ? (
                    <video
                      ref={videoPreviewRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="preview-placeholder">
                      <Radio size={36} className="text-muted mb-2" />
                      <p className="text-xs text-muted">Preview camera is off</p>
                    </div>
                  )}
                </div>

                <button
                  className={`btn full mt-3 ${cameraPreviewActive ? "btn-quiet" : "btn-primary"}`}
                  onClick={() => setCameraPreviewActive(!cameraPreviewActive)}
                >
                  {cameraPreviewActive ? "Turn Off Preview" : "Test Camera & Mic"}
                </button>
              </div>

              <div>
                <h4>OBS / External Encoder Settings</h4>
                <p className="text-muted text-xs mb-4">
                  Stream using RTMP or LiveKit egress to broadcast high-fidelity desktop games or workflows.
                </p>

                <div className="server-info-card">
                  <label>RTMP Ingest Server</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      readOnly
                      value="rtmp://live.omnitube.video/live"
                      className="studio-input"
                    />
                    <button
                      className="btn btn-quiet"
                      onClick={() => {
                        void navigator.clipboard.writeText("rtmp://live.omnitube.video/live");
                        notify("Server URL copied!", undefined, "success");
                      }}
                    >
                      <Copy size={15} />
                    </button>
                  </div>

                  <label>Stream Key (Authorized)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      readOnly
                      value={`omni_sk_${user?.id?.slice(0, 16)}`}
                      className="studio-input"
                    />
                    <button
                      className="btn btn-quiet"
                      onClick={() => {
                        void navigator.clipboard.writeText(`omni_sk_${user?.id?.slice(0, 16)}`);
                        notify("Stream key copied!", undefined, "success");
                      }}
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CHANNEL BRANDING & SETTINGS */}
      {activeTab === "customization" && (
        <div className="studio-tab-content">
          <form onSubmit={handleSaveProfile} className="channel-customization-form">
            <div className="studio-panel-box p-6">
              <div className="studio-box-header mb-4">
                <div>
                  <p className="eyebrow">CHANNEL BRANDING</p>
                  <h3>Basic Channel Info</h3>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field wide">
                  <label>Channel Display Name *</label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    required
                    maxLength={60}
                    placeholder="Your creator or brand name"
                  />
                </div>

                <div className="form-field">
                  <label>Channel Handle (@username)</label>
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    maxLength={30}
                    placeholder="e.g. techlead"
                  />
                </div>

                <div className="form-field">
                  <label>Website / Social URL</label>
                  <input
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="form-field wide">
                  <label>Avatar / Profile Image URL</label>
                  <input
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>

                <div className="form-field wide">
                  <label>Channel Bio / About</label>
                  <textarea
                    rows={4}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={1000}
                    placeholder="Describe what viewers will find on your channel."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingProfile || !editDisplayName.trim()}
                >
                  {savingProfile ? "Saving..." : <><Check size={16} /> Save Changes</>}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Edit Video Dialog */}
      {editingVideo && (
        <EditVideoDialog
          video={editingVideo}
          userId={user.id}
          onClose={() => setEditingVideo(null)}
          onUpdated={() => void loadVideos()}
          notify={notify}
        />
      )}
    </div>
  );
}
