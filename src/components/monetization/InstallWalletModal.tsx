import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { getInjectedProvider } from "../../lib/web3";

interface InstallWalletModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onInstalledAndConnected?: () => void;
  notify?: (title: string, detail?: string, kind?: "success" | "error" | "info") => void;
  autoRedirectWallet?: "metamask" | "binance" | null;
  preferredWallet?: "metamask" | "binance" | "all";
}

export const EXTENSION_URLS = {
  metamask: {
    name: "MetaMask",
    tagline: "The world's leading Web3 & DeFi wallet (Ethereum, Polygon, Arbitrum, BSC)",
    chromeStore: "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
    officialSite: "https://metamask.io/download/",
    icon: "🦊",
    badgeColor: "#E2761B",
  },
  binance: {
    name: "Binance Web3 Wallet",
    tagline: "Official Binance extension optimized for BNB Smart Chain with ultra-low gas fees",
    chromeStore: "https://chromewebstore.google.com/detail/binance-wallet/fhbohimaelbohpjbbldcngcnapndodjp",
    officialSite: "https://www.binance.com/en/web3wallet",
    icon: "🟡",
    badgeColor: "#F3BA2F",
  },
};

export function InstallWalletModal({
  isOpen = true,
  onClose,
  onInstalledAndConnected,
  notify,
  autoRedirectWallet = null,
  preferredWallet = "all",
}: InstallWalletModalProps) {
  if (isOpen === false) return null;

  const [countdown, setCountdown] = useState<number | null>(autoRedirectWallet ? 3 : null);
  const [redirectCancelled, setRedirectCancelled] = useState(false);
  const [checking, setChecking] = useState(false);

  // Auto-redirect timer if specified
  useEffect(() => {
    if (!autoRedirectWallet || redirectCancelled || countdown === null) return;
    if (countdown === 0) {
      const targetUrl = EXTENSION_URLS[autoRedirectWallet].chromeStore;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (notify) {
        notify(
          `Redirected to ${EXTENSION_URLS[autoRedirectWallet].name}`,
          "Complete the installation in your browser, then click 'Refresh & Connect'.",
          "info"
        );
      }
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, autoRedirectWallet, redirectCancelled, notify]);

  // Periodic provider detection to auto-connect once installed
  useEffect(() => {
    const interval = setInterval(() => {
      if (getInjectedProvider()) {
        if (onInstalledAndConnected) {
          onInstalledAndConnected();
        }
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [onInstalledAndConnected]);

  const handleManualCheck = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      const provider = getInjectedProvider();
      if (provider) {
        if (notify) notify("Wallet detected!", "Successfully discovered Web3 extension.", "success");
        if (onInstalledAndConnected) onInstalledAndConnected();
        onClose();
      } else {
        if (notify) {
          notify(
            "Extension not detected yet",
            "Please ensure MetaMask or Binance Wallet is installed and enabled in your browser extensions, then retry.",
            "error"
          );
        }
      }
    }, 600);
  };

  const handleOpenStore = (key: "metamask" | "binance") => {
    setRedirectCancelled(true);
    const target = EXTENSION_URLS[key];
    window.open(target.chromeStore, "_blank", "noopener,noreferrer");
    if (notify) {
      notify(
        `Opened ${target.name} Store`,
        "Install the extension from Chrome Web Store, then return here and click 'Check & Connect'.",
        "info"
      );
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
      <section
        className="modal-panel max-w-lg p-6 bg-panel border border-border rounded-2xl shadow-2xl relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-wallet-title"
      >
        <button
          className="icon-btn absolute top-4 right-4"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <h3 id="install-wallet-title" className="text-base font-bold tracking-tight text-text">
              Web3 Wallet Extension Required
            </h3>
            <p className="text-xs text-muted">
              Connect MetaMask or Binance Wallet for decentralized creator payouts & unlocks.
            </p>
          </div>
        </div>

        {/* Auto redirect banner if countdown active */}
        {countdown !== null && countdown > 0 && !redirectCancelled && autoRedirectWallet && (
          <div className="mb-4 p-3 rounded-xl bg-mint/10 border border-mint/25 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-text">
              <span className="w-2 h-2 rounded-full bg-mint animate-ping" />
              <span>
                Auto-redirecting to <strong>{EXTENSION_URLS[autoRedirectWallet].name}</strong> in {countdown}s…
              </span>
            </div>
            <button
              className="text-2xs font-bold text-mint hover:underline uppercase tracking-wider"
              onClick={() => setRedirectCancelled(true)}
            >
              Cancel Auto-Redirect
            </button>
          </div>
        )}

        {/* Extension Options Grid */}
        <div className="space-y-3 my-4">
          {/* Option 1: MetaMask */}
          <div className="p-4 rounded-xl border border-border hover:border-amber-500/40 bg-card hover:bg-card-hover transition-all duration-150 flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">{EXTENSION_URLS.metamask.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-text group-hover:text-amber-500 transition-colors">
                    {EXTENSION_URLS.metamask.name}
                  </h4>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-muted truncate">{EXTENSION_URLS.metamask.tagline}</p>
              </div>
            </div>
            <button
              className="btn btn-primary text-xs flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3"
              onClick={() => handleOpenStore("metamask")}
            >
              <Download size={14} />
              <span>Install</span>
              <ExternalLink size={12} className="opacity-70" />
            </button>
          </div>

          {/* Option 2: Binance Wallet */}
          <div className="p-4 rounded-xl border border-border hover:border-amber-400/40 bg-card hover:bg-card-hover transition-all duration-150 flex items-center justify-between gap-3 group">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">{EXTENSION_URLS.binance.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-text group-hover:text-amber-400 transition-colors">
                    {EXTENSION_URLS.binance.name}
                  </h4>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    Low Gas
                  </span>
                </div>
                <p className="text-xs text-muted truncate">{EXTENSION_URLS.binance.tagline}</p>
              </div>
            </div>
            <button
              className="btn btn-quiet text-xs flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3"
              onClick={() => handleOpenStore("binance")}
            >
              <Download size={14} />
              <span>Install</span>
              <ExternalLink size={12} className="opacity-70" />
            </button>
          </div>
        </div>

        {/* Security & Non-Custodial Assurance */}
        <div className="p-3 rounded-xl bg-panel-2 border border-border/80 flex items-start gap-2.5 text-2xs text-muted mb-4">
          <ShieldCheck size={16} className="text-mint flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>100% Non-Custodial & High-Level Security:</strong> OmniTube never holds your private
            keys. All tip transactions, SuperChats, and PPV unlocks are verified directly on-chain via your
            browser extension.
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            className="btn btn-quiet text-xs flex items-center gap-2"
            onClick={handleManualCheck}
            disabled={checking}
          >
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
            <span>{checking ? "Checking..." : "I've Installed — Check & Connect"}</span>
          </button>
          <button className="btn btn-quiet text-xs" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </section>
    </div>
  );
}
