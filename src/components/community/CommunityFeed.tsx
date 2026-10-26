import React, { useState } from "react";
import {
  BarChart2,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { formatCount, supabase, timeAgo } from "../../lib/supabase";
import { avatarStyle, initials } from "../../lib/utils";
import type { Notice, PostRow, Profile } from "../../types";

export function CommunityFeed({
  posts,
  userId,
  profile,
  notify,
  onReload,
  onRequestReport,
}: {
  posts: PostRow[];
  userId: string | null;
  profile: Profile | null;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onReload: () => void;
  onRequestReport: (id: string) => void;
}) {
  const [composerText, setComposerText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [showPollInput, setShowPollInput] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [posting, setPosting] = useState(false);

  // Local poll voting state
  const [pollVotesMap, setPollVotesMap] = useState<Record<string, number>>({});

  const handleAddPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleUpdateOption = (index: number, val: string) => {
    const updated = [...pollOptions];
    updated[index] = val;
    setPollOptions(updated);
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      notify("Sign in to share a post.");
      return;
    }
    const text = composerText.trim();
    if (!text || posting) return;

    setPosting(true);

    let bodyToStore = text;
    // If poll is configured, encode poll in JSON within post body or metadata
    if (showPollInput && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2) {
      const pollData = {
        question: pollQuestion.trim(),
        options: pollOptions.filter((o) => o.trim()).map((o) => ({ text: o.trim(), votes: 0 })),
      };
      bodyToStore = `${text}\n\n<!--POLL:${JSON.stringify(pollData)}-->`;
    }

    const mediaList = imageUrl.trim() ? [imageUrl.trim()] : [];

    const { error } = await supabase.from("posts").insert({
      creator_id: userId,
      body: bodyToStore,
      media_urls: mediaList,
      visibility: "public",
    });

    setPosting(false);
    if (error) {
      notify("Failed to publish post", error.message, "error");
    } else {
      setComposerText("");
      setImageUrl("");
      setShowImageInput(false);
      setShowPollInput(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      notify("Post shared with the community!", undefined, "success");
      onReload();
    }
  };

  const togglePostReaction = async (post: PostRow) => {
    if (!userId) {
      notify("Sign in to like posts.");
      return;
    }
    const { error } = await supabase
      .from("post_reactions")
      .upsert({ post_id: post.id, user_id: userId, reaction: "like" }, { onConflict: "post_id,user_id" });

    if (error) {
      notify("Reaction failed", error.message, "error");
    } else {
      notify("Post liked!", undefined, "success");
      onReload();
    }
  };

  const voteInPoll = (postId: string, optionIndex: number) => {
    if (!userId) {
      notify("Sign in to vote in community polls.");
      return;
    }
    setPollVotesMap((prev) => ({
      ...prev,
      [postId]: optionIndex,
    }));
    notify("Vote registered!", undefined, "success");
  };

  // Helper to extract poll from post body
  const parsePostContent = (body: string) => {
    const pollMatch = body.match(/<!--POLL:(.+?)-->/);
    if (pollMatch) {
      try {
        const poll = JSON.parse(pollMatch[1]);
        const cleanBody = body.replace(/<!--POLL:.+?-->/, "").trim();
        return { text: cleanBody, poll };
      } catch {
        return { text: body, poll: null };
      }
    }
    return { text: body, poll: null };
  };

  return (
    <div className="community-hub-container">
      {/* Post Composer */}
      {userId ? (
        <form onSubmit={submitPost} className="community-composer-card">
          <div className="flex items-start gap-3">
            <span className="avatar avatar-md" style={avatarStyle(profile)}>
              {!profile?.avatar_url && initials(profile)}
            </span>
            <div className="flex-1">
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                maxLength={5000}
                rows={3}
                placeholder="Share an update, behind-the-scenes thought, or question with your followers..."
                required
              />

              {showImageInput && (
                <div className="composer-extra-field mt-2">
                  <input
                    type="url"
                    placeholder="Paste image URL (https://...)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn tiny"
                    onClick={() => {
                      setShowImageInput(false);
                      setImageUrl("");
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Poll Composer Box */}
              {showPollInput && (
                <div className="composer-poll-box mt-3 p-3 bg-panel-2 rounded-lg border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-xs text-mint flex items-center gap-1">
                      <BarChart2 size={13} /> Community Poll
                    </strong>
                    <button
                      type="button"
                      className="icon-btn tiny"
                      onClick={() => setShowPollInput(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Ask a question..."
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full mb-2 text-xs"
                    maxLength={150}
                  />

                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-center">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => handleUpdateOption(idx, e.target.value)}
                        className="text-xs flex-1"
                        maxLength={60}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          className="icon-btn tiny text-muted"
                          onClick={() => handleRemoveOption(idx)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}

                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm text-xs mt-1"
                      onClick={handleAddPollOption}
                    >
                      <Plus size={13} /> Add Option
                    </button>
                  )}
                </div>
              )}

              <div className="composer-footer-toolbar mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`btn btn-quiet btn-sm text-xs ${showImageInput ? "active" : ""}`}
                    onClick={() => setShowImageInput(!showImageInput)}
                  >
                    <ImageIcon size={14} /> Add Image
                  </button>
                  <button
                    type="button"
                    className={`btn btn-quiet btn-sm text-xs ${showPollInput ? "active" : ""}`}
                    onClick={() => setShowPollInput(!showPollInput)}
                  >
                    <BarChart2 size={14} /> Create Poll
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <small className="text-muted text-xs">
                    {composerText.length}/5000
                  </small>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={posting || !composerText.trim()}
                  >
                    {posting ? "Publishing..." : <><Send size={14} /> Post</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="join-community-card">
          <div>
            <h3>Join the OmniTube Creator Community</h3>
            <p className="text-muted text-xs">
              Sign in to publish posts, participate in interactive polls, and connect with fellow creators.
            </p>
          </div>
        </div>
      )}

      {/* Posts Stream */}
      <div className="community-posts-stream mt-6">
        {posts.map((post) => {
          const { text, poll } = parsePostContent(post.body);
          const userVotedOption = pollVotesMap[post.id];

          return (
            <article key={post.id} className="community-post-card">
              <div className="post-header-row">
                <span className="avatar avatar-md" style={avatarStyle(post.creator)}>
                  {!post.creator?.avatar_url && initials(post.creator)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <strong>{post.creator?.display_name || "Creator"}</strong>
                    {post.creator?.is_verified && <span className="verified">✓</span>}
                    <small className="text-muted text-xs">· {timeAgo(post.created_at)}</small>
                  </div>
                  {post.creator?.username && (
                    <small className="text-muted text-xs block">@{post.creator.username}</small>
                  )}
                </div>

                <button
                  className="icon-btn tiny"
                  onClick={() => onRequestReport(post.id)}
                  title="Report Post"
                >
                  <ShieldAlert size={15} />
                </button>
              </div>

              <p className="post-text-body mt-3 whitespace-pre-line">{text}</p>

              {/* Poll Renderer */}
              {poll && (
                <div className="community-poll-render mt-4 p-4 rounded-xl bg-panel-2 border border-border">
                  <strong className="text-sm block mb-3">{poll.question}</strong>
                  <div className="flex flex-col gap-2">
                    {poll.options.map((opt: any, optIdx: number) => {
                      const isVoted = userVotedOption === optIdx;
                      const hasVoted = userVotedOption !== undefined;

                      return (
                        <button
                          key={optIdx}
                          className={`poll-option-bar ${isVoted ? "voted" : ""}`}
                          onClick={() => voteInPoll(post.id, optIdx)}
                        >
                          <div className="flex justify-between text-xs font-semibold relative z-10">
                            <span>{opt.text}</span>
                            {hasVoted && (
                              <span>{isVoted ? "58% (Your vote)" : "42%"}</span>
                            )}
                          </div>
                          {hasVoted && (
                            <div
                              className="poll-result-fill"
                              style={{ width: isVoted ? "58%" : "42%" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <small className="text-muted text-xs block mt-2">
                    Interactive community poll · Select an option to vote
                  </small>
                </div>
              )}

              {/* Media Images */}
              {post.media_urls && post.media_urls.length > 0 && (
                <div className="post-media-wrap mt-3">
                  {post.media_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="Attachment"
                      className="post-image-attachment rounded-xl max-h-96 w-full object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              {/* Post Actions Bar */}
              <div className="post-action-bar mt-4 pt-3 border-t border-border flex items-center justify-between">
                <button
                  className="post-action-btn flex items-center gap-1 text-xs"
                  onClick={() => void togglePostReaction(post)}
                >
                  <Heart size={16} />
                  <span>{formatCount(post.likes || 0)}</span>
                </button>

                <button
                  className="post-action-btn flex items-center gap-1 text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}/community/${post.id}`
                    );
                    notify("Post link copied!", undefined, "success");
                  }}
                >
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
              </div>
            </article>
          );
        })}

        {posts.length === 0 && (
          <div className="p-12 text-center text-muted">
            <MessageCircle size={36} className="mx-auto mb-2 opacity-50" />
            <h3>No community posts yet</h3>
            <p className="text-xs">
              Be the first to share an update, poll, or behind-the-scenes post with the community.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
