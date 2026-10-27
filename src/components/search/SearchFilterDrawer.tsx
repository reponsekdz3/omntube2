import { useState } from "react";
import {
  Filter,
  SlidersHorizontal,
  X,
  Music2,
  Coins,
  Sparkles,
  Clapperboard,
  RotateCcw,
  Check,
  Split,
  Eye,
  Clock,
  Layers,
} from "lucide-react";

export type SearchFilters = {
  category: string;
  kind: "all" | "video" | "short";
  duration: "all" | "short" | "medium" | "long";
  sort: "latest" | "views" | "trending" | "relevance";
  hasSoundTrack?: boolean;
  isMonetized?: boolean;
};

interface SearchFilterBarProps {
  filters: SearchFilters;
  onChange: (updated: Partial<SearchFilters>) => void;
  onReset: () => void;
  categoryCounts?: Record<string, number>;
}

export function SearchFilterBar({
  filters,
  onChange,
  onReset,
  categoryCounts = {},
}: SearchFilterBarProps) {
  const [showDrawer, setShowDrawer] = useState(false);

  const categories = [
    "All",
    "Technology",
    "Gaming",
    "Music",
    "Education",
    "Science",
    "Lifestyle",
    "Sports",
    "Comedy",
    "Film",
  ];

  const hasActiveFilters =
    Boolean(filters.category) ||
    filters.kind !== "all" ||
    filters.duration !== "all" ||
    filters.sort !== "latest" ||
    Boolean(filters.hasSoundTrack) ||
    Boolean(filters.isMonetized);

  return (
    <div className="search-filters-wrapper mb-6">
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 scrollbar-none">
        {/* Category Pills with Dynamic Theme & Facet Counts */}
        <div className="flex items-center gap-2 m-0 p-0 overflow-x-auto">
          {categories.map((cat) => {
            const isSelected = filters.category === (cat === "All" ? "" : cat);
            const count = cat === "All" ? undefined : categoryCounts[cat];
            return (
              <button
                key={cat}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 border cursor-pointer ${
                  isSelected
                    ? "bg-[var(--text)] text-[var(--bg)] border-[var(--text)] shadow-sm font-bold scale-[1.02]"
                    : "bg-[var(--panel)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                }`}
                onClick={() => onChange({ category: cat === "All" ? "" : cat })}
              >
                <span>{cat}</span>
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? "bg-[var(--bg)]/30 text-[var(--bg)]"
                        : "bg-[var(--panel-2)] text-[var(--muted)]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Filter Badges (Sounds, Duets, Monetized) */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-[var(--border)]">
          <button
            onClick={() => onChange({ hasSoundTrack: !filters.hasSoundTrack })}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition cursor-pointer ${
              filters.hasSoundTrack
                ? "bg-cyan-500/15 border-cyan-500 text-cyan-500 font-bold"
                : "bg-[var(--panel)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            title="Filter videos with reusable backing tracks"
          >
            <Music2 size={13} />
            <span className="hidden sm:inline">Sounds</span>
          </button>

          <button
            onClick={() => onChange({ isMonetized: !filters.isMonetized })}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition cursor-pointer ${
              filters.isMonetized
                ? "bg-amber-500/15 border-amber-500 text-amber-500 font-bold"
                : "bg-[var(--panel)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
            title="Filter Web3 monetized videos with royalties"
          >
            <Coins size={13} />
            <span className="hidden sm:inline">Web3</span>
          </button>

          {/* Filter Drawer Toggle */}
          <button
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              hasActiveFilters
                ? "bg-[var(--mint-light)] text-[var(--mint)] border-[var(--mint)] shadow-sm"
                : "bg-[var(--panel)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel-2)]"
            }`}
            onClick={() => setShowDrawer(true)}
          >
            <SlidersHorizontal size={13} />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--mint)]" />
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filter Modal Drawer */}
      {showDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 transition-all"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowDrawer(false);
          }}
        >
          <section
            className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-2xl text-[var(--text)] relative flex flex-col gap-5 transition-all"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <p className="text-[10px] font-mono font-bold text-[var(--mint)] uppercase tracking-wider">
                  OPEN SEARCH ENGINE
                </p>
                <h2 className="text-base font-black font-['Space_Grotesk'] text-[var(--text)]">
                  Discovery & Feed Filters
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Fine-tune feeds by format, duration, audio lineage, and metrics.
                </p>
              </div>
              <button
                className="rounded-xl p-1.5 text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)] transition"
                onClick={() => setShowDrawer(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Format Option */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[var(--mint)] uppercase tracking-wider flex items-center gap-1.5">
                  <Clapperboard size={13} /> Format
                </h4>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "all", label: "All Formats" },
                    { id: "video", label: "Standard Video" },
                    { id: "short", label: "Omni Shorts" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onChange({ kind: opt.id as any })}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                        filters.kind === opt.id
                          ? "bg-[var(--mint-light)] border-[var(--mint)] text-[var(--mint)] font-bold"
                          : "bg-[var(--panel-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {filters.kind === opt.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Option */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[var(--mint)] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} /> Duration
                </h4>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "all", label: "Any Duration" },
                    { id: "short", label: "< 4 Minutes" },
                    { id: "medium", label: "4 - 20 Minutes" },
                    { id: "long", label: "> 20 Minutes" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onChange({ duration: opt.id as any })}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                        filters.duration === opt.id
                          ? "bg-[var(--mint-light)] border-[var(--mint)] text-[var(--mint)] font-bold"
                          : "bg-[var(--panel-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {filters.duration === opt.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[var(--mint)] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye size={13} /> Sort By
                </h4>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "latest", label: "Latest Uploads" },
                    { id: "views", label: "Most Viewed" },
                    { id: "trending", label: "Trending Velocity" },
                    { id: "relevance", label: "Search Relevance" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onChange({ sort: opt.id as any })}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                        filters.sort === opt.id
                          ? "bg-[var(--mint-light)] border-[var(--mint)] text-[var(--mint)] font-bold"
                          : "bg-[var(--panel-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {filters.sort === opt.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Special Feature Toggles */}
            <div className="p-3.5 rounded-2xl bg-[var(--panel-2)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={Boolean(filters.hasSoundTrack)}
                  onChange={(e) => onChange({ hasSoundTrack: e.target.checked })}
                  className="rounded accent-cyan-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Music2 size={13} className="text-cyan-400" /> Backing Sound Track Attached
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={Boolean(filters.isMonetized)}
                  onChange={(e) => onChange({ isMonetized: e.target.checked })}
                  className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Coins size={13} className="text-amber-400" /> Web3 On-Chain Royalties / PPV
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] transition cursor-pointer"
                onClick={() => {
                  onReset();
                  setShowDrawer(false);
                }}
              >
                <RotateCcw size={13} /> Reset Filters
              </button>
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-xs font-bold text-slate-950 shadow-md shadow-cyan-500/20 transition cursor-pointer"
                onClick={() => setShowDrawer(false)}
              >
                Apply Filters
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
