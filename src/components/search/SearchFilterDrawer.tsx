import { useState } from "react";
import { Filter, SlidersHorizontal, X } from "lucide-react";

export type SearchFilters = {
  category: string;
  kind: "all" | "video" | "short";
  duration: "all" | "short" | "medium" | "long";
  sort: "latest" | "views" | "trending";
};

export function SearchFilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: SearchFilters;
  onChange: (updated: Partial<SearchFilters>) => void;
  onReset: () => void;
}) {
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

  return (
    <div className="search-filters-wrapper mb-6">
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2">
        {/* Category Pills */}
        <div className="topic-row m-0 p-0">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`topic-pill ${
                filters.category === (cat === "All" ? "" : cat) ? "active" : ""
              }`}
              onClick={() => onChange({ category: cat === "All" ? "" : cat })}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter Drawer Toggle */}
        <button
          className={`btn btn-quiet text-xs flex items-center gap-1 shrink-0 ${
            filters.kind !== "all" || filters.duration !== "all" || filters.sort !== "latest"
              ? "btn-liked"
              : ""
          }`}
          onClick={() => setShowDrawer(true)}
        >
          <SlidersHorizontal size={14} />
          <span>Filters</span>
        </button>
      </div>

      {/* Filter Modal Drawer */}
      {showDrawer && (
        <div
          className="modal-scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowDrawer(false);
          }}
        >
          <section className="modal-panel filter-dialog" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">SEARCH ENGINE</p>
                <h2>Discovery Filters</h2>
                <p className="muted">Refine content by format, duration, and metrics.</p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowDrawer(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="filter-options-grid mt-4 grid grid-cols-3 gap-6">
              <div>
                <h4 className="text-xs font-bold text-mint uppercase tracking-wider mb-2">
                  Format
                </h4>
                <div className="flex flex-col gap-2">
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_kind"
                      checked={filters.kind === "all"}
                      onChange={() => onChange({ kind: "all" })}
                    />
                    <span>All Formats</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_kind"
                      checked={filters.kind === "video"}
                      onChange={() => onChange({ kind: "video" })}
                    />
                    <span>Standard Video</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_kind"
                      checked={filters.kind === "short"}
                      onChange={() => onChange({ kind: "short" })}
                    />
                    <span>Omni Shorts</span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-mint uppercase tracking-wider mb-2">
                  Duration
                </h4>
                <div className="flex flex-col gap-2">
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_dur"
                      checked={filters.duration === "all"}
                      onChange={() => onChange({ duration: "all" })}
                    />
                    <span>Any Duration</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_dur"
                      checked={filters.duration === "short"}
                      onChange={() => onChange({ duration: "short" })}
                    />
                    <span>Under 4 minutes</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_dur"
                      checked={filters.duration === "medium"}
                      onChange={() => onChange({ duration: "medium" })}
                    />
                    <span>4 - 20 minutes</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_dur"
                      checked={filters.duration === "long"}
                      onChange={() => onChange({ duration: "long" })}
                    />
                    <span>Over 20 minutes</span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-mint uppercase tracking-wider mb-2">
                  Sort Order
                </h4>
                <div className="flex flex-col gap-2">
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_sort"
                      checked={filters.sort === "latest"}
                      onChange={() => onChange({ sort: "latest" })}
                    />
                    <span>Latest Uploads</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_sort"
                      checked={filters.sort === "views"}
                      onChange={() => onChange({ sort: "views" })}
                    />
                    <span>Most Viewed</span>
                  </label>
                  <label className="filter-radio-label">
                    <input
                      type="radio"
                      name="filter_sort"
                      checked={filters.sort === "trending"}
                      onChange={() => onChange({ sort: "trending" })}
                    />
                    <span>Trending Now</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer mt-6">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  onReset();
                  setShowDrawer(false);
                }}
              >
                Reset Filters
              </button>
              <button
                type="button"
                className="btn btn-primary"
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
