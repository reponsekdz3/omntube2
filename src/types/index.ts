export type Section =
  | "home"
  | "trending"
  | "shorts"
  | "live"
  | "subscriptions"
  | "posts"
  | "library"
  | "notifications"
  | "studio";

export type StudioTab =
  | "overview"
  | "content"
  | "analytics"
  | "monetization"
  | "comments"
  | "playlists"
  | "live"
  | "customization";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  website?: string | null;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
};

export type VideoRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  video_path: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  visibility: "public" | "unlisted" | "private" | string;
  kind: "video" | "short";
  status: "draft" | "published" | "processing" | "failed" | string;
  category: string;
  views_count: number;
  published_at: string | null;
  created_at: string;
  updated_at?: string;
  allow_comments?: boolean;
  tags?: string[];
  video_reactions?: { count: number }[];
  comments?: { count: number }[];
  creator?: Profile;
};

export type CommentRow = {
  id: string;
  video_id?: string | null;
  post_id?: string | null;
  user_id: string;
  body: string;
  parent_comment_id?: string | null;
  created_at: string;
  updated_at?: string;
  creator?: Profile | null;
  likes_count?: number;
};

export type PlaylistRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  visibility: "public" | "private" | string;
  created_at: string;
  updated_at: string;
  items_count?: number;
  videos?: VideoRow[];
};

export type PlaylistItemRow = {
  playlist_id: string;
  video_id: string;
  position: number;
  added_at: string;
  video?: VideoRow;
};

export type PostPollOption = {
  text: string;
  votes: number;
};

export type PostRow = {
  id: string;
  creator_id: string;
  body: string;
  media_urls: string[];
  visibility: string;
  created_at: string;
  updated_at?: string;
  creator?: Profile;
  likes?: number;
  liked_by_me?: boolean;
  poll?: {
    question: string;
    options: PostPollOption[];
    voted_option?: number | null;
    total_votes?: number;
  };
};

export type StreamRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  status: "live" | "scheduled" | "ended" | "cancelled" | string;
  visibility: string;
  room_name: string;
  starts_at: string;
  ended_at?: string | null;
  provider: string;
  chat_enabled: boolean;
  playback_url?: string | null;
  replay_video_id?: string | null;
  creator?: Profile;
};

export type StreamMessage = {
  id: string;
  stream_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: Profile | null;
};

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  kind: "like" | "comment" | "follow" | "stream" | "system" | string;
  read_at: string | null;
  created_at: string;
  actor?: Profile | null;
};

export type Notice = {
  id: string;
  title: string;
  detail?: string;
  kind?: "success" | "error" | "info";
};

export type VideoViewRow = {
  id: string;
  video_id: string;
  viewer_id: string;
  view_date: string;
  watch_seconds: number;
  source: string;
};
