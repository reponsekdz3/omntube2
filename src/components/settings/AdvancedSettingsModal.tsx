import React, { useState } from "react";
import {
  Bell,
  Check,
  Coins,
  Cpu,
  Database,
  Eye,
  Flame,
  Globe,
  HardDrive,
  Lock,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Tv,
  Volume2,
  X,
  Zap,
} from "lucide-react";

export interface AppSettings {
  theme: "light" | "dark" | "system";
  defaultQuality: "auto" | "4k" | "1080p" | "720p";
  autoplayNext: boolean;
  ambientLighting: boolean;
  audioNormalization: boolean;
  defaultSpeed: number;
  pipAutoTrigger: boolean;
  preferredChain: string;
  gasSpeed: "standard" | "fast" | "instant";
  autoPromptPpv: boolean;
  slippageTolerance: string;
  defaultTipAmount: number;
  saveHistory: boolean;
  personalizedFeed: boolean;
  compactSidebar: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  defaultQuality: "1080p",
  autoplayNext: true,
  ambientLighting: true,
  audioNormalization: true,
  defaultSpeed: 1,
  pipAutoTrigger: false,
  preferredChain: "137", // Polygon default
  gasSpeed: "fast",
  autoPromptPpv: true,
  slippageTolerance: "0.5%",
  defaultTipAmount: 5,
  saveHistory: true,
  personalizedFeed: true,
  compactSidebar: false,
  reducedMotion: false,
};

const STORAGE_KEY = "omnitube_settings_v2";

export function loadStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // fallback
  }
}

export function AdvancedSettingsModal({
  settings,
  onUpdateSettings,
  onClose,
  notify,
}: {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: "info" | "success" | "error") => void;
}) {
  const [activeTab, setActiveTab] = useState<"playback" | "web3" | "privacy" | "appearance">("appearance");
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [cacheCleared, setCacheCleared] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...localSettings, [key]: value };
    setLocalSettings(next);
    onUpdateSettings(next);
    saveStoredSettings(next);
  };

  const handleResetDefaults = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    onUpdateSettings(DEFAULT_SETTINGS);
    saveStoredSettings(DEFAULT_SETTINGS);
    notify("Settings Reset", "All application settings returned to default porcelain white configuration.", "info");
  };

  const handleClearCache = () => {
    setCacheCleared(true);
    try {
      sessionStorage.clear();
      notify("Cache Cleared", "Local media buffers and transient playback states refreshed.", "success");
      setTimeout(() => setCacheCleared(false), 3000);
    } catch {
      // ignore
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
      <div className="modal-panel settings-modal-panel" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-title">
            <div className="settings-icon-badge">
              <Sliders size={20} />
            </div>
            <div>
              <h2>Application Settings</h2>
              <p>Configure playback, multi-chain Web3 presets, privacy, and visual appearance</p>
            </div>
          </div>
          <button className="icon-btn tiny close-modal" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs-bar">
          <button
            className={"settings-tab-btn " + (activeTab === "appearance" ? "active" : "")}
            onClick={() => setActiveTab("appearance")}
          >
            <Palette size={16} />
            <span>Appearance & Theme</span>
          </button>
          <button
            className={"settings-tab-btn " + (activeTab === "playback" ? "active" : "")}
            onClick={() => setActiveTab("playback")}
          >
            <Play size={16} />
            <span>Playback & Player</span>
          </button>
          <button
            className={"settings-tab-btn " + (activeTab === "web3" ? "active" : "")}
            onClick={() => setActiveTab("web3")}
          >
            <Coins size={16} />
            <span>Web3 & Gas Presets</span>
          </button>
          <button
            className={"settings-tab-btn " + (activeTab === "privacy" ? "active" : "")}
            onClick={() => setActiveTab("privacy")}
          >
            <Shield size={16} />
            <span>Privacy & Cloud SQL</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="settings-content-body">
          {/* TAB 1: APPEARANCE */}
          {activeTab === "appearance" && (
            <div className="settings-section-grid">
              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Color Theme Mode</strong>
                  <p>Choose between the default high-contrast porcelain white or midnight dark theme</p>
                </div>
                <div className="settings-theme-selector">
                  <button
                    className={"theme-option-btn " + (localSettings.theme === "light" ? "active" : "")}
                    onClick={() => update("theme", "light")}
                  >
                    <Sun size={17} />
                    <span>Porcelain White</span>
                    {localSettings.theme === "light" && <Check size={14} className="theme-check" />}
                  </button>
                  <button
                    className={"theme-option-btn " + (localSettings.theme === "dark" ? "active" : "")}
                    onClick={() => update("theme", "dark")}
                  >
                    <Moon size={17} />
                    <span>Midnight Dark</span>
                    {localSettings.theme === "dark" && <Check size={14} className="theme-check" />}
                  </button>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Compact Sidebar Mode</strong>
                  <p>Optimize space by defaulting to condensed navigation groupings</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.compactSidebar}
                    onChange={(e) => update("compactSidebar", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Smooth Motion & Transitions</strong>
                  <p>Enable fluid animations across video cards, sliders, and modal drawers</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={!localSettings.reducedMotion}
                    onChange={(e) => update("reducedMotion", !e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: PLAYBACK */}
          {activeTab === "playback" && (
            <div className="settings-section-grid">
              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Default Playback Resolution</strong>
                  <p>Automatically select highest resolution matching your connection</p>
                </div>
                <select
                  className="settings-select"
                  value={localSettings.defaultQuality}
                  onChange={(e) => update("defaultQuality", e.target.value as any)}
                >
                  <option value="4k">4K Ultra HD (2160p)</option>
                  <option value="1080p">Full HD (1080p 60fps)</option>
                  <option value="720p">High Definition (720p)</option>
                  <option value="auto">Adaptive Auto</option>
                </select>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Ambient Video Lighting</strong>
                  <p>Cast dynamic frosted ambient backlight behind video player in theater mode</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.ambientLighting}
                    onChange={(e) => update("ambientLighting", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Autoplay Next Up</strong>
                  <p>Seamlessly transition into related creator media or playlist sequence</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.autoplayNext}
                    onChange={(e) => update("autoplayNext", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Audio Volume Normalization</strong>
                  <p>Prevents sudden volume spikes across different creator broadcasts</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.audioNormalization}
                    onChange={(e) => update("audioNormalization", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Default Playback Speed</strong>
                  <p>Set baseline rate for long-form podcasts, tutorials, or streams</p>
                </div>
                <div className="settings-pill-group">
                  {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      className={"pill-btn " + (localSettings.defaultSpeed === spd ? "active" : "")}
                      onClick={() => update("defaultSpeed", spd)}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WEB3 */}
          {activeTab === "web3" && (
            <div className="settings-section-grid">
              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Default Multi-Chain Network</strong>
                  <p>Preferred blockchain for creator tipping, PPV paywalls, and memberships</p>
                </div>
                <select
                  className="settings-select"
                  value={localSettings.preferredChain}
                  onChange={(e) => update("preferredChain", e.target.value)}
                >
                  <option value="137">Polygon PoS (Ultra-low gas fees)</option>
                  <option value="42161">Arbitrum One (L2 Ethereum speed)</option>
                  <option value="56">BNB Smart Chain (Binance Ecosystem)</option>
                  <option value="1">Ethereum Mainnet (Global standard)</option>
                </select>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Gas Priority Speed</strong>
                  <p>Adjust transaction inclusion priority for SuperChats and PPV unlocks</p>
                </div>
                <div className="settings-pill-group">
                  {[
                    { id: "standard", label: "Economy" },
                    { id: "fast", label: "Fast" },
                    { id: "instant", label: "Instant Priority" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      className={"pill-btn " + (localSettings.gasSpeed === g.id ? "active" : "")}
                      onClick={() => update("gasSpeed", g.id as any)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Pay-Per-View Smart Auto-Prompt</strong>
                  <p>Directly present wallet unlock modal when accessing premium token-gated content</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.autoPromptPpv}
                    onChange={(e) => update("autoPromptPpv", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Quick Tip Amount Preset</strong>
                  <p>Default value populated in creator Web3 tipping modal</p>
                </div>
                <div className="settings-pill-group">
                  {[1, 5, 10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      className={"pill-btn " + (localSettings.defaultTipAmount === amt ? "active" : "")}
                      onClick={() => update("defaultTipAmount", amt)}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY & CLOUDSQL */}
          {activeTab === "privacy" && (
            <div className="settings-section-grid">
              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Cloud SQL Persistence Connection</strong>
                  <p>Real-time relational PostgreSQL instance running in europe-west2</p>
                </div>
                <div className="cloudsql-status-badge">
                  <Database size={15} color="#0d9488" />
                  <span>Cloud SQL Active</span>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Watch History Recording</strong>
                  <p>Store playback timestamp progress for seamless resume across sessions</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.saveHistory}
                    onChange={(e) => update("saveHistory", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Personalized Recommendations</strong>
                  <p>Curate discovery feed using your subscribed topics and viewing tags</p>
                </div>
                <label className="switch-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.personalizedFeed}
                    onChange={(e) => update("personalizedFeed", e.target.checked)}
                  />
                  <span className="slider-pill" />
                </label>
              </div>

              <div className="settings-row">
                <div className="settings-row-text">
                  <strong>Local Media Cache & Buffers</strong>
                  <p>Flush temporary cached frames and stored playback sessions</p>
                </div>
                <button
                  className="btn btn-quiet"
                  onClick={handleClearCache}
                  disabled={cacheCleared}
                >
                  {cacheCleared ? (
                    <>
                      <Check size={14} color="#0d9488" /> Cache Flushed
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} /> Clear Cache
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="btn btn-quiet" onClick={handleResetDefaults}>
            <RotateCcw size={14} /> Reset to Defaults
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done & Apply
          </button>
        </div>
      </div>
    </div>
  );
}
