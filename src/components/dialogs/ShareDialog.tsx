import { useState } from "react";
import { Check, Copy, Globe, Share2, X } from "lucide-react";
import type { Notice, VideoRow } from "../../types";

export function ShareDialog({
  video,
  currentTime = 0,
  onClose,
  notify,
}: {
  video: VideoRow;
  currentTime?: number;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [includeTime, setIncludeTime] = useState(false);
  const [copied, setCopied] = useState(false);

  const roundedTime = Math.floor(currentTime);
  const baseUrl = `${window.location.origin}/watch/${video.id}`;
  const shareUrl = includeTime && roundedTime > 0 ? `${baseUrl}?t=${roundedTime}` : baseUrl;
  const embedCode = `<iframe width="560" height="315" src="${baseUrl}?embed=true" title="${video.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      notify("Link copied to clipboard!", undefined, "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify("Failed to copy link.", undefined, "error");
    }
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      notify("Embed code copied to clipboard!", undefined, "success");
    } catch {
      notify("Failed to copy embed code.", undefined, "error");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: `Watch "${video.title}" on OmniTube`,
          url: shareUrl,
        });
      } catch {
        // User dismissed
      }
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
      <section className="modal-panel share-dialog" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">SHARE CONTENT</p>
            <h2>Share this video</h2>
            <p className="muted">{video.title}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="share-content-body">
          <div className="share-link-box">
            <input type="text" readOnly value={shareUrl} className="share-input" />
            <button className="btn btn-primary" onClick={copyUrl}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {roundedTime > 0 && (
            <label className="checkbox-label mt-3">
              <input
                type="checkbox"
                checked={includeTime}
                onChange={(e) => setIncludeTime(e.target.value === "true" || e.target.checked)}
              />
              <span>
                Start at <strong>{Math.floor(roundedTime / 60)}:{String(roundedTime % 60).padStart(2, "0")}</strong>
              </span>
            </label>
          )}

          <div className="share-actions-row mt-4">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button className="btn btn-quiet" onClick={nativeShare}>
                <Share2 size={16} /> System Share
              </button>
            )}
            <button className="btn btn-quiet" onClick={copyEmbed}>
              <Globe size={16} /> Copy Embed Code
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
