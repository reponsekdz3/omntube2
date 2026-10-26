import React, { useEffect, useState } from "react";
import { Check, FolderPlus, Plus, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Notice, PlaylistRow, VideoRow } from "../../types";

export function PlaylistDialog({
  video,
  userId,
  onClose,
  notify,
}: {
  video: VideoRow;
  userId: string;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [membership, setMembership] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "private">("private");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data: userPlaylists, error } = await supabase
        .from("playlists")
        .select("id,owner_id,title,description,visibility,created_at,updated_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        notify("Could not load playlists", error.message, "error");
        setLoading(false);
        return;
      }

      const lists = (userPlaylists || []) as PlaylistRow[];
      setPlaylists(lists);

      if (lists.length > 0) {
        const { data: items } = await supabase
          .from("playlist_items")
          .select("playlist_id")
          .eq("video_id", video.id)
          .in(
            "playlist_id",
            lists.map((l) => l.id)
          );
        if (active && items) {
          setMembership(new Set(items.map((i: any) => i.playlist_id)));
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, video.id, notify]);

  const togglePlaylist = async (playlistId: string) => {
    const isMember = membership.has(playlistId);
    if (isMember) {
      const { error } = await supabase
        .from("playlist_items")
        .delete()
        .eq("playlist_id", playlistId)
        .eq("video_id", video.id);

      if (error) {
        notify("Could not remove from playlist", error.message, "error");
      } else {
        setMembership((prev) => {
          const next = new Set(prev);
          next.delete(playlistId);
          return next;
        });
        notify("Removed from playlist.");
      }
    } else {
      const { error } = await supabase.from("playlist_items").insert({
        playlist_id: playlistId,
        video_id: video.id,
        position: 0,
      });

      if (error) {
        notify("Could not add to playlist", error.message, "error");
      } else {
        setMembership((prev) => {
          const next = new Set(prev);
          next.add(playlistId);
          return next;
        });
        notify("Added to playlist.", undefined, "success");
      }
    }
  };

  const createPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("playlists")
      .insert({
        owner_id: userId,
        title,
        description: "",
        visibility: newVisibility,
      })
      .select("id,owner_id,title,description,visibility,created_at,updated_at")
      .single();

    if (error || !data) {
      notify("Failed to create playlist", error?.message, "error");
      setCreating(false);
      return;
    }

    // Automatically add video to this new playlist
    await supabase.from("playlist_items").insert({
      playlist_id: data.id,
      video_id: video.id,
      position: 0,
    });

    setPlaylists((prev) => [data as PlaylistRow, ...prev]);
    setMembership((prev) => new Set([...prev, data.id]));
    setNewTitle("");
    setShowCreate(false);
    setCreating(false);
    notify(`Created "${title}" and added video.`, undefined, "success");
  };

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="modal-panel playlist-dialog" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">SAVE VIDEO</p>
            <h2>Add to playlist</h2>
            <p className="muted">Organize "{video.title}" into your custom collections.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="playlist-list-container">
          {loading ? (
            <div className="p-4 text-center text-muted">
              <span className="spinner" /> Loading playlists...
            </div>
          ) : (
            <div className="playlist-checkbox-list">
              {playlists.map((pl) => {
                const checked = membership.has(pl.id);
                return (
                  <button
                    key={pl.id}
                    className={`playlist-item-row ${checked ? "active" : ""}`}
                    onClick={() => void togglePlaylist(pl.id)}
                    type="button"
                  >
                    <div className={`checkbox-box ${checked ? "checked" : ""}`}>
                      {checked && <Check size={14} />}
                    </div>
                    <div className="playlist-info">
                      <strong>{pl.title}</strong>
                      <small className="muted">{pl.visibility}</small>
                    </div>
                  </button>
                );
              })}

              {playlists.length === 0 && !showCreate && (
                <div className="empty-state-mini">
                  <FolderPlus size={24} />
                  <p>You haven't created any custom playlists yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {showCreate ? (
          <form onSubmit={createPlaylist} className="new-playlist-inline-form">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              maxLength={100}
              autoFocus
            />
            <div className="form-row-compact">
              <select
                value={newVisibility}
                onChange={(e) => setNewVisibility(e.target.value as "public" | "private")}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <div className="flex-buttons">
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !newTitle.trim()}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-quiet full"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} /> Create new playlist
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
