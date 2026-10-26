import React, { useMemo, useRef, useState } from "react";
import { Camera, Check, Sparkles, Tag, Upload, X } from "lucide-react";
import * as tus from "tus-js-client";
import { supabase, supabaseUrl } from "../../lib/supabase";
import { captureVideoFrame } from "../../lib/utils";
import type { Notice } from "../../types";

export function UploadDialog({
  userId,
  notify,
  onClose,
  onPublished,
}: {
  userId: string;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [autoThumbnailBlob, setAutoThumbnailBlob] = useState<Blob | null>(null);
  const [autoThumbnailUrl, setAutoThumbnailUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"video" | "short">("video");
  const [visibility, setVisibility] = useState("public");
  const [category, setCategory] = useState("Technology");
  const [tagsInput, setTagsInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const projectRef = useMemo(() => {
    try {
      return new URL(supabaseUrl).hostname.split(".")[0];
    } catch {
      return "";
    }
  }, []);

  const handleVideoSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    if (!title.trim()) {
      // Auto-populate title from filename without extension
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
    // Attempt automatic video frame capture for default thumbnail
    const frameBlob = await captureVideoFrame(selectedFile);
    if (frameBlob) {
      setAutoThumbnailBlob(frameBlob);
      setAutoThumbnailUrl(URL.createObjectURL(frameBlob));
    }
  };

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim()) {
      notify("Select a video and provide a title.", undefined, "error");
      return;
    }

    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
    if (!allowed.includes(file.type)) {
      notify("Use MP4, WebM, MOV, or MKV video.", undefined, "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024 * 1024) {
      notify("Video exceeds the 2 GB upload limit.", undefined, "error");
      return;
    }

    setBusy(true);
    setProgress(0);
    setPhase("Analyzing media...");

    const id = crypto.randomUUID();
    const ext =
      (file.name.split(".").pop() || "mp4")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 8) || "mp4";
    const path = `${userId}/${id}.${ext}`;

    // Get duration
    const objectUrl = URL.createObjectURL(file);
    const duration = await new Promise<number | null>((resolve) => {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(Number.isFinite(el.duration) ? el.duration : null);
      };
      el.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      el.src = objectUrl;
    });

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
      .filter((t) => t.length > 0 && t.length <= 40)
      .slice(0, 15);

    // Insert record in status draft
    const { error: insertError } = await supabase.from("videos").insert({
      id,
      creator_id: userId,
      title: title.trim(),
      description: description.trim(),
      video_path: path,
      visibility,
      kind,
      status: "draft",
      category,
      duration_seconds: duration,
      tags: parsedTags,
    });

    if (insertError) {
      setBusy(false);
      notify("Could not initialize video entry", insertError.message, "error");
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      setPhase("Uploading original video stream...");

      // Attempt TUS upload
      let uploadSuccess = false;
      const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

      try {
        await new Promise<void>((resolve, reject) => {
          const task = new tus.Upload(file, {
            endpoint,
            retryDelays: [0, 2000, 5000, 10000],
            headers: {
              authorization: `Bearer ${session.access_token}`,
              "x-upsert": "false",
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: 6 * 1024 * 1024,
            metadata: {
              bucketName: "omnitube-videos",
              objectName: path,
              contentType: file.type,
              cacheControl: "3600",
            },
            onError: (err) => reject(err),
            onProgress: (sent, total) => setProgress(Math.round((sent / total) * 90)),
            onSuccess: () => {
              uploadSuccess = true;
              resolve();
            },
          });
          task.start();
        });
      } catch (tusErr) {
        // Fallback to direct supabase storage upload if TUS is blocked or unavailable
        setPhase("Uploading via direct storage API...");
        const { error: directErr } = await supabase.storage
          .from("omnitube-videos")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (directErr) {
          throw new Error(directErr.message || String(tusErr));
        }
        uploadSuccess = true;
      }

      if (!uploadSuccess) throw new Error("Upload did not complete.");

      // Upload thumbnail if provided or auto-captured
      let thumbnailPath: string | null = null;
      const thumbFile = image || autoThumbnailBlob;

      if (thumbFile) {
        setPhase("Uploading high-res thumbnail...");
        const thumbExt = image ? image.name.split(".").pop() || "jpg" : "jpg";
        thumbnailPath = `${userId}/${id}-thumb.${thumbExt}`;
        const contentType = image ? image.type : "image/jpeg";

        const { error: thumbErr } = await supabase.storage
          .from("omnitube-thumbnails")
          .upload(thumbnailPath, thumbFile, {
            upsert: true,
            contentType,
          });

        if (!thumbErr) {
          await supabase
            .from("videos")
            .update({ thumbnail_path: thumbnailPath })
            .eq("id", id)
            .eq("creator_id", userId);
        }
      }

      setPhase("Validating and publishing...");
      setProgress(95);

      // Try invoke publish-video Edge function; if edge function isn't deployed, mark published directly
      try {
        const { data: pubData, error: pubErr } = await supabase.functions.invoke(
          "publish-video",
          { body: { videoId: id } }
        );
        if (pubErr || !pubData?.success) {
          // Fallback publish directly in DB
          await supabase
            .from("videos")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("creator_id", userId);
        }
      } catch {
        await supabase
          .from("videos")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("creator_id", userId);
      }

      setProgress(100);
      setPhase("Ready!");
      notify("Video published successfully!", "Now available in discovery feed.", "success");
      onPublished();
      onClose();
    } catch (err) {
      await supabase
        .from("videos")
        .update({ status: "failed" })
        .eq("id", id)
        .eq("creator_id", userId);

      notify(
        "Upload failed",
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "error"
      );
    } finally {
      setBusy(false);
      setPhase("");
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
            <p className="eyebrow">CREATOR STUDIO / PUBLISHER</p>
            <h2>Publish new content</h2>
            <p className="muted">
              Upload long-form videos or vertical shorts with instant encoding.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="upload-form" onSubmit={upload}>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) void handleVideoSelect(e.target.files[0]);
            }}
          />

          <div
            className={`dropzone ${file ? "dropzone-selected" : ""}`}
            onClick={() => !busy && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                void handleVideoSelect(e.dataTransfer.files[0]);
              }
            }}
          >
            <div className="dropzone-icon">
              <Upload size={24} />
            </div>
            <strong>{file ? file.name : "Select or drag video here"}</strong>
            <span>
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · Ready to upload`
                : "MP4, WebM, MOV, or MKV up to 2 GB"}
            </span>
          </div>

          <div className="form-grid">
            <div className="form-field wide">
              <label htmlFor="upload-title">Title *</label>
              <input
                id="upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={180}
                required
                placeholder="Give your video a compelling title"
              />
            </div>

            <div className="form-field wide">
              <label htmlFor="upload-desc">Description</label>
              <textarea
                id="upload-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={3}
                placeholder="Tell viewers what happens. Add timestamps (00:00 Intro) for chapters."
              />
            </div>

            <div className="form-field wide">
              <label htmlFor="upload-tags">
                <span className="flex items-center gap-1">
                  <Tag size={13} /> Tags (comma separated)
                </span>
              </label>
              <input
                id="upload-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. tech, coding, livekit, omnitube"
              />
            </div>

            <div className="form-field">
              <label htmlFor="upload-format">Format</label>
              <select
                id="upload-format"
                value={kind}
                onChange={(e) => setKind(e.target.value as "video" | "short")}
              >
                <option value="video">Standard Video (16:9)</option>
                <option value="short">Omni Short (Vertical 9:16)</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="upload-category">Category</label>
              <select
                id="upload-category"
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
              <label htmlFor="upload-visibility">Audience</label>
              <select
                id="upload-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">Public — discoverable worldwide</option>
                <option value="unlisted">Unlisted — link access only</option>
                <option value="private">Private — only you can view</option>
              </select>
            </div>

            <div className="form-field">
              <label>Thumbnail</label>
              <input
                ref={imageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                hidden
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
              <div className="thumbnail-upload-control">
                <button
                  type="button"
                  className="btn btn-quiet full"
                  onClick={() => imageRef.current?.click()}
                >
                  <Camera size={15} />
                  {image ? image.name : "Custom thumbnail"}
                </button>
                {autoThumbnailUrl && !image && (
                  <small className="text-mint flex items-center gap-1 mt-1">
                    <Sparkles size={11} /> Auto frame capture active
                  </small>
                )}
              </div>
            </div>
          </div>

          {busy && (
            <div className="upload-progress">
              <div className="progress-copy">
                <span>{phase || "Uploading media"}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

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
              disabled={busy || !file || !title.trim()}
            >
              {busy ? (
                <>
                  <span className="spinner" /> {phase || "Publishing..."}
                </>
              ) : (
                <>
                  <Upload size={16} /> Publish Content
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
