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
  Radio,
  Layers,
  QrCode,
  Smartphone,
  Globe,
} from "lucide-react";
import { getInjectedProvider } from "../../lib/web3";

interface InstallWalletModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onInstalledAndConnected?: () => void;
  notify?: (title: string, detail?: string, kind?: "success" | "error" | "info") => void;
  autoRedirectWallet?: "metamask" | "binance" | "phantom" | "coinbase" | null;
  preferredWallet?: "metamask" | "binance" | "all";
}

export const EXTENSION_URLS = {
  metamask: {
    id: "metamask",
    name: "MetaMask",
    tagline: "The world's standard Web3 wallet for BSC, Ethereum, Polygon, and Arbitrum",
    chromeStore: "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
    officialSite: "https://metamask.io/download/",
    icon: "🦊",
    badge: "Most Popular",
    color: "#E2761B",
  },
  binance: {
    id: "binance",
    name: "Binance Web3 Wallet",
    tagline: "Native Binance extension engineered for BNB Smart Chain with minimal gas fees",
    chromeStore: "https://chromewebstore.google.com/detail/binance-wallet/fhbohimaelbohpjbbldcngcnapndodjp",
    officialSite: "https://www.binance.com/en/web3wallet",
    icon: "🟡",
    badge: "Low Gas / BSC",
    color: "#F3BA2F",
  },
  phantom: {
    id: "phantom",
    name: "Phantom",
    tagline: "Ultra-fast, beautiful multi-chain crypto wallet with EVM & Polygon support",
    chromeStore: "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
    officialSite: "https://phantom.app/download",
    icon: "👻",
    badge: "Multi-Chain",
    color: "#AB9FF2",
  },
  coinbase: {
    id: "coinbase",
    name: "Coinbase Wallet",
    tagline: "Self-custodial EVM smart wallet supporting all major EVM networks and dApps",
    chromeStore: "https://chromewebstore.google.com/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad",
    officialSite: "https://www.coinbase.com/wallet",
    icon: "🔵",
    badge: "Smart Wallet",
    color: "#0052FF",
  },
};

export function InstallWalletModal({
  isOpen = true,
  onClose,
  onInstalledAndConnected,
  notify,
  autoRedirectWallet = null,
}: InstallWalletModalProps) {
  if (isOpen === false) return null;

  const [selectedWallet, setSelectedWallet] = useState<keyof typeof EXTENSION_URLS>("metamask");
  const [countdown, setCountdown] = useState<number | null>(autoRedirectWallet ? 3 : null);
  const [redirectCancelled, setRedirectCancelled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showMobileQr, setShowMobileQr] = useState(false);

  // Auto-redirect timer if specified
  useEffect(() => {
    if (!autoRedirectWallet || redirectCancelled || countdown === null) return;
    if (countdown === 0) {
      const targetUrl = EXTENSION_URLS[autoRedirectWallet].chromeStore;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (notify) {
        notify(
          `Redirected to ${EXTENSION_URLS[autoRedirectWallet].name}`,
          "Complete the installation in your browser, then click 'Check & Connect'.",
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
          notify?.("Web3 Wallet Detected!", "Wallet extension discovered and linked.", "success");
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [onInstalledAndConnected, notify]);

  const handleManualCheck = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      const provider = getInjectedProvider();
      if (provider) {
        notify?.("Wallet Detected!", "Successfully connected Web3 provider.", "success");
        if (onInstalledAndConnected) onInstalledAndConnected();
        onClose();
      } else {
        notify?.(
          "Extension Not Found",
          "Please make sure the wallet extension is installed and enabled in your browser extensions, then retry.",
          "error"
        );
      }
    }, 600);
  };

  const handleOpenStore = (key: keyof typeof EXTENSION_URLS) => {
    setRedirectCancelled(true);
    const target = EXTENSION_URLS[key];
    window.open(target.chromeStore, "_blank", "noopener,noreferrer");
    notify?.(
      `Opened ${target.name} Store`,
      "Install the extension, then return here and click 'Check & Connect'.",
      "info"
    );
  };

  const currentWallet = EXTENSION_URLS[selectedWallet];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-7 shadow-2xl text-[var(--text)] relative flex flex-col gap-5 overflow-hidden transition-all duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Connect Web3 Wallet"
      >
        {/* Decorative Top Accent Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)] transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-lg shadow-amber-500/15">
            <Wallet size={24} />
          </div>
          <div>
            <h3 className="text-base font-black font-['Space_Grotesk'] tracking-tight text-[var(--text)]">
              Web3 Wallet Extension Required
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Connect MetaMask, Binance, or Phantom to claim royalties, tip creators, & mint audio NFTs.
            </p>
          </div>
        </div>

        {/* Auto-redirect Banner */}
        {countdown !== null && countdown > 0 && !redirectCancelled && autoRedirectWallet && (
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[var(--text)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>
                Redirecting to <strong>{EXTENSION_URLS[autoRedirectWallet].name}</strong> in {countdown}s…
              </span>
            </div>
            <button
              onClick={() => setRedirectCancelled(true)}
              className="text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Wallet Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(EXTENSION_URLS) as (keyof typeof EXTENSION_URLS)[]).map((key) => {
            const w = EXTENSION_URLS[key];
            const isSelected = selectedWallet === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedWallet(key)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition cursor-pointer ${
                  isSelected
                    ? "bg-[var(--panel-2)] border-amber-500/60 shadow-md scale-[1.02]"
                    : "bg-[var(--panel-2)]/60 border-[var(--border)] hover:border-[var(--border-strong)] opacity-80 hover:opacity-100"
                }`}
              >
                <span className="text-2xl mb-1">{w.icon}</span>
                <span className="text-xs font-bold text-[var(--text)] line-clamp-1">{w.name}</span>
                <span className="text-[9px] font-mono text-amber-400 mt-0.5">{w.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Wallet Card */}
        <div className="p-4 rounded-2xl bg-[var(--panel-2)] border border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{currentWallet.icon}</span>
              <div>
                <h4 className="text-xs font-bold text-[var(--text)]">{currentWallet.name}</h4>
                <p className="text-[11px] text-[var(--muted)] leading-tight">{currentWallet.tagline}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleOpenStore(selectedWallet)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 p-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Install from Chrome Web Store</span>
              <ExternalLink size={12} className="opacity-70" />
            </button>

            <a
              href={currentWallet.officialSite}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-3)] text-xs font-semibold text-[var(--text)] transition flex items-center gap-1"
              title="Visit official website"
            >
              <Globe size={13} />
            </a>
          </div>
        </div>

        {/* Real-time Discovery Indicator & Non-Custodial Assurance */}
        <div className="p-3.5 rounded-2xl bg-[var(--panel-2)]/80 border border-[var(--border)] flex items-start gap-2.5 text-[11px] text-[var(--muted)]">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>100% Non-Custodial Security:</strong> OmniTube never holds your private keys. All audio
            NFT licenses, sound royalties, and creator tips execute securely via your local browser
            wallet extension.
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <button
            onClick={handleManualCheck}
            disabled={checking}
            className="flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
            <span>{checking ? "Scanning Extensions..." : "I've Installed — Check & Connect"}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
