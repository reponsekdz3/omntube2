import React, { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import {
  connectWeb3Wallet,
  formatAddress,
  getInjectedProvider,
  SUPPORTED_CHAINS,
  type WalletState,
} from "../../lib/web3";

interface WalletOption {
  id: string;
  name: string;
  icon: string;
  badge?: string;
  deepLink: string;
  extensionUrl: string;
  isInjected: () => boolean;
}

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    badge: "Popular",
    deepLink: `https://metamask.app.link/dapp/${typeof window !== "undefined" ? window.location.host : "omnitube.app"}`,
    extensionUrl: "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
    isInjected: () => typeof window !== "undefined" && Boolean((window as any).ethereum?.isMetaMask),
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    badge: "Multi-Chain",
    deepLink: `https://phantom.app/ul/browse/${typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "https://omnitube.app"}?ref=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`,
    extensionUrl: "https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa",
    isInjected: () => typeof window !== "undefined" && Boolean((window as any).phantom?.ethereum || (window as any).ethereum?.isPhantom),
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    deepLink: `https://go.cb-w.com/dapp?cb_url=${typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "https://omnitube.app"}`,
    extensionUrl: "https://chromewebstore.google.com/detail/coinbase-wallet-extension/hnfanklipfehafohppfifhaagdaglhpm",
    isInjected: () => typeof window !== "undefined" && Boolean((window as any).ethereum?.isCoinbaseWallet),
  },
  {
    id: "rainbow",
    name: "Rainbow",
    icon: "🌈",
    deepLink: "https://rainbow.me/",
    extensionUrl: "https://chromewebstore.google.com/detail/rainbow/opfgelmcmbiajamepnmloochbpolempj",
    isInjected: () => typeof window !== "undefined" && Boolean((window as any).ethereum?.isRainbow),
  },
  {
    id: "binance",
    name: "Binance Web3",
    icon: "🟡",
    deepLink: "https://www.binance.com/en/web3wallet",
    extensionUrl: "https://chromewebstore.google.com/detail/binance-wallet/fhbohimaelbohpjbbldcngcnapndodjp",
    isInjected: () => typeof window !== "undefined" && Boolean((window as any).BinanceChain),
  },
];

export function MultiChainWalletModal({
  isOpen,
  onClose,
  wallet,
  onWalletChange,
  notify,
}: {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onWalletChange: (w: WalletState) => void;
  notify: (title: string, detail?: string, kind?: "success" | "error" | "info") => void;
}) {
  const [activeTab, setActiveTab] = useState<"installed" | "mobile" | "chains">("installed");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleConnectInjected = async (opt: WalletOption) => {
    setConnectingId(opt.id);
    try {
      const provider = getInjectedProvider();
      if (!provider) {
        window.open(opt.extensionUrl, "_blank", "noopener,noreferrer");
        notify("Extension store opened", `Install ${opt.name} and refresh the page to connect.`, "info");
        return;
      }
      const state = await connectWeb3Wallet();
      onWalletChange(state);
      notify("Wallet Connected", `Connected to ${state.walletName} (${formatAddress(state.address)})`, "success");
      onClose();
    } catch (err: any) {
      notify("Connection failed", err?.message || "User rejected the connection request.", "error");
    } finally {
      setConnectingId(null);
    }
  };

  const currentHref = typeof window !== "undefined" ? window.location.href : "https://omnitube.app";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentHref);
    setCopiedLink(true);
    notify("URL copied to clipboard", "Open inside MetaMask or Phantom mobile browser.", "success");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "var(--scrim-bg)",
        backdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "24px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--mint-light)",
                border: "1px solid var(--mint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--mint)",
              }}
            >
              <Wallet size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                Connect Web3 Wallet
              </h2>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>
                SuperChats, Sound NFTs & Tipping
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px",
              color: "var(--muted)",
              background: "transparent",
              border: 0,
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Segmented Control */}
        <div style={{ padding: "12px 20px", background: "var(--panel-2)", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "4px",
              padding: "4px",
              background: "var(--input-bg)",
              borderRadius: "12px",
              border: "1px solid var(--border)",
            }}
          >
            {(["installed", "mobile", "chains"] as const).map((tab) => {
              const label = tab === "installed" ? "Extensions" : tab === "mobile" ? "Mobile Apps" : `Chains (${Object.keys(SUPPORTED_CHAINS).length})`;
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 0",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    border: 0,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: isActive ? "var(--panel)" : "transparent",
                    color: isActive ? "var(--text)" : "var(--muted)",
                    boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Body */}
        <div style={{ padding: "18px 20px", maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {activeTab === "installed" && (
            <>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 2px" }}>
                Select an installed browser extension or open the official store page:
              </p>
              {WALLET_OPTIONS.map((opt) => {
                const detected = opt.isInjected();
                const isConnecting = connectingId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleConnectInjected(opt)}
                    disabled={isConnecting}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "14px",
                      border: "1px solid var(--border)",
                      background: "var(--panel-2)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--mint)";
                      e.currentTarget.style.background = "var(--panel-3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "var(--panel-2)";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "22px" }}>{opt.icon}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                            {opt.name}
                          </span>
                          {detected && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                color: "var(--mint)",
                                background: "var(--mint-light)",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              Detected
                            </span>
                          )}
                          {opt.badge && !detected && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 600,
                                color: "var(--muted)",
                                background: "var(--panel-3)",
                                padding: "2px 6px",
                                borderRadius: "6px",
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>
                          {detected ? "Click to connect instantly" : "Click to get extension"}
                        </p>
                      </div>
                    </div>
                    <div style={{ color: "var(--muted)" }}>
                      {detected ? <ShieldCheck size={18} color="var(--mint)" /> : <ExternalLink size={16} />}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {activeTab === "mobile" && (
            <>
              <div
                style={{
                  padding: "12px",
                  background: "var(--mint-light)",
                  border: "1px solid var(--mint)",
                  borderRadius: "12px",
                  fontSize: "11.5px",
                  color: "var(--text)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <Smartphone size={16} color="var(--mint)" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>Tap below to launch OmniTube directly in your mobile wallet's Web3 browser:</span>
              </div>

              {WALLET_OPTIONS.map((opt) => (
                <a
                  key={opt.id}
                  href={opt.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--mint)";
                    e.currentTarget.style.background = "var(--panel-3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--panel-2)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "22px" }}>{opt.icon}</span>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                        Open in {opt.name} Mobile
                      </span>
                      <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>
                        Deep-link into native mobile dApp browser
                      </p>
                    </div>
                  </div>
                  <ExternalLink size={16} color="var(--muted)" />
                </a>
              ))}

              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "11px",
                  borderRadius: "12px",
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: "6px",
                }}
              >
                {copiedLink ? <Check size={16} color="var(--mint)" /> : <Copy size={16} />}
                <span>{copiedLink ? "dApp Link Copied!" : "Copy dApp URL for Mobile Browsers"}</span>
              </button>
            </>
          )}

          {activeTab === "chains" && (
            <>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 2px" }}>
                OmniTube smart contracts and tipping are active on 4 EVM networks:
              </p>
              {Object.entries(SUPPORTED_CHAINS).map(([chainId, chain]) => (
                <div
                  key={chainId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid var(--border)",
                    background: "var(--panel-2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>{chain.icon}</span>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                        {chain.name}
                      </span>
                      <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>
                        Symbol: {chain.nativeSymbol} · Chain ID {chain.chainIdDec}
                      </p>
                    </div>
                  </div>
                  <a
                    href={chain.blockExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: "6px", color: "var(--muted)" }}
                    title="View Explorer"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            background: "var(--panel-2)",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "10.5px", color: "var(--muted)", margin: 0 }}>
            Non-custodial & decentralized. Keys never leave your device.
          </p>
        </div>
      </div>
    </div>
  );
}
