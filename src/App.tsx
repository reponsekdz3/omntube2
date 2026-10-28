import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownUp,
  BadgeCheck,
  Bell,
  BookmarkPlus,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clapperboard,
  Clock,
  Code2,
  Coins,
  Compass,
  Cpu,
  ExternalLink,
  Eye,
  Film,
  Flame,
  Gamepad2,
  Heart,
  History,
  Home,
  Layers,
  Library,
  ListMusic,
  Lock,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  MonitorPlay,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Radio,
  Repeat2,
  Search,
  Send,
  Settings,
  Share2,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Unlock,
  Upload,
  Users,
  Video as VideoIcon,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import { WebRTCBroadcaster, WebRTCViewer } from "./lib/webrtc";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  formatCount,
  isSupabaseConfigured,
  storagePublicUrl,
  supabase,
  supabaseUrl,
  timeAgo,
} from "./lib/supabase";
import { avatarStyle, formatDuration, initials } from "./lib/utils";
import type {
  Notice,
  NotificationRow,
  PostRow,
  Profile,
  Section,
  StreamMessage,
  StreamRow,
  StudioTab,
  VideoRow,
} from "./types";
import { AdvancedVideoPlayer } from "./components/player/AdvancedVideoPlayer";
import { ShortsReel } from "./components/shorts/ShortsReel";
import { CreatorStudio } from "./components/studio/CreatorStudio";
import { LibraryView } from "./components/library/LibraryView";
import { CommunityFeed } from "./components/community/CommunityFeed";
import { UploadDialog } from "./components/dialogs/UploadDialog";
import { PlaylistDialog } from "./components/dialogs/PlaylistDialog";
import { ShareDialog } from "./components/dialogs/ShareDialog";
import { SearchFilterBar, type SearchFilters } from "./components/search/SearchFilterDrawer";
import { Web3WalletBar } from "./components/monetization/Web3WalletBar";
import { SuperChatModal, type SuperChatMessage } from "./components/monetization/SuperChatModal";
import { formatAddress, type WalletState } from "./lib/web3";
import {
  AdvancedSettingsModal,
  loadStoredSettings,
  type AppSettings,
} from "./components/settings/AdvancedSettingsModal";
import { OmnPlayCameraSuite } from "./components/camera/OmnPlayCameraSuite";
import { AuthModal } from "./components/auth/AuthModal";
import { useAppRouter, navigateTo } from "./lib/router";

const NAV: { id: Section; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Discover", icon: Home },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "shorts", label: "OmnPlay Shorts", icon: Clapperboard },
  { id: "live", label: "Live now", icon: Radio },
  { id: "subscriptions", label: "Following", icon: Users },
  { id: "posts", label: "Community", icon: MessageCircle },
  { id: "library", label: "Your library", icon: Library },
];

const TOPIC_CHANNELS = [
  { id: "gaming", label: "Gaming", query: "gaming", icon: Gamepad2 },
  { id: "crypto", label: "Crypto & Web3", query: "crypto web3", icon: Coins },
  { id: "tech", label: "Tech & Code", query: "code programming technology", icon: Code2 },
  { id: "music", label: "Music & Audio", query: "music song soundtrack", icon: Music2 },
  { id: "ai", label: "AI & Science", query: "ai machine learning neural", icon: Cpu },
  { id: "esports", label: "Live Esports", query: "tournament live stream", icon: Flame },
];

const titleFor: Record<Section, string> = {
  home: "Discover",
  trending: "Trending",
  shorts: "OmnPlay Shorts",
  live: "Live now",
  subscriptions: "Following",
  posts: "Community",
  library: "Your library",
  notifications: "Notifications",
  studio: "OmnPlay Studio Pro",
};

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}

function Modal({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  useEscape(onClose);
  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={"modal-panel " + className} role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  );
}

function AuthDialog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  useEscape(onClose);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      notify("Enter a valid email address.", undefined, "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      notify("Sign-in could not start", error.message, "error");
    } else {
      notify("Check your inbox", "A secure sign-in magic link is on its way.", "success");
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} className="auth-modal">
      <div className="auth-art">
        <div className="brand-mark large">
          <span>O</span>
        </div>
        <p className="eyebrow">YOUR CREATOR UNIVERSE</p>
        <h2>
          Make room for
          <br />
          <span>what moves you.</span>
        </h2>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </div>
      <div className="auth-content">
        <button className="icon-btn close-modal" onClick={onClose} aria-label="Close">
          <X />
        </button>
        <p className="eyebrow">WELCOME TO OMNITUBE</p>
        <h2>
          Your account.
          <br />
          Your whole world.
        </h2>
        <p className="muted">Sign in with a magic link. No password to remember.</p>
        <form onSubmit={submit} className="stack-form">
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="btn btn-primary full" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" /> Sending link…
              </>
            ) : (
              <>
                Email me a sign-in link <Send size={16} />
              </>
            )}
          </button>
        </form>
        <p className="fine-print">
          By continuing, you agree to use OmnPlay respectfully and follow the community guidelines.
        </p>
      </div>
    </Modal>
  );
}

function ReportDialog({
  targetType,
  targetId,
  userId,
  onClose,
  notify,
}: {
  targetType: "video" | "post";
  targetId: string;
  userId: string;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim(),
    });
    setBusy(false);
    if (error) {
      notify("Report could not be submitted", error.message, "error");
    } else {
      notify(
        "Report received",
        "Thank you. Your report has been recorded for review.",
        "success"
      );
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} className="report-modal">
      <div className="modal-heading">
        <div>
          <p className="eyebrow">COMMUNITY SAFETY</p>
          <h2>Report this {targetType === "video" ? "video" : "post"}.</h2>
          <p className="muted">Tell us what looks wrong. Reports are private and reviewed.</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close report form">
          <X />
        </button>
      </div>
      <form className="stack-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="report-reason">Reason for report</label>
        <select
          id="report-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        >
          <option value="spam">Spam or scams</option>
          <option value="harassment">Harassment or bullying</option>
          <option value="hate">Hateful or abusive content</option>
          <option value="violence">Violence or dangerous acts</option>
          <option value="sexual_content">Sexual content</option>
          <option value="copyright">Copyright concern</option>
          <option value="misinformation">Misleading misinformation</option>
          <option value="other">Something else</option>
        </select>
        <label htmlFor="report-details">Details (optional)</label>
        <textarea
          id="report-details"
          rows={4}
          maxLength={2000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Add context that helps a reviewer understand the concern."
        />
        <div className="modal-footer">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            <ShieldAlert size={15} /> {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LiveRoomPane({
  stream,
  token,
  serverUrl,
  broadcaster,
  userId,
  profile,
  wallet,
  onWalletChange,
  onClose,
  notify,
}: {
  stream: StreamRow;
  token: string;
  serverUrl: string;
  broadcaster: boolean;
  userId: string;
  profile: Profile | null;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const broadcasterRef = useRef<WebRTCBroadcaster | null>(null);
  const viewerRef = useRef<WebRTCViewer | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [viewerCount, setViewerCount] = useState(1);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [busy, setBusy] = useState(true);
  const [chatMessages, setChatMessages] = useState<StreamMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [showSuperChatModal, setShowSuperChatModal] = useState(false);
  const [superChats, setSuperChats] = useState<SuperChatMessage[]>([]);

  // Load superchats from Cloud SQL
  useEffect(() => {
    let active = true;
    async function loadSuperChats() {
      try {
        const res = await fetch(`/api/monetization/superchats/${stream.id}`);
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data)) {
            setSuperChats(data);
          }
        }
      } catch (err) {
        console.warn("Failed to load stream superchats:", err);
      }
    }
    void loadSuperChats();
    return () => {
      active = false;
    };
  }, [stream.id]);

  useEffect(() => {
    let chatActive = true;
    const loadChat = async () => {
      const { data, error } = await supabase
        .from("stream_messages")
        .select("id,stream_id,user_id,body,created_at")
        .eq("stream_id", stream.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!chatActive || error || !data) return;
      const rows = [...data].reverse() as StreamMessage[];
      const ids = Array.from(new Set(rows.map((row) => row.user_id)));
      const people = ids.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,bio,is_verified")
            .in("id", ids)
        : { data: [] as Profile[] };
      const profiles = new Map((people.data || []).map((person) => [person.id, person]));
      if (chatActive) {
        setChatMessages(
          rows.map((row) => ({
            ...row,
            author: profiles.get(row.user_id) || null,
          }))
        );
      }
    };
    void loadChat();

    const chatChannel = supabase
      .channel("omnitube-live-chat-" + stream.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_messages",
          filter: "stream_id=eq." + stream.id,
        },
        async (event) => {
          const row = event.new as StreamMessage;
          const { data: author } = await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,bio,is_verified")
            .eq("id", row.user_id)
            .maybeSingle();
          if (chatActive) {
            setChatMessages((old) =>
              old.some((item) => item.id === row.id)
                ? old
                : [...old, { ...row, author: author as Profile | null }].slice(-100)
            );
          }
        }
      )
      .subscribe();

    // Initialize Direct WebRTC Engine
    if (broadcaster) {
      const b = new WebRTCBroadcaster(stream.id, userId);
      broadcasterRef.current = b;
      b.onAudioLevel = (level) => setAudioLevel(level);
      b.onViewerCountChange = (count) => setViewerCount(Math.max(1, count + 1));

      b.startCamera("user")
        .then((mediaStream) => {
          if (videoElRef.current) {
            videoElRef.current.srcObject = mediaStream;
            videoElRef.current.play().catch(() => {});
          }
          b.connectSignaling();
          setConnected(true);
          setBusy(false);
          notify("WebRTC Broadcast Active", "Ultra-low latency streaming with STUN signaling.", "success");
        })
        .catch((err) => {
          console.warn("Direct WebRTC local camera error:", err);
          notify("Camera Notice", err.message || "Failed to start camera.", "error");
          setBusy(false);
        });
    } else {
      const v = new WebRTCViewer(stream.id, userId || crypto.randomUUID());
      viewerRef.current = v;
      v.onTrackReceived = (remoteStream) => {
        if (videoElRef.current) {
          videoElRef.current.srcObject = remoteStream;
          videoElRef.current.play().catch(() => {});
        }
        setConnected(true);
        setBusy(false);
      };
      v.onConnectionStateChange = (state) => {
        if (state === "connected") {
          setConnected(true);
          setBusy(false);
        }
      };
      v.onLiveStatusChange = (isLive) => {
        if (!isLive) {
          notify("Stream ended", "The broadcaster has ended the live stream.", "info");
          setConnected(false);
        }
      };
      v.connect();
      // Safety timeout for busy spinner
      const timeout = setTimeout(() => setBusy(false), 3000);
      return () => {
        clearTimeout(timeout);
        chatActive = false;
        void supabase.removeChannel(chatChannel);
        v.disconnect();
        viewerRef.current = null;
      };
    }

    return () => {
      chatActive = false;
      void supabase.removeChannel(chatChannel);
      if (broadcasterRef.current) {
        broadcasterRef.current.stop();
        broadcasterRef.current = null;
      }
      if (viewerRef.current) {
        viewerRef.current.disconnect();
        viewerRef.current = null;
      }
    };
  }, [serverUrl, token, broadcaster, notify, stream.id, userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages.length]);

  const toggleMic = () => {
    if (!broadcasterRef.current?.localStream) return;
    const audioTrack = broadcasterRef.current.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    if (!broadcasterRef.current?.localStream) return;
    const videoTrack = broadcasterRef.current.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const toggleCameraFacing = async () => {
    if (!broadcasterRef.current) return;
    try {
      const next = await broadcasterRef.current.toggleCamera();
      setFacingMode(next);
      if (videoElRef.current && broadcasterRef.current.localStream) {
        videoElRef.current.srcObject = broadcasterRef.current.localStream;
      }
      notify("Camera switched", `Now using ${next === "user" ? "Front" : "Rear"} camera`, "info");
    } catch (err: any) {
      notify("Camera error", err.message, "error");
    }
  };

  const toggleScreenSharing = async () => {
    if (!broadcasterRef.current) return;
    try {
      if (isScreenSharing) {
        await broadcasterRef.current.stopScreenShare();
        setIsScreenSharing(false);
        if (videoElRef.current && broadcasterRef.current.localStream) {
          videoElRef.current.srcObject = broadcasterRef.current.localStream;
        }
        notify("Screen sharing stopped", "Returned to camera", "info");
      } else {
        const screenStream = await broadcasterRef.current.startScreenShare();
        setIsScreenSharing(true);
        if (videoElRef.current) {
          videoElRef.current.srcObject = screenStream;
        }
        notify("Screen sharing active", "Streaming screen in real time over WebRTC", "success");
      }
    } catch (err: any) {
      notify("Screen share error", err.message, "error");
    }
  };

  const sendChatMessage = async (event: FormEvent) => {
    event.preventDefault();
    const body = chatInput.trim();
    if (!body || chatSending || !userId) return;
    setChatSending(true);
    const { data, error } = await supabase
      .from("stream_messages")
      .insert({ stream_id: stream.id, user_id: userId, body })
      .select("id,stream_id,user_id,body,created_at")
      .single();
    setChatSending(false);
    if (error) {
      notify("Message not sent", error.message, "error");
    } else if (data) {
      setChatMessages((old) =>
        old.some((item) => item.id === data.id)
          ? old
          : [...old, { ...data, author: profile }].slice(-100)
      );
      setChatInput("");
    }
  };

  const leave = async () => {
    if (broadcasterRef.current) {
      broadcasterRef.current.stop();
      broadcasterRef.current = null;
      if (stream.id && userId) {
        await supabase
          .from("live_streams")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", stream.id);
      }
    }
    if (viewerRef.current) {
      viewerRef.current.disconnect();
      viewerRef.current = null;
    }
    onClose();
  };

  return (
    <Modal onClose={() => void leave()} className="live-room-modal">
      <div className="live-room-top">
        <div className="live-status">
          <span className={connected ? "live-dot" : "live-dot muted-dot"} />
          {connected ? "LIVE · WEBRTC REALTIME" : "CONNECTING WEBRTC"}
          <span className="live-viewer-title">{stream.title}</span>
        </div>
        <button className="icon-btn" onClick={() => void leave()} aria-label="Leave stream">
          <X />
        </button>
      </div>
      <div className="live-stage">
        <div className="live-video-stage relative overflow-hidden" ref={mediaRef}>
          <video
            ref={videoElRef}
            autoPlay
            playsInline
            muted={broadcaster}
            className="room-video w-full h-full object-cover rounded-2xl"
          />

          {/* Broadcaster Telemetry & Real-Time Audio VU Meter */}
          {broadcaster && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
              <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 pointer-events-auto shadow-lg">
                <Volume2 size={14} className={audioLevel > 10 ? "text-emerald-400" : "text-slate-400"} />
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden flex items-center">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-300 tabular-nums">{audioLevel}%</span>
              </div>

              <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] font-mono text-white font-bold">
                  {viewerCount} {viewerCount === 1 ? "viewer" : "viewers"}
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                  WebRTC &lt;200ms
                </span>
              </div>
            </div>
          )}

          {busy && (
            <div className="room-placeholder absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center">
              <span className="spinner" />
              <p className="mt-3 text-xs text-slate-300">
                {broadcaster ? "Acquiring camera & WebRTC STUN signaling…" : "Connecting WebRTC peer stream…"}
              </p>
            </div>
          )}
          {!busy && !connected && !broadcaster && (
            <div className="room-placeholder absolute inset-0 z-20 bg-slate-950/90 flex flex-col items-center justify-center">
              <Radio size={30} className="text-slate-500" />
              <p className="mt-3 text-xs text-slate-300">Waiting for broadcaster WebRTC stream to begin…</p>
            </div>
          )}
        </div>
        <aside className="live-side-panel">
          <div className="live-chat-heading">
            <Radio size={17} />
            <strong>Live chat</strong>
            <span>{chatMessages.length}</span>
          </div>

          {/* SuperChat Pinned Marquee */}
          {superChats.length > 0 && (
            <div className="superchat-pinned-marquee">
              {superChats.slice(0, 3).map((sc) => (
                <div key={sc.id} className={`superchat-pinned-chip tier-${sc.colorTier}`}>
                  <div className="flex items-center justify-between text-2xs mb-0.5">
                    <span className="font-mono font-bold text-white">
                      {formatAddress(sc.senderAddress)}
                    </span>
                    <span className="sc-amount-tag font-mono font-bold">
                      {sc.amount} {sc.tokenSymbol}
                    </span>
                  </div>
                  <p className="sc-msg-text">{sc.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="live-chat-messages" aria-live="polite">
            {chatMessages.map((message) => (
              <article className="live-chat-message" key={message.id}>
                <span
                  className="avatar avatar-sm"
                  style={avatarStyle(message.author || (message.user_id === userId ? profile : null))}
                >
                  {!message.author?.avatar_url &&
                    initials(message.author || (message.user_id === userId ? profile : null))}
                </span>
                <div>
                  <div className="live-chat-byline">
                    <strong>
                      {message.author?.display_name ||
                        (message.user_id === userId ? profile?.display_name : null) ||
                        "Creator"}
                    </strong>
                    <small>{timeAgo(message.created_at)}</small>
                  </div>
                  <p>{message.body}</p>
                </div>
              </article>
            ))}
            {chatMessages.length === 0 && (
              <div className="live-chat-empty">
                <MessageCircle size={19} />
                <p>The room is open. Start the conversation.</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form className="live-chat-compose" onSubmit={(event) => void sendChatMessage(event)}>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              maxLength={1000}
              placeholder={
                stream.status === "live" ? "Message the live room…" : "Chat is unavailable"
              }
              aria-label="Live chat message"
            />
            <button
              className="icon-btn"
              type="submit"
              disabled={chatSending || !chatInput.trim() || stream.status !== "live"}
              aria-label="Send live chat message"
            >
              <Send size={15} />
            </button>
            <button
              type="button"
              className="superchat-trigger-btn"
              onClick={() => setShowSuperChatModal(true)}
              title="Send Web3 SuperChat"
              disabled={stream.status !== "live"}
            >
              <Flame size={15} />
            </button>
          </form>
          <div className="live-room-tools flex flex-col gap-2">
            {broadcaster && (
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  className={"btn " + (micOn ? "btn-quiet" : "btn-danger")}
                  onClick={toggleMic}
                >
                  <Mic size={15} /> {micOn ? "Mute mic" : "Unmute mic"}
                </button>
                <button
                  type="button"
                  className={"btn " + (cameraOn ? "btn-quiet" : "btn-danger")}
                  onClick={toggleCamera}
                >
                  <Camera size={15} /> {cameraOn ? "Camera off" : "Camera on"}
                </button>
                <button
                  type="button"
                  className={"btn " + (isScreenSharing ? "btn-primary" : "btn-quiet")}
                  onClick={() => void toggleScreenSharing()}
                  title="Share Screen via WebRTC"
                >
                  <MonitorPlay size={15} /> {isScreenSharing ? "Stop sharing" : "Share screen"}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => void toggleCameraFacing()}
                  title="Flip Front / Rear Camera"
                >
                  <Repeat2 size={15} /> Flip {facingMode === "user" ? "Rear" : "Front"}
                </button>
              </div>
            )}
            <button className="btn btn-danger full" onClick={() => void leave()}>
              {broadcaster ? "End WebRTC broadcast" : "Leave stream"}
            </button>
          </div>
        </aside>
      </div>

      {showSuperChatModal && (
        <SuperChatModal
          streamId={stream.id}
          streamTitle={stream.title}
          creatorId={stream.creator_id}
          creatorName={stream.creator?.display_name || "Broadcaster"}
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
          onClose={() => setShowSuperChatModal(false)}
          onSuperChatSent={(newSc) => {
            setSuperChats((prev) => [newSc, ...prev]);
          }}
          notify={notify}
        />
      )}
    </Modal>
  );
}

function VideoCard({
  video,
  onPlay,
  onLike,
  onSave,
  onShare,
  onReport,
  following,
  onFollow,
  trendingRank,
  onUseSound,
}: {
  video: VideoRow;
  onPlay: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onReport: () => void;
  following: boolean;
  onFollow: () => void;
  trendingRank?: number;
  onUseSound?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [thumbUrl, setThumbUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (video.thumbnail_path) {
      if (video.thumbnail_path.startsWith("http")) {
        setThumbUrl(video.thumbnail_path);
      } else {
        supabase.storage
          .from("omnitube-thumbnails")
          .createSignedUrl(video.thumbnail_path, 3600)
          .then(({ data }) => {
            if (active && data?.signedUrl) setThumbUrl(data.signedUrl);
          });
      }
    }
    return () => {
      active = false;
    };
  }, [video.thumbnail_path]);

  return (
    <article className={"video-card " + (video.kind === "short" ? "short-card" : "")}>
      <button className="thumbnail-button" onClick={onPlay} aria-label={"Play " + video.title}>
        <div
          className="video-thumbnail"
          style={thumbUrl ? { backgroundImage: "url(" + thumbUrl + ")" } : undefined}
        >
          {trendingRank && (
            <span className={`trending-rank-tag rank-${trendingRank}`}>
              #{trendingRank}
            </span>
          )}
          {!thumbUrl && (
            <div className="thumbnail-orb">
              <VideoIcon size={28} />
            </div>
          )}
          <span className="play-overlay">
            <Play size={24} fill="currentColor" />
          </span>
          {video.kind === "short" && (
            <span className="format-badge">
              <Clapperboard size={12} /> SHORT
            </span>
          )}
          <span className="duration">
            {video.duration_seconds
              ? formatDuration(video.duration_seconds)
              : video.kind === "short"
              ? "SHORT"
              : "VIDEO"}
          </span>
        </div>
      </button>
      <div className="video-meta">
        <button
          className="avatar-button"
          onClick={onFollow}
          title={following ? "Following creator" : "Follow creator"}
        >
          <span className="avatar avatar-md" style={avatarStyle(video.creator)}>
            {!video.creator?.avatar_url && initials(video.creator)}
          </span>
        </button>
        <div className="video-copy">
          <button className="video-title" onClick={onPlay}>
            {video.title}
          </button>
          <button className="creator-line" onClick={onFollow}>
            {video.creator?.display_name || "Creator"}{" "}
            {video.creator?.is_verified && <span className="verified">✓</span>}
          </button>
          <p className="video-stats">
            {formatCount(video.views_count)} views <span>·</span>{" "}
            {timeAgo(video.published_at || video.created_at)}
          </p>
        </div>
        <div className="card-menu-wrap">
          <button
            className="icon-btn tiny"
            aria-label="More video actions"
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal size={20} />
          </button>
          {menu && (
            <div className="action-menu">
              <button
                onClick={() => {
                  onSave();
                  setMenu(false);
                }}
              >
                <BookmarkPlus size={16} /> Save to Playlist
              </button>
              <button
                onClick={() => {
                  onLike();
                  setMenu(false);
                }}
              >
                <ThumbsUp size={16} /> Like video
              </button>
              <button
                onClick={() => {
                  onShare();
                  setMenu(false);
                }}
              >
                <Share2 size={16} /> Share video
              </button>
              {onUseSound && (
                <button
                  onClick={() => {
                    onUseSound();
                    setMenu(false);
                  }}
                  style={{ color: "#38bdf8" }}
                >
                  <Music2 size={16} /> Use sound & Duet
                </button>
              )}
              <button
                onClick={() => {
                  onReport();
                  setMenu(false);
                }}
              >
                <ShieldAlert size={16} /> Report video
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function App() {
  const { route, navigateSection, navigateWatch, navigateSearch } = useAppRouter();
  const [section, setSection] = useState<Section>(() => route.section || "home");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [query, setQuery] = useState(() => route.searchQuery || "");
  const [appliedQuery, setAppliedQuery] = useState(() => route.searchQuery || "");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSearchPopover, setShowSearchPopover] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("omnitube_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("omnitube_recent_searches") ||
          '["Web3", "Gaming", "OmniSound NFT", "Coding"]'
      );
    } catch {
      return ["Web3", "Gaming", "OmniSound NFT", "Coding"];
    }
  });

  const handleCommitSearch = (targetQuery?: string) => {
    const final = (targetQuery !== undefined ? targetQuery : query).trim();
    setQuery(final);
    setAppliedQuery(final);
    setSection("home");
    setIsSearchFocused(false);
    setShowSearchPopover(false);
    if (final) {
      setRecentSearches((prev) => {
        const next = [final, ...prev.filter((item) => item.toLowerCase() !== final.toLowerCase())].slice(0, 8);
        try {
          localStorage.setItem("omnitube_recent_searches", JSON.stringify(next));
        } catch {}
        return next;
      });
      navigateSearch(final);
    } else {
      navigateSection("home");
    }
  };

  const handleClearSearch = () => {
    setQuery("");
    setAppliedQuery("");
    setIsSearchFocused(false);
    setShowSearchPopover(false);
    navigateSection(section);
  };

  const [loading, setLoading] = useState(true);

  // Search Filters
  const [filters, setFilters] = useState<SearchFilters>({
    category: "",
    kind: "all",
    duration: "all",
    sort: "latest",
  });

  // Dialog & View Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [liveSetup, setLiveSetup] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveDescription, setLiveDescription] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null);
  const [savingPlaylistVideo, setSavingPlaylistVideo] = useState<VideoRow | null>(null);
  const [sharingVideo, setSharingVideo] = useState<VideoRow | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: "video" | "post"; id: string } | null>(
    null
  );
  const [room, setRoom] = useState<{ stream: StreamRow; token: string; broadcaster: boolean } | null>(
    null
  );
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSoundVideo, setCameraSoundVideo] = useState<VideoRow | null>(null);
  const [studioInitialSoundVideo, setStudioInitialSoundVideo] = useState<VideoRow | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    balance: "0.00",
    walletName: "None",
  });

  // Enhanced Sidebar Navigation & Data State
  const [accordionOpen, setAccordionOpen] = useState({
    universe: true,
    subs: true,
    web3: true,
    library: true,
    studio: true,
    explore: true,
  });
  const [showAllSubs, setShowAllSubs] = useState(false);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [followedCreators, setFollowedCreators] = useState<Profile[]>([]);
  const [activeLiveStreams, setActiveLiveStreams] = useState<StreamRow[]>([]);
  const [unlockedPpvCount, setUnlockedPpvCount] = useState<number>(0);
  const [sidebarPlaylists, setSidebarPlaylists] = useState<{ id: string; title: string }[]>([]);
  const [libraryInitialTab, setLibraryInitialTab] = useState<
    "watch_later" | "history" | "liked" | "playlists" | "memberships" | "unlocked_ppv"
  >("watch_later");
  const [studioInitialTab, setStudioInitialTab] = useState<StudioTab>("overview");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    videos.forEach((v) => {
      const cat = (v as any).category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [videos]);

  // Synchronize document theme attribute with settings (defaults to porcelain white)
  useEffect(() => {
    const activeTheme = settings.theme === "system" ? "light" : settings.theme;
    document.documentElement.setAttribute("data-theme", activeTheme);
    document.body.setAttribute("data-theme", activeTheme);
  }, [settings.theme]);

  // Synchronize URL route with App state and deep-linked video/section
  useEffect(() => {
    if (route.section && route.section !== section) {
      setSection(route.section);
    }
    if (route.searchQuery !== undefined && route.searchQuery !== appliedQuery) {
      setQuery(route.searchQuery);
      setAppliedQuery(route.searchQuery);
    }
    if (route.videoId) {
      const found = videos.find((v) => v.id === route.videoId);
      if (found) {
        setSelectedVideo(found);
      } else {
        void supabase
          .from("videos")
          .select(
            "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at,allow_comments,tags,video_reactions(count),comments(count)"
          )
          .eq("id", route.videoId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setSelectedVideo(data as VideoRow);
          });
      }
    } else if (!route.videoId && selectedVideo && window.location.pathname.startsWith("/watch")) {
      setSelectedVideo(null);
    }
  }, [route.pathname, route.section, route.videoId, route.searchQuery, videos]);

  const toggleAccordion = (key: keyof typeof accordionOpen) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Open Search Autocomplete query suggestions
  useEffect(() => {
    if (!query.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/search/autocomplete?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.suggestions) setSearchSuggestions(data.suggestions);
        })
        .catch(() => {});
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query]);

  const livekitUrl = (import.meta.env.VITE_LIVEKIT_URL as string | undefined) || "";

  const notify = useCallback(
    (title: string, detail?: string, kind: Notice["kind"] = "info") => {
      setNotice({ id: crypto.randomUUID(), title, detail, kind });
      window.setTimeout(
        () => setNotice((current) => (current?.title === title ? null : current)),
        5200
      );
    },
    []
  );

  // User auth state
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data.session?.user || null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Creator profile & follows
  useEffect(() => {
    let active = true;
    if (!user) {
      setProfile(null);
      setFollowingIds([]);
      return;
    }
    void supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,bio,website,is_verified")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) notify("Could not load creator profile", error.message, "error");
        else setProfile(data as Profile | null);
      });

    void supabase
      .from("follows")
      .select("creator_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        if (active) setFollowingIds((data || []).map((row: any) => row.creator_id));
      });

    return () => {
      active = false;
    };
  }, [user, notify]);

  // Load followed creators for sidebar
  useEffect(() => {
    let active = true;
    const loadSidebarCreators = async () => {
      if (followingIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,bio,is_verified")
          .in("id", followingIds)
          .limit(20);
        if (active && data) setFollowedCreators(data as Profile[]);
      } else {
        // Fallback to active featured creators
        const { data } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,bio,is_verified")
          .limit(6);
        if (active && data) setFollowedCreators(data as Profile[]);
      }
    };
    void loadSidebarCreators();
    return () => {
      active = false;
    };
  }, [followingIds]);

  // Periodically check live streams to keep live indicators accurate in sidebar
  const refreshActiveLiveStreams = useCallback(async () => {
    const { data } = await supabase
      .from("live_streams")
      .select("id,creator_id,title,description,status,visibility,room_name,starts_at,provider")
      .eq("status", "live")
      .eq("visibility", "public")
      .limit(30);
    if (data) setActiveLiveStreams(data as StreamRow[]);
  }, []);

  useEffect(() => {
    void refreshActiveLiveStreams();
    const interval = setInterval(() => {
      void refreshActiveLiveStreams();
    }, 20000);
    return () => clearInterval(interval);
  }, [refreshActiveLiveStreams]);

  // Load unlocked PPV count from Cloud SQL
  useEffect(() => {
    if (!wallet.address) {
      setUnlockedPpvCount(0);
      return;
    }
    fetch(`/api/monetization/user-unlocks?userAddress=${wallet.address}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.unlocks)) {
          setUnlockedPpvCount(data.unlocks.length);
        } else if (typeof data?.count === "number") {
          setUnlockedPpvCount(data.count);
        }
      })
      .catch(() => setUnlockedPpvCount(0));
  }, [wallet.address]);

  // Load user playlists for sidebar
  useEffect(() => {
    if (!user?.id) {
      setSidebarPlaylists([]);
      return;
    }
    supabase
      .from("playlists")
      .select("id,title")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) setSidebarPlaylists(data);
      });
  }, [user?.id]);

  // Notifications
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,kind,body,entity_type,entity_id,read_at,created_at,recipient_id")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (!active) return;
      if (error) {
        notify("Could not load notifications", error.message, "error");
        return;
      }
      setNotifications((data || []) as NotificationRow[]);
    })();

    const channel = supabase
      .channel("omnitube-notifications-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "recipient_id=eq." + user.id,
        },
        (event) => {
          const incoming = event.new as NotificationRow;
          setNotifications((prev) => [incoming, ...prev]);
          notify("New notification", incoming.body, "info");
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, notify]);

  // Load Discover Videos
  const loadVideos = useCallback(async () => {
    setLoading(true);
    let request = supabase
      .from("videos")
      .select(
        "id,creator_id,title,description,video_path,thumbnail_path,duration_seconds,visibility,kind,status,category,views_count,published_at,created_at,allow_comments,tags,video_reactions(count),comments(count)"
      )
      .eq("status", "published")
      .eq("visibility", "public");

    if (section === "shorts" || filters.kind === "short") {
      request = request.eq("kind", "short");
    } else if (filters.kind === "video") {
      request = request.eq("kind", "video");
    }

    if (filters.category) {
      request = request.eq("category", filters.category);
    }

    if (section === "subscriptions") {
      if (!user?.id || followingIds.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }
      request = request.in("creator_id", followingIds);
    }

    if (appliedQuery.trim()) {
      const safe = appliedQuery.trim().replace(/[,%()]/g, " ").slice(0, 100);
      if (safe) {
        request = request.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
    }

    if (filters.duration === "short") {
      request = request.lte("duration_seconds", 240);
    } else if (filters.duration === "medium") {
      request = request.gt("duration_seconds", 240).lte("duration_seconds", 1200);
    } else if (filters.duration === "long") {
      request = request.gt("duration_seconds", 1200);
    }

    if (section === "trending" || filters.sort === "trending" || filters.sort === "views") {
      request = request.order("views_count", { ascending: false });
    } else {
      request = request.order("published_at", { ascending: false });
    }

    const { data, error } = await request.limit(50);
    if (error) {
      setVideos([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as VideoRow[];
    const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)));
    const { data: profs } = creatorIds.length
      ? await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,bio,is_verified")
          .in("id", creatorIds)
      : { data: [] };

    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setVideos(rows.map((row) => ({ ...row, creator: map.get(row.creator_id) })));
    setLoading(false);
  }, [section, filters, appliedQuery, user?.id, followingIds]);

  // Load Community Posts
  const loadPosts = useCallback(async () => {
    if (section !== "posts") return;
    const { data, error } = await supabase
      .from("posts")
      .select("id,creator_id,body,media_urls,visibility,created_at,updated_at")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return;

    const rows = data as PostRow[];
    const ids = Array.from(new Set(rows.map((r) => r.creator_id)));
    const [prof, reactions] = await Promise.all([
      ids.length
        ? supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url,bio,is_verified")
            .in("id", ids)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("post_reactions").select("post_id"),
    ]);

    const profileMap = new Map((prof.data || []).map((person: any) => [person.id, person]));
    const counts = new Map<string, number>();
    (reactions.data || []).forEach((reaction: any) =>
      counts.set(reaction.post_id, (counts.get(reaction.post_id) || 0) + 1)
    );

    setPosts(
      rows.map((row) => ({
        ...row,
        creator: profileMap.get(row.creator_id),
        likes: counts.get(row.id) || 0,
      }))
    );
  }, [section]);

  // Load Streams
  const loadStreams = useCallback(async () => {
    if (section !== "live") return;
    const { data, error } = await supabase
      .from("live_streams")
      .select(
        "id,creator_id,title,description,status,visibility,room_name,starts_at,provider,chat_enabled"
      )
      .in("status", ["live", "scheduled"])
      .eq("visibility", "public")
      .order("starts_at", { ascending: true })
      .limit(30);

    if (error || !data) return;

    const rows = data as StreamRow[];
    const ids = Array.from(new Set(rows.map((r) => r.creator_id)));
    const prof = ids.length
      ? await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,bio,is_verified")
          .in("id", ids)
      : { data: [] as any[] };

    const profileMap = new Map((prof.data || []).map((person: any) => [person.id, person]));
    setStreams(rows.map((row) => ({ ...row, creator: profileMap.get(row.creator_id) })));
  }, [section]);

  useEffect(() => {
    void loadVideos();
    void loadPosts();
    void loadStreams();
  }, [loadVideos, loadPosts, loadStreams]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSelectedVideo(null);
    notify("Signed out successfully.", undefined, "success");
  };

  const toggleFollow = async (creatorId: string) => {
    if (!user?.id) {
      setAuthOpen(true);
      return;
    }
    if (creatorId === user.id) {
      setSection("studio");
      return;
    }
    if (followingIds.includes(creatorId)) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("creator_id", creatorId);
      setFollowingIds((ids) => ids.filter((id) => id !== creatorId));
      notify("Unfollowed creator.");
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, creator_id: creatorId });
      setFollowingIds((ids) => [...ids, creatorId]);
      notify("Now following creator!", undefined, "success");
    }
  };

  const likeVideo = async (video: VideoRow) => {
    if (!user?.id) {
      setAuthOpen(true);
      return;
    }
    const { data: existing } = await supabase
      .from("video_reactions")
      .select("reaction")
      .eq("video_id", video.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("video_reactions")
        .delete()
        .eq("video_id", video.id)
        .eq("user_id", user.id);
      notify("Like removed.");
    } else {
      await supabase
        .from("video_reactions")
        .upsert({ video_id: video.id, user_id: user.id, reaction: "like" });
      notify("Video liked!", undefined, "success");
    }
    void loadVideos();
  };

  const publishLive = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) {
      setAuthOpen(true);
      return;
    }
    if (!liveTitle.trim()) return;
    setUploadBusy(true);

    const id = crypto.randomUUID();
    const { data: created, error } = await supabase
      .from("live_streams")
      .insert({
        id,
        creator_id: user.id,
        title: liveTitle.trim(),
        description: liveDescription.trim(),
        status: "live",
        visibility: "public",
        provider: "livekit",
        room_name: "omnitube-" + id,
        chat_enabled: true,
      })
      .select(
        "id,creator_id,title,description,status,visibility,room_name,starts_at,provider,chat_enabled"
      )
      .single();

    if (error || !created) {
      setUploadBusy(false);
      notify("Could not create stream", error?.message, "error");
      return;
    }

    try {
      const { data, error: tokenError } = await supabase.functions.invoke("livekit-token", {
        body: { streamId: id, role: "publisher" },
      });
      setUploadBusy(false);
      if (tokenError || !data?.token) {
        setRoom({
          stream: { ...created, creator: profile || undefined },
          token: "mock-token",
          broadcaster: true,
        });
      } else {
        setRoom({
          stream: { ...created, creator: profile || undefined },
          token: data.token as string,
          broadcaster: true,
        });
      }
      setLiveSetup(false);
      setLiveTitle("");
      setLiveDescription("");
    } catch {
      setUploadBusy(false);
      setRoom({
        stream: { ...created, creator: profile || undefined },
        token: "demo-token",
        broadcaster: true,
      });
      setLiveSetup(false);
    }
  };

  const joinLive = async (stream: StreamRow) => {
    if (!user?.id) {
      setAuthOpen(true);
      return;
    }
    const { data } = await supabase.functions.invoke("livekit-token", {
      body: { streamId: stream.id, role: "viewer" },
    });
    setRoom({
      stream,
      token: data?.token || "viewer-token",
      broadcaster: false,
    });
  };

  const endRoom = async () => {
    if (room?.broadcaster && user?.id) {
      await supabase
        .from("live_streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", room.stream.id)
        .eq("creator_id", user.id);
    }
    setRoom(null);
    if (section === "live") void loadStreams();
  };

  const markNotificationRead = async (id: string) => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_id", user.id);
    setNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
    );
  };

  const countUnread = notifications.filter((item) => !item.read_at).length;
  const chooseSection = (next: Section) => {
    setSection(next);
    setSidebarOpen(false);
    setAppliedQuery("");
    setQuery("");
    navigateSection(next);
  };

  const handlePlayVideo = (v: VideoRow) => {
    setSelectedVideo(v);
    navigateWatch(v.id);
  };

  const handleCloseVideo = () => {
    setSelectedVideo(null);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/watch")) {
      navigateTo(section === "home" ? "/" : `/${section}`);
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-brand-wrapper">
          <div className="brand-lockup">
            <button
              className="brand-mark"
              onClick={() => {
                if (sidebarCollapsed) {
                  setSidebarCollapsed(false);
                  try { localStorage.setItem("omnitube_sidebar_collapsed", "false"); } catch {}
                } else {
                  chooseSection("home");
                }
              }}
              aria-label="Home"
              title={sidebarCollapsed ? "Expand sidebar rail" : "OmnPlay Home"}
            >
              <span>O</span>
            </button>
            <button className="brand-word" onClick={() => chooseSection("home")}>
              omn<span>play</span>
              <sup>®</sup>
            </button>
            <button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)}>
              <X />
            </button>
          </div>
        </div>

        {/* Independently Scrollable Body */}
        <div className="sidebar-scroll-container">
          {/* SECTION 1: YOUR UNIVERSE (Accordion) */}
          <div className="sidebar-accordion-section">
            <button
              className="sidebar-accordion-header"
              onClick={() => toggleAccordion("universe")}
              type="button"
            >
              <span className="sidebar-accordion-title">
                {accordionOpen.universe ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Your Universe</span>
              </span>
              {activeLiveStreams.length > 0 && (
                <span className="sidebar-accordion-badge live">
                  <span className="sidebar-live-dot" style={{ position: "static" }} />
                  {activeLiveStreams.length} Live
                </span>
              )}
            </button>
            {accordionOpen.universe && (
              <nav className="sidebar-accordion-content">
                {NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={"nav-item " + (section === id ? "active" : "")}
                    onClick={() => {
                      setActiveTopic(null);
                      chooseSection(id);
                    }}
                  >
                    <Icon size={18} strokeWidth={section === id ? 2.3 : 1.7} />
                    <span>{label}</span>
                    {id === "live" && activeLiveStreams.length > 0 && (
                      <span className="nav-count" style={{ background: "#ff3b5c" }}>
                        {activeLiveStreams.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* SECTION 2: SUBSCRIPTIONS & CREATORS (Accordion) */}
          <div className="sidebar-accordion-section">
            <button
              className="sidebar-accordion-header"
              onClick={() => toggleAccordion("subs")}
              type="button"
            >
              <span className="sidebar-accordion-title">
                {accordionOpen.subs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Subscriptions</span>
              </span>
              <span className="sidebar-accordion-badge">
                {followingIds.length > 0 ? followingIds.length : "Featured"}
              </span>
            </button>
            {accordionOpen.subs && (
              <div className="sidebar-accordion-content">
                {(showAllSubs ? followedCreators : followedCreators.slice(0, 4)).map((creator) => {
                  const isLive = activeLiveStreams.some((s) => s.creator_id === creator.id);
                  const activeStream = activeLiveStreams.find((s) => s.creator_id === creator.id);
                  return (
                    <button
                      key={creator.id}
                      className="sidebar-creator-btn"
                      onClick={() => {
                        if (isLive && activeStream) {
                          void joinLive(activeStream);
                        } else {
                          setSection("home");
                          setActiveTopic(null);
                          setQuery(creator.display_name || creator.username || "");
                          setAppliedQuery(creator.display_name || creator.username || "");
                          setSidebarOpen(false);
                        }
                      }}
                      title={isLive ? `${creator.display_name} is broadcasting LIVE!` : creator.display_name}
                    >
                      <div className="sidebar-avatar-wrap">
                        {creator.avatar_url ? (
                          <img
                            src={storagePublicUrl(creator.avatar_url)}
                            alt=""
                            className="sidebar-avatar"
                          />
                        ) : (
                          <div className="sidebar-avatar-placeholder">
                            {initials(creator)}
                          </div>
                        )}
                        {isLive && <span className="sidebar-live-dot" />}
                      </div>
                      <span className="sidebar-creator-name">
                        {creator.display_name || creator.username || "Creator"}
                      </span>
                      {creator.is_verified && (
                        <span className="verified" title="Verified Creator">✓</span>
                      )}
                      {isLive && <span className="sidebar-live-tag">LIVE</span>}
                    </button>
                  );
                })}

                {followedCreators.length > 4 && (
                  <button
                    className="sidebar-show-more-toggle"
                    onClick={() => setShowAllSubs(!showAllSubs)}
                  >
                    {showAllSubs ? (
                      <>
                        <ChevronUp size={14} />
                        <span>Show fewer</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        <span>Show {followedCreators.length - 4} more</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* SECTION 3: WEB3 VAULT & MONETIZATION (Accordion) */}
          <div className="sidebar-accordion-section">
            <button
              className="sidebar-accordion-header"
              onClick={() => toggleAccordion("web3")}
              type="button"
            >
              <span className="sidebar-accordion-title">
                {accordionOpen.web3 ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Web3 Monetization</span>
              </span>
              <span className="sidebar-accordion-badge">
                {wallet.connected ? (wallet.walletName || "Connected") : "Multi-Chain"}
              </span>
            </button>
            {accordionOpen.web3 && (
              <div className="sidebar-accordion-content">
                {wallet.connected ? (
                  <div
                    className="sidebar-web3-pill"
                    onClick={() => {
                      if (!user) setAuthOpen(true);
                      else {
                        setStudioInitialTab("monetization");
                        chooseSection("studio");
                      }
                    }}
                    title="Open Web3 Studio Dashboard"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <Coins size={15} color="var(--mint)" />
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>
                          {formatAddress(wallet.address || "")}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--muted)" }}>
                          {wallet.balance} {wallet.chainId === "137" || wallet.chainId === "0x89" ? "MATIC" : wallet.chainId === "42161" || wallet.chainId === "0xa4b1" ? "ETH (Arb)" : "BNB/ETH"}
                        </span>
                      </div>
                    </div>
                    <BadgeCheck size={14} color="var(--mint)" />
                  </div>
                ) : (
                  <button
                    className="sidebar-creator-btn"
                    style={{ background: "#59ebc815", color: "var(--mint)", border: "1px solid #59ebc833" }}
                    onClick={() => {
                      notify("Connect Web3 Wallet", "Use the wallet button in the top navigation to link MetaMask, Binance, or other Web3 wallets.");
                    }}
                  >
                    <Wallet size={15} />
                    <span>Connect Multi-Chain</span>
                  </button>
                )}

                <button
                  className="sidebar-sub-item"
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setStudioInitialTab("monetization");
                      chooseSection("studio");
                    }
                  }}
                >
                  <Coins size={16} />
                  <span>Monetization Hub</span>
                </button>

                <button
                  className="sidebar-sub-item"
                  onClick={() => {
                    setLibraryInitialTab("unlocked_ppv");
                    chooseSection("library");
                  }}
                >
                  <Unlock size={16} />
                  <span>Unlocked PPV Media</span>
                  {unlockedPpvCount > 0 && (
                    <span className="sidebar-accordion-badge" style={{ marginLeft: "auto" }}>
                      {unlockedPpvCount}
                    </span>
                  )}
                </button>

                <button
                  className="sidebar-sub-item"
                  onClick={() => {
                    setLibraryInitialTab("memberships");
                    chooseSection("library");
                  }}
                >
                  <Sparkles size={16} />
                  <span>Channel Memberships</span>
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* SECTION 4: YOUR LIBRARY (Accordion) */}
          <div className="sidebar-accordion-section">
            <button
              className="sidebar-accordion-header"
              onClick={() => toggleAccordion("library")}
              type="button"
            >
              <span className="sidebar-accordion-title">
                {accordionOpen.library ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Library</span>
              </span>
              <span className="sidebar-accordion-badge">Saved</span>
            </button>
            {accordionOpen.library && (
              <div className="sidebar-accordion-content">
                <button
                  className={"sidebar-sub-item " + (section === "library" && libraryInitialTab === "history" ? "active" : "")}
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setLibraryInitialTab("history");
                      chooseSection("library");
                    }
                  }}
                >
                  <History size={16} />
                  <span>Watch History</span>
                </button>

                <button
                  className={"sidebar-sub-item " + (section === "library" && libraryInitialTab === "liked" ? "active" : "")}
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setLibraryInitialTab("liked");
                      chooseSection("library");
                    }
                  }}
                >
                  <Heart size={16} />
                  <span>Liked Videos</span>
                </button>

                <button
                  className={"sidebar-sub-item " + (section === "library" && libraryInitialTab === "watch_later" ? "active" : "")}
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setLibraryInitialTab("watch_later");
                      chooseSection("library");
                    }
                  }}
                >
                  <Clock size={16} />
                  <span>Watch Later</span>
                </button>

                {sidebarPlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    className="sidebar-sub-item"
                    onClick={() => {
                      setLibraryInitialTab("playlists");
                      chooseSection("library");
                    }}
                    title={pl.title}
                  >
                    <ListMusic size={15} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pl.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* SECTION 5: CREATOR TOOLS (Accordion) */}
          <div className="sidebar-accordion-section">
            <button
              className="sidebar-accordion-header"
              onClick={() => toggleAccordion("studio")}
              type="button"
            >
              <span className="sidebar-accordion-title">
                {accordionOpen.studio ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Creator Studio</span>
              </span>
              <span className="sidebar-accordion-badge">Pro</span>
            </button>
            {accordionOpen.studio && (
              <div className="sidebar-accordion-content">
                <button
                  className={"sidebar-sub-item " + (section === "studio" && studioInitialTab === "editor" ? "active" : "")}
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setStudioInitialTab("editor");
                      chooseSection("studio");
                    }
                  }}
                >
                  <Film size={16} />
                  <span>Timeline Studio (WASM)</span>
                </button>

                <button
                  className="sidebar-sub-item"
                  onClick={() => {
                    setCameraSoundVideo(null);
                    setCameraOpen(true);
                  }}
                >
                  <Camera size={16} />
                  <span>AR Camera & Sound Duet</span>
                </button>

                <button
                  className={"sidebar-sub-item " + (section === "studio" && studioInitialTab === "overview" ? "active" : "")}
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setStudioInitialTab("overview");
                      chooseSection("studio");
                    }
                  }}
                >
                  <MonitorPlay size={16} />
                  <span>Studio Dashboard</span>
                </button>

                <button
                  className="sidebar-sub-item"
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else setUploadOpen(true);
                  }}
                >
                  <Upload size={16} />
                  <span>Upload Video</span>
                </button>

                <button
                  className="sidebar-sub-item"
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else setLiveSetup(true);
                  }}
                >
                  <Radio size={16} />
                  <span>Go Live Stream</span>
                </button>

                <button
                  className={"sidebar-sub-item " + (section === "studio" && studioInitialTab === "analytics" ? "active" : "")}
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else {
                      setStudioInitialTab("analytics");
                      chooseSection("studio");
                    }
                  }}
                >
                  <Layers size={16} />
                  <span>Creator Analytics</span>
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* SECTION 6: EXPLORE TOPICS (Accordion) */}
          <div className="sidebar-accordion-section">
            <button
              className="sidebar-accordion-header"
              onClick={() => toggleAccordion("explore")}
              type="button"
            >
              <span className="sidebar-accordion-title">
                {accordionOpen.explore ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Explore Topics</span>
              </span>
              <span className="sidebar-accordion-badge">Tags</span>
            </button>
            {accordionOpen.explore && (
              <div className="sidebar-accordion-content">
                {(showAllTopics ? TOPIC_CHANNELS : TOPIC_CHANNELS.slice(0, 4)).map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTopic === t.id;
                  return (
                    <button
                      key={t.id}
                      className={"sidebar-topic-item " + (isActive ? "active" : "")}
                      onClick={() => {
                        setActiveTopic(t.id);
                        setSection("home");
                        setQuery(t.query);
                        setAppliedQuery(t.query);
                        setSidebarOpen(false);
                      }}
                    >
                      <Icon size={15} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}

                {TOPIC_CHANNELS.length > 4 && (
                  <button
                    className="sidebar-show-more-toggle"
                    onClick={() => setShowAllTopics(!showAllTopics)}
                  >
                    {showAllTopics ? (
                      <>
                        <ChevronUp size={14} />
                        <span>Show fewer</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        <span>Show {TOPIC_CHANNELS.length - 4} more</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* OmnPlay Creator Workstation Hub */}
          <div className="creator-callout">
            <div className="creator-callout-icon">
              <Sparkles size={16} />
            </div>
            <strong>OmnPlay Studio Suite</strong>
            <p>WASM multi-track editor, WebRTC real-time broadcast & multi-chain monetization.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginTop: "4px" }}>
              <button
                className="btn btn-primary full"
                onClick={() => {
                  if (!user) setAuthOpen(true);
                  else {
                    setStudioInitialTab("editor");
                    chooseSection("studio");
                  }
                }}
              >
                <Film size={14} /> Open Timeline Studio
              </button>
              <button
                className="btn btn-quiet full"
                onClick={() => {
                  if (!user) setAuthOpen(true);
                  else setUploadOpen(true);
                }}
              >
                <Upload size={14} /> Upload Media
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <span>OMNPLAY PRO V2.4 · CLOUDSQL</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button
                className="footer-help"
                onClick={() => setSettingsOpen(true)}
                title="Settings & Appearance"
                aria-label="Settings"
              >
                <Settings size={14} />
              </button>
              <button
                className="footer-help"
                onClick={() =>
                  notify(
                    "OmnPlay Production",
                    "Multi-Chain Web3 monetization (Polygon, Arbitrum, BSC, Ethereum) connected with Cloud SQL database."
                  )
                }
              >
                <CircleHelp size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Shell */}
      <main className={`main-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth <= 768) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarCollapsed((prev) => {
                    const next = !prev;
                    try {
                      localStorage.setItem("omnitube_sidebar_collapsed", String(next));
                    } catch {}
                    return next;
                  });
                }
              }}
              aria-label="Toggle navigation menu"
              title={sidebarCollapsed ? "Expand sidebar rail" : "Collapse to icon rail"}
            >
              <Menu size={18} />
            </button>
            <div className="breadcrumb">
              <span>OmnPlay</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{titleFor[section]}</strong>
            </div>
          </div>

          <div className="topbar-center">
            <form
              className={`search-bar relative ${isSearchFocused ? "is-expanded" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                handleCommitSearch();
              }}
            >
              <Search
                size={17}
                className={isSearchFocused ? "text-[var(--mint)]" : "text-[var(--muted)]"}
              />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowSearchPopover(true);
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setShowSearchPopover(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchFocused(false);
                    setShowSearchPopover(false);
                  }
                }}
                placeholder="Search videos, creators, sounds, topics... (Press Enter to submit)"
                aria-label="Search"
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              <kbd className="cursor-pointer" onClick={() => handleCommitSearch()}>
                ↵
              </kbd>

              {/* Expanded Search View with Recent Searches and Trending Tags */}
              {isSearchFocused && (
                <div
                  className="search-popover-panel"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div style={{ marginBottom: "14px" }}>
                      <div className="search-group-header">
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <History size={13} style={{ color: "var(--mint)" }} /> Recent Searches
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRecentSearches([]);
                            try {
                              localStorage.removeItem("omnitube_recent_searches");
                            } catch {}
                          }}
                          className="search-clear-link"
                        >
                          Clear all
                        </button>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {recentSearches.map((term, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleCommitSearch(term)}
                            className="search-recent-chip"
                          >
                            <Search size={11} style={{ color: "var(--muted)" }} />
                            <span>{term}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Tags */}
                  <div style={{ marginBottom: "12px" }}>
                    <div className="search-group-header">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Flame size={13} style={{ color: "var(--coral)" }} /> Trending Tags
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {["#Web3", "#Gaming", "#LiveNow", "#OmniSound", "#AI", "#Esports", "#Music"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleCommitSearch(tag.replace("#", ""))}
                          className="search-tag-chip"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Autocomplete Suggestions */}
                  {searchSuggestions.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", marginTop: "10px" }}>
                      <div className="search-group-header" style={{ color: "var(--mint)" }}>
                        Suggestions
                      </div>
                      {searchSuggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleCommitSearch(s)}
                          className="search-suggestion-item"
                        >
                          <Search size={13} style={{ color: "var(--muted)" }} />
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          <div className="topbar-actions flex items-center gap-2">
            {/* Auto-hidden on Search: Notifications */}
            <div className={`topbar-action-item ${isSearchFocused ? "auto-hidden-on-search" : ""}`}>
              <button
                className="icon-btn topbar-bell"
                onClick={() => chooseSection("notifications")}
                title="Notifications"
              >
                <Bell size={19} />
                {countUnread > 0 && <i />}
              </button>
            </div>

            {/* Auto-hidden on Search: Settings */}
            <div className={`topbar-action-item ${isSearchFocused ? "auto-hidden-on-search" : ""}`}>
              <button
                className="icon-btn"
                onClick={() => setSettingsOpen(true)}
                title="Settings & Appearance (Porcelain White / Dark)"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
            </div>

            {/* Web3 Multi-Chain Wallet Connect Bar */}
            <Web3WalletBar wallet={wallet} onWalletChange={setWallet} notify={notify} />

            {user ? (
              <>
                <button className="profile-chip" onClick={() => chooseSection("studio")}>
                  <span className="avatar avatar-sm" style={avatarStyle(profile)}>
                    {!profile?.avatar_url && initials(profile)}
                  </span>
                  <span>{profile?.display_name || user.email?.split("@")[0] || "Creator"}</span>
                  <ChevronDown size={14} />
                </button>
                <button
                  className="icon-btn sign-out-button"
                  onClick={() => void signOut()}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button className="btn btn-primary sign-in" onClick={() => setAuthOpen(true)}>
                <LogIn size={15} /> Sign in
              </button>
            )}

            {/* Auto-hidden on Search: Camera & FX Suite */}
            <div className={`topbar-action-item ${isSearchFocused ? "auto-hidden-on-search" : ""}`}>
              <button
                className="btn btn-glass top-camera-btn"
                onClick={() => {
                  setCameraSoundVideo(null);
                  setCameraOpen(true);
                }}
                title="Open In-App AR Camera & Duet Suite"
              >
                <Camera size={15} style={{ color: "#38bdf8" }} /> Camera & FX
              </button>
            </div>
            <button
              className="btn btn-primary top-create"
              onClick={() => {
                if (!user) setAuthOpen(true);
                else setUploadOpen(true);
              }}
            >
              <Plus size={16} /> Create
            </button>
          </div>
        </header>

        <div className="content-area">
          {/* DISCOVER & TRENDING */}
          {(section === "home" || section === "trending" || section === "subscriptions") && (
            <>
              {section === "home" && !appliedQuery && (
                <section className="hero-banner">
                  <div className="hero-copy">
                    <span className="hero-kicker">
                      <span className="hero-kicker-dot" /> A NEW WAY TO WATCH & CREATE
                    </span>
                    <h1>
                      Your world,
                      <br />
                      <span>in motion.</span>
                    </h1>
                    <p>
                      Discover remarkable videos. Make your own corner of the internet. Go live
                      with the people who get you.
                    </p>
                    <div className="hero-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (!user) setAuthOpen(true);
                          else setUploadOpen(true);
                        }}
                      >
                        <Upload size={16} /> Start creating
                      </button>
                      <button className="btn btn-glass" onClick={() => chooseSection("shorts")}>
                        <Clapperboard size={16} /> Explore shorts
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Search & Discovery Filter Bar */}
              <SearchFilterBar
                filters={filters}
                categoryCounts={categoryCounts}
                onChange={(updated) => setFilters((prev) => ({ ...prev, ...updated }))}
                onReset={() =>
                  setFilters({ category: "", kind: "all", duration: "all", sort: "latest" })
                }
              />

              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    {section === "subscriptions"
                      ? "FROM YOUR CREATORS"
                      : section === "trending"
                      ? "WHAT PEOPLE ARE WATCHING"
                      : "DISCOVERY STREAM"}
                  </p>
                  <h2>
                    {appliedQuery ? `Results for "${appliedQuery}"` : titleFor[section]}
                  </h2>
                </div>
                <button className="icon-btn" title="Refresh feed" onClick={() => void loadVideos()}>
                  <ArrowDownUp size={17} />
                </button>
              </div>

              {loading ? (
                <div className="loading-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="video-skeleton" key={i}>
                      <div />
                      <span />
                      <small />
                    </div>
                  ))}
                </div>
              ) : videos.length > 0 ? (
                <div className="video-grid">
                  {videos.map((v, i) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      trendingRank={section === "trending" ? i + 1 : undefined}
                      onPlay={() => handlePlayVideo(v)}
                      onLike={() => void likeVideo(v)}
                      onSave={() => {
                        if (!user) setAuthOpen(true);
                        else setSavingPlaylistVideo(v);
                      }}
                      onShare={() => setSharingVideo(v)}
                      onReport={() => setReportTarget({ type: "video", id: v.id })}
                      following={followingIds.includes(v.creator_id)}
                      onFollow={() => void toggleFollow(v.creator_id)}
                      onUseSound={() => {
                        setCameraSoundVideo(v);
                        setCameraOpen(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {section === "trending" ? (
                      <Flame size={26} />
                    ) : section === "subscriptions" ? (
                      <Users size={26} />
                    ) : (
                      <Film size={26} />
                    )}
                  </div>
                  {appliedQuery ? (
                    <>
                      <h3>No videos found for "{appliedQuery}"</h3>
                      <p>
                        No content matched your query or filters. Try adjusting your search or reset filters.
                      </p>
                      <button
                        className="btn btn-quiet mt-3"
                        onClick={() => {
                          setAppliedQuery("");
                          setQuery("");
                          setFilters({ category: "", kind: "all", duration: "all", sort: "latest" });
                        }}
                      >
                        Reset Filters
                      </button>
                    </>
                  ) : section === "trending" ? (
                    <>
                      <h3>No trending videos yet</h3>
                      <p>
                        Videos with high viewership and community engagement will trend here. Publish and share your creations!
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          className="btn btn-primary"
                          onClick={() => (user ? setUploadOpen(true) : setAuthOpen(true))}
                        >
                          <Upload size={15} /> Upload Video
                        </button>
                        <button className="btn btn-quiet" onClick={() => chooseSection("home")}>
                          <Compass size={15} /> Discover Feed
                        </button>
                      </div>
                    </>
                  ) : section === "subscriptions" ? (
                    <>
                      <h3>Your following feed is empty</h3>
                      <p>
                        Subscribe to your favorite creators to build your personal video and live stream feed.
                      </p>
                      <button className="btn btn-primary mt-3" onClick={() => chooseSection("home")}>
                        <Compass size={15} /> Explore Creators
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>Start your creator universe</h3>
                      <p>
                        No videos published yet. Upload your first video to reach viewers and build your audience!
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          className="btn btn-primary"
                          onClick={() => (user ? setUploadOpen(true) : setAuthOpen(true))}
                        >
                          <Upload size={15} /> Upload Video
                        </button>
                        <button
                          className="btn btn-quiet"
                          onClick={() => (user ? setLiveSetup(true) : setAuthOpen(true))}
                        >
                          <Radio size={15} /> Broadcast Live
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* OMNI SHORTS REEL */}
          {section === "shorts" && (
            <ShortsReel
              shorts={videos.filter((v) => v.kind === "short")}
              wallet={wallet}
              onWalletChange={setWallet}
              userId={user?.id || null}
              profile={profile}
              followingIds={followingIds}
              onFollow={(cid) => void toggleFollow(cid)}
              notify={notify}
              onClose={() => chooseSection("home")}
              onUploadShort={() => (user ? setUploadOpen(true) : setAuthOpen(true))}
              onOpenStudioWithSound={(v) => {
                setStudioInitialSoundVideo(v);
                setStudioInitialTab("editor");
                chooseSection("studio");
              }}
              onUseSound={(v) => {
                setCameraSoundVideo(v);
                setCameraOpen(true);
              }}
            />
          )}

          {/* LIVE STREAMS */}
          {section === "live" && (
            <div className="live-view-container">
              <div className="live-hero">
                <div className="live-hero-copy">
                  <span className="live-pill">
                    <span className="live-dot" /> LOW-LATENCY REALTIME
                  </span>
                  <h3>
                    Meet them <span>in real time.</span>
                  </h3>
                  <p>Live video and interactive chat powered by authenticated LiveKit rooms.</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (!user) setAuthOpen(true);
                    else setLiveSetup(true);
                  }}
                >
                  <Radio size={16} /> Broadcast Live
                </button>
              </div>

              <div className="live-list-heading mt-6 mb-4">
                <h3>Live & Scheduled Streams</h3>
                <span>{streams.filter((s) => s.status === "live").length} live</span>
              </div>

              <div className="stream-grid">
                {streams.map((stream) => (
                  <article className="stream-card" key={stream.id}>
                    <button
                      className="stream-art"
                      onClick={() =>
                        stream.status === "live"
                          ? void joinLive(stream)
                          : notify("Stream scheduled", "Broadcaster hasn't started yet.")
                      }
                    >
                      <div className="stream-art-orb">
                        <Radio size={28} />
                      </div>
                      <span
                        className={
                          stream.status === "live" ? "stream-status is-live" : "stream-status"
                        }
                      >
                        {stream.status === "live" ? "● LIVE NOW" : "SCHEDULED"}
                      </span>
                      <span className="stream-play">
                        <Play fill="currentColor" size={19} />
                      </span>
                    </button>
                    <div className="stream-card-info">
                      <span className="avatar avatar-md" style={avatarStyle(stream.creator)}>
                        {!stream.creator?.avatar_url && initials(stream.creator)}
                      </span>
                      <div>
                        <strong>{stream.title}</strong>
                        <small>
                          {stream.creator?.display_name || "Creator"} ·{" "}
                          {stream.status === "live"
                            ? "On air"
                            : new Date(stream.starts_at).toLocaleString()}
                        </small>
                        <p>{stream.description || "Join the broadcast room."}</p>
                      </div>
                    </div>
                    {stream.status === "live" && (
                      <button className="btn btn-primary full" onClick={() => void joinLive(stream)}>
                        <Play size={15} /> Join Live Room
                      </button>
                    )}
                  </article>
                ))}
              </div>

              {streams.length === 0 && (
                <div className="empty-state">
                  <Radio size={36} className="text-muted mb-2" />
                  <h3>No active broadcasts</h3>
                  <p>Be the first creator to go live today!</p>
                </div>
              )}
            </div>
          )}

          {/* COMMUNITY POSTS & POLLS */}
          {section === "posts" && (
            <CommunityFeed
              posts={posts}
              userId={user?.id || null}
              profile={profile}
              notify={notify}
              onReload={() => void loadPosts()}
              onRequestReport={(id) => setReportTarget({ type: "post", id })}
            />
          )}

          {/* LIBRARY (Watch Later, History, Liked, Playlists) */}
          {section === "library" && (
            user ? (
              <LibraryView
                userId={user.id}
                wallet={wallet}
                onWalletChange={(w) => setWallet(w)}
                notify={notify}
                onPlayVideo={handlePlayVideo}
                initialTab={libraryInitialTab}
              />
            ) : (
              <div className="empty-state">
                <LogIn size={36} className="text-muted mb-2" />
                <h3>Sign in to access your library</h3>
                <p>Saved videos, viewing history, and playlists will appear here.</p>
                <button className="btn btn-primary mt-4" onClick={() => setAuthOpen(true)}>
                  Sign In
                </button>
              </div>
            )
          )}

          {/* CREATOR STUDIO MANAGEMENT SUITE */}
          {section === "studio" && (
            user ? (
              <CreatorStudio
                user={user}
                profile={profile}
                wallet={wallet}
                initialTab={studioInitialTab}
                initialSoundVideo={studioInitialSoundVideo}
                onProfileUpdated={(up) => setProfile(up)}
                onOpenUpload={() => setUploadOpen(true)}
                onOpenLiveSetup={() => setLiveSetup(true)}
                notify={notify}
                onPlayVideo={handlePlayVideo}
              />
            ) : (
              <div className="empty-state">
                <MonitorPlay size={36} className="text-muted mb-2" />
                <h3>Sign in to Creator Studio</h3>
                <p>Manage your uploads, view deep analytics, and customize your channel.</p>
                <button className="btn btn-primary mt-4" onClick={() => setAuthOpen(true)}>
                  Sign In
                </button>
              </div>
            )
          )}

          {/* NOTIFICATIONS */}
          {section === "notifications" && (
            user ? (
              <div className="notification-list">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    className={"notification-item " + (!item.read_at ? "unread" : "")}
                    onClick={() => void markNotificationRead(item.id)}
                  >
                    <span className="notification-icon">
                      <Bell size={17} />
                    </span>
                    <span className="notification-text">
                      <strong>{item.body}</strong>
                      <small>
                        {timeAgo(item.created_at)} · {item.kind}
                      </small>
                    </span>
                    {!item.read_at && <i />}
                  </button>
                ))}
                {notifications.length === 0 && (
                  <div className="empty-state">
                    <Bell size={36} className="text-muted mb-2" />
                    <h3>No notifications yet</h3>
                    <p>Activity from the creators you follow and interactions will show up here.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <Bell size={36} className="text-muted mb-2" />
                <h3>Sign in for notifications</h3>
                <p>Your notifications are private to your creator account.</p>
                <button className="btn btn-primary mt-4" onClick={() => setAuthOpen(true)}>
                  Sign In
                </button>
              </div>
            )
          )}

          <footer className="main-footer">
            <div className="footer-brand">
              <span className="brand-mark">
                <span>O</span>
              </span>
              <span>
                omn<span>play</span>
              </span>
            </div>
            <span>A creator-first universe.</span>
            <div className="footer-links">
              <a href="https://supabase.com/docs" target="_blank" rel="noreferrer">
                Infrastructure
              </a>
              <a href="https://livekit.io/" target="_blank" rel="noreferrer">
                Live media
              </a>
              <button
                onClick={() =>
                  notify(
                    "Community Safety",
                    "Report suspicious or harmful content with the report controls."
                  )
                }
              >
                Community Safety
              </button>
            </div>
          </footer>
        </div>
      </main>

      {/* MODALS */}
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {authOpen && <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} notify={notify} />}

      {reportTarget && user?.id && (
        <ReportDialog
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          userId={user.id}
          onClose={() => setReportTarget(null)}
          notify={notify}
        />
      )}

      {uploadOpen && user?.id && (
        <UploadDialog
          userId={user.id}
          notify={notify}
          onClose={() => setUploadOpen(false)}
          onPublished={() => void loadVideos()}
        />
      )}

      {/* OmnPlay AR Camera & Sound Studio Modal */}
      {cameraOpen && (
        <OmnPlayCameraSuite
          sourceSoundVideo={cameraSoundVideo}
          onClose={() => {
            setCameraOpen(false);
            setCameraSoundVideo(null);
          }}
          onClipRecorded={(blob, meta) => {
            notify(
              "Take Recorded!",
              `"${meta.title}" recorded with ${meta.mode} layout and sound sync. Ready to publish.`,
              "success"
            );
            if (!user) setAuthOpen(true);
            else setUploadOpen(true);
          }}
          wallet={wallet}
          onWalletChange={setWallet}
          onSendToStudio={(blob, srcVid) => {
            setStudioInitialSoundVideo(srcVid || null);
            setStudioInitialTab("editor");
            chooseSection("studio");
          }}
          notify={notify}
        />
      )}

      {/* Pro Video Player */}
      {selectedVideo && (
        <AdvancedVideoPlayer
          video={selectedVideo}
          profile={profile}
          userId={user?.id || null}
          wallet={wallet}
          onWalletChange={setWallet}
          onClose={handleCloseVideo}
          notify={notify}
          onSelectRelated={handlePlayVideo}
          onUseSound={(v) => {
            setSelectedVideo(null);
            setCameraSoundVideo(v);
            setCameraOpen(true);
          }}
          onOpenStudioWithSound={(v) => {
            setSelectedVideo(null);
            setStudioInitialSoundVideo(v);
            setStudioInitialTab("editor");
            chooseSection("studio");
          }}
        />
      )}

      {/* Save to Playlist Modal */}
      {savingPlaylistVideo && user?.id && (
        <PlaylistDialog
          video={savingPlaylistVideo}
          userId={user.id}
          onClose={() => setSavingPlaylistVideo(null)}
          notify={notify}
        />
      )}

      {/* Share Dialog */}
      {sharingVideo && (
        <ShareDialog
          video={sharingVideo}
          onClose={() => setSharingVideo(null)}
          notify={notify}
        />
      )}

      {/* Live Broadcast Setup */}
      {liveSetup && (
        <Modal
          onClose={() => {
            if (!uploadBusy) setLiveSetup(false);
          }}
          className="live-setup-modal"
        >
          <div className="modal-heading">
            <div>
              <p className="eyebrow">ON-AIR STUDIO</p>
              <h2>Start a live broadcast</h2>
              <p className="muted">An authorized LiveKit room will be initialized.</p>
            </div>
            <button className="icon-btn" onClick={() => setLiveSetup(false)}>
              <X />
            </button>
          </div>
          <form className="stack-form" onSubmit={(event) => void publishLive(event)}>
            <label htmlFor="stream-title">Stream title</label>
            <input
              id="stream-title"
              value={liveTitle}
              onChange={(event) => setLiveTitle(event.target.value)}
              required
              maxLength={180}
              placeholder="What are we broadcasting today?"
            />
            <label htmlFor="stream-description">Description</label>
            <textarea
              id="stream-description"
              value={liveDescription}
              onChange={(event) => setLiveDescription(event.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Tell viewers what this live session is about."
            />
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setLiveSetup(false)}
                disabled={uploadBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploadBusy || !liveTitle.trim()}
              >
                {uploadBusy ? (
                  <>
                    <span className="spinner" /> Starting…
                  </>
                ) : (
                  <>
                    <Radio size={16} /> Start broadcast
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Active Live Room */}
      {room && livekitUrl && (
        <LiveRoomPane
          key={room.stream.id}
          stream={room.stream}
          token={room.token}
          serverUrl={livekitUrl}
          broadcaster={room.broadcaster}
          userId={user?.id || ""}
          profile={profile}
          wallet={wallet}
          onWalletChange={setWallet}
          onClose={() => void endRoom()}
          notify={notify}
        />
      )}

      {/* Notifications Toast */}
      {notice && (
        <div className={"toast toast-" + (notice.kind || "info")} role="status">
          <span className="toast-icon">
            {notice.kind === "success" ? (
              <Check size={17} />
            ) : notice.kind === "error" ? (
              <ShieldAlert size={17} />
            ) : (
              <Sparkles size={17} />
            )}
          </span>
          <div>
            <strong>{notice.title}</strong>
            {notice.detail && <p>{notice.detail}</p>}
          </div>
          <button
            className="icon-btn tiny"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button
          className={"mobile-nav-btn " + (section === "home" ? "active" : "")}
          onClick={() => chooseSection("home")}
          aria-label="Discover"
        >
          <Home size={19} />
          <span>Discover</span>
        </button>
        <button
          className={"mobile-nav-btn " + (section === "shorts" ? "active" : "")}
          onClick={() => chooseSection("shorts")}
          aria-label="Shorts"
        >
          <Clapperboard size={19} />
          <span>Shorts</span>
        </button>
        <button
          className="mobile-nav-btn"
          onClick={() => {
            if (!user) setAuthOpen(true);
            else setUploadOpen(true);
          }}
          style={{ color: "var(--mint)" }}
          aria-label="Create content"
        >
          <Plus size={22} />
          <span>Create</span>
        </button>
        <button
          className={"mobile-nav-btn " + (section === "live" ? "active" : "")}
          onClick={() => chooseSection("live")}
          aria-label="Live streams"
        >
          <Radio size={19} />
          <span>Live</span>
        </button>
        <button
          className={"mobile-nav-btn " + (section === "library" ? "active" : "")}
          onClick={() => chooseSection("library")}
          aria-label="Your library"
        >
          <Library size={19} />
          <span>Library</span>
        </button>
      </nav>

      {/* Advanced Settings Modal */}
      {settingsOpen && (
        <AdvancedSettingsModal
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setSettingsOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export default App;
