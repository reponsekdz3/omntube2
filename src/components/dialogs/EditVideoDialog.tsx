import React, { useState } from "react";
import { Check, Tag, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Notice, VideoRow } from "../../types";

export function EditVideoDialog({
  video,
  userId,
  onClose,
  onUpdated,
  notify,
}: {
  video: VideoRow;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description || "");
  const [visibility, setVisibility] = useState(video.visibility);
  const [kind, setKind] = useState<"video" | "short">(video.kind);
  const [category, setCategory] = useState(video.category || "Other");
  const [allowComments, setAllowComments] = useState(video.allow_comments !== false);
  const [tagsInput, setTagsInput] = useState((video.tags || []).join(", "));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
      .filter((t) => t.length > 0 && t.length <= 40)
      .slice(0, 15);

    const { error } = await supabase
      .from("videos")
      .update({
        title: title.trim(),
        description: description.trim(),
        visibility,
        kind,
        category,
        allow_comments: allowComments,
        tags: parsedTags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id)
      .eq("creator_id", userId)
      .select("id")
      .single();

    setBusy(false);
    if (error) {
      notify("Video changes could not be saved", error.message, "error");
    } else {
      notify("Video updated successfully.", undefined, "success");
      onUpdated();
      onClose();
    }
  };

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section className="modal-panel upload-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">CREATOR STUDIO / CONTENT MANAGER</p>
            <h2>Edit video details</h2>
            <p className="muted">
              Update title, description, tags, and audience permissions.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close editor">
            <X size={18} />
          </button>
        </div>

        <form className="upload-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-field wide">
              <label htmlFor="edit-title">Title</label>
              <input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={180}
                required
              />
            </div>

            <div className="form-field wide">
              <label htmlFor="edit-desc">Description</label>
              <textarea
                id="edit-desc"
                rows={4}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Include timestamps (e.g. 01:25 Intro) for automatic chapters."
              />
            </div>

            <div className="form-field wide">
              <label htmlFor="edit-tags">
                <span className="flex items-center gap-1">
                  <Tag size={13} /> Tags (comma separated)
                </span>
              </label>
              <input
                id="edit-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. coding, tutorial, tech, gaming"
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-visibility">Audience & Visibility</label>
              <select
                id="edit-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">Public — discoverable worldwide</option>
                <option value="unlisted">Unlisted — accessible by link only</option>
                <option value="private">Private — only visible to you</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="edit-kind">Format</label>
              <select
                id="edit-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "video" | "short")}
              >
                <option value="video">Standard Video (16:9)</option>
                <option value="short">Omni Short (9:16)</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Technology",
                  "Education",
                  "Gaming",
                  "Music",
                  "Science",
                  "Lifestyle",
                  "Sports",
                  "News",
                  "Comedy",
                  "Film",
                  "Other",
                ].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="edit-comments">Viewer Interaction</label>
              <select
                id="edit-comments"
                value={allowComments ? "on" : "off"}
                onChange={(e) => setAllowComments(e.target.value === "on")}
              >
                <option value="on">Comments enabled</option>
                <option value="off">Comments disabled</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-quiet"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !title.trim()}
            >
              {busy ? "Saving..." : <><Check size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
