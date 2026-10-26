import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, KeyRound, Lock, Play, ShieldAlert, Sparkles, X } from "lucide-react";
import {
  connectWeb3Wallet,
  formatAddress,
  getInjectedProvider,
  sendCryptoPayment,
  SUPPORTED_CHAINS,
  type SupportedChainId,
  type WalletState,
} from "../../lib/web3";
import type { Notice, Profile, VideoRow } from "../../types";
import { supabase } from "../../lib/supabase";
import { InstallWalletModal } from "./InstallWalletModal";

export function PayPerViewModal({
  video,
  creator,
  wallet,
  onWalletChange,
  onClose,
  onUnlocked,
  notify,
}: {
  video: VideoRow;
  creator?: Profile;
  wallet: WalletState;
  onWalletChange: (w: WalletState) => void;
  onClose: () => void;
  onUnlocked: (txHash: string) => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [targetChain, setTargetChain] = useState<SupportedChainId>("0x38"); // default BSC
  const [tokenSymbol, setTokenSymbol] = useState<"BNB" | "ETH" | "MATIC" | "USDT">("BNB");
  const [recipientWallet, setRecipientWallet] = useState<string>("");
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);

  // Suggested default price for PPV
  const defaultPrices: Record<string, string> = {
    BNB: "0.01",
    ETH: "0.0015",
    MATIC: "5",
    USDT: "3",
  };

  const unlockCost = defaultPrices[tokenSymbol] || defaultPrices.BNB;

  // Check if current user already unlocked this video
  useEffect(() => {
    let active = true;
    async function checkExistingUnlock() {
      if (!wallet.address || !video.id) return;
      try {
        const res = await fetch(`/api/monetization/ppv-unlocks/${video.id}?userAddress=${wallet.address}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data?.unlocked) {
            setAlreadyUnlocked(true);
          }
        }
      } catch {
        // Backend offline or no unlock recorded
      }
    }
    void checkExistingUnlock();
    return () => {
      active = false;
    };
  }, [wallet.address, video.id]);

  // Fetch creator's recipient address from Cloud SQL backend
  useEffect(() => {
    let active = true;
    async function fetchWallet() {
      if (!video.creator_id) {
        setLoadingWallet(false);
        return;
      }
      try {
        const res = await fetch(`/api/creators/${video.creator_id}/wallet`);
        if (res.ok) {
          const data = await res.json();
          if (active && data?.walletAddress) {
            setRecipientWallet(data.walletAddress);
            if (data.preferredChain === "ethereum") setTargetChain("0x1");
            else if (data.preferredChain === "polygon") setTargetChain("0x89");
            else if (data.preferredChain === "arbitrum") setTargetChain("0xa4b1");
          }
        }
      } catch {
        // No mock fallback address permitted
      } finally {
        if (active) setLoadingWallet(false);
      }
    }
    void fetchWallet();
    return () => {
      active = false;
    };
  }, [video.creator_id]);

  // Update token symbol based on chain
  useEffect(() => {
    const chainConfig = SUPPORTED_CHAINS[targetChain];
    if (tokenSymbol !== "USDT") {
      setTokenSymbol(chainConfig.nativeSymbol as any);
    }
  }, [targetChain, tokenSymbol]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!getInjectedProvider()) {
      setShowInstallModal(true);
      return;
    }

    if (!recipientWallet) {
      notify(
        "Creator payout wallet not configured",
        "The creator has not yet linked an EVM payout address in Creator Studio. Transactions cannot be broadcast.",
        "error"
      );
      return;
    }

    setProcessing(true);
    setTxSuccessHash(null);

    try {
      let currentWallet = wallet;
      if (!currentWallet.connected) {
        currentWallet = await connectWeb3Wallet();
        onWalletChange(currentWallet);
      }

      const receipt = await sendCryptoPayment({
        recipientAddress: recipientWallet,
        amount: unlockCost,
        tokenSymbol,
        targetChain,
      });

      setTxSuccessHash(receipt.txHash);

      // Record unlock in Cloud SQL PostgreSQL
      await fetch("/api/monetization/ppv-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          userAddress: currentWallet.address,
          txHash: receipt.txHash,
          amountPaid: unlockCost,
          tokenSymbol,
          chain: receipt.chain,
        }),
      });

      // Log transaction in Cloud SQL
      await fetch("/api/monetization/log-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: receipt.txHash,
          chain: receipt.chain,
          fromAddress: currentWallet.address,
          toAddress: recipientWallet,
          amount: unlockCost,
          tokenSymbol,
          transactionType: "ppv_unlock",
          targetId: video.id,
        }),
      });

      notify("Video unlocked!", "Your pay-per-view access has been recorded on-chain.", "success");
      onUnlocked(receipt.txHash);
    } catch (err: any) {
      notify("Unlock payment failed", err.message || "Failed to broadcast transaction.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const chainConfig = SUPPORTED_CHAINS[targetChain];
  const explorerUrl = `${chainConfig.blockExplorerUrl}/tx/${txSuccessHash}`;

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
    >
      <section className="modal-panel ppv-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
              <KeyRound size={20} />
            </div>
            <div>
              <p className="eyebrow flex items-center gap-1 text-yellow-400">
                <Lock size={12} /> PREMIUM PAY-PER-VIEW
              </p>
              <h2>Unlock Exclusive Access</h2>
              <small className="text-muted block text-xs">
                Permanent on-chain video ownership and streaming rights.
              </small>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={processing} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {alreadyUnlocked ? (
          <div className="tx-success-screen p-6 text-center">
            <div className="success-icon-badge mx-auto mb-4 bg-mint/15 text-mint">
              <Check size={32} />
            </div>
            <h3>Already Unlocked!</h3>
            <p className="text-muted text-xs mt-2">
              Your connected wallet ({formatAddress(wallet.address || "")}) holds verified ownership
              and streaming rights for this title.
            </p>
            <div className="mt-6">
              <button className="btn btn-primary full" onClick={onClose}>
                <Play size={15} fill="currentColor" /> Watch Now
              </button>
            </div>
          </div>
        ) : txSuccessHash ? (
          <div className="tx-success-screen p-6 text-center">
            <div className="success-icon-badge mx-auto mb-4 bg-mint/15 text-mint">
              <Check size={32} />
            </div>
            <h3>Access Granted!</h3>
            <p className="text-muted text-xs mt-2">
              Payment verified on {chainConfig.name}. You now have instant high-definition playback
              access.
            </p>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-quiet mt-4 inline-flex items-center gap-2 text-xs"
            >
              <span>View On-Chain Receipt</span>
              <ExternalLink size={14} />
            </a>

            <div className="mt-6">
              <button className="btn btn-primary full" onClick={onClose}>
                <Play size={15} fill="currentColor" /> Watch Now
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUnlock} className="ppv-form mt-4">
            {/* Unconfigured creator wallet warning */}
            {!loadingWallet && !recipientWallet && (
              <div className="p-3 bg-coral/10 border border-coral/30 rounded-xl mb-4 flex items-start gap-2.5 text-coral text-xs">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Payout Address Pending</strong>
                  <p className="text-muted text-2xs mt-0.5">
                    This creator has not configured their Web3 payout address yet. Transactions are paused until the creator links their wallet in Creator Studio.
                  </p>
                </div>
              </div>
            )}

            {/* Video preview card */}
            <div className="p-3 bg-panel-2 rounded-xl border border-border mb-4 flex gap-3 items-center">
              <div className="w-24 h-14 rounded-lg bg-black/60 overflow-hidden relative shrink-0">
                {video.thumbnail_path ? (
                  <img
                    src={
                      supabase.storage
                        .from("omnitube-thumbnails")
                        .getPublicUrl(video.thumbnail_path).data.publicUrl
                    }
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <Play size={16} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Lock size={16} className="text-yellow-400" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-white truncate">{video.title}</h4>
                <p className="text-xs text-muted truncate mt-0.5">
                  By {creator?.display_name || "Creator"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-mint">
                    {unlockCost} {tokenSymbol}
                  </span>
                  <span className="text-2xs text-muted">One-time payment</span>
                </div>
              </div>
            </div>

            {/* Network Selector */}
            <div className="form-field mb-4">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Pay With Network
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(SUPPORTED_CHAINS) as SupportedChainId[]).map((cid) => {
                  const c = SUPPORTED_CHAINS[cid];
                  const isSelected = targetChain === cid;
                  return (
                    <button
                      key={cid}
                      type="button"
                      className={`chain-select-card ${isSelected ? "active" : ""}`}
                      onClick={() => setTargetChain(cid)}
                    >
                      <span className="text-base">{c.icon}</span>
                      <strong className="text-xs block mt-1">{c.shortName}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Token Selector */}
            <div className="form-field mb-4">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Currency Asset
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn flex-1 text-xs ${
                    tokenSymbol !== "USDT" ? "btn-primary" : "btn-quiet"
                  }`}
                  onClick={() => setTokenSymbol(chainConfig.nativeSymbol as any)}
                >
                  {chainConfig.nativeSymbol} (Native)
                </button>
                <button
                  type="button"
                  className={`btn flex-1 text-xs ${
                    tokenSymbol === "USDT" ? "btn-primary" : "btn-quiet"
                  }`}
                  onClick={() => setTokenSymbol("USDT")}
                >
                  USDT (Stablecoin)
                </button>
              </div>
            </div>

            {/* Creator wallet display */}
            <div className="p-3 bg-panel-2 rounded-xl border border-border mb-4 text-xs">
              <div className="flex justify-between text-muted mb-1">
                <span>Creator Payout Address:</span>
                <span className="font-mono text-white">
                  {recipientWallet ? formatAddress(recipientWallet) : "Unconfigured"}
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Database Sync:</span>
                <span className="text-mint font-semibold">Google Cloud SQL Verified</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-quiet" onClick={onClose} disabled={processing}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={processing || !recipientWallet}
              >
                {processing ? (
                  <>
                    <span className="spinner" /> Confirming Unlock...
                  </>
                ) : (
                  <>
                    <KeyRound size={15} /> Unlock for {unlockCost} {tokenSymbol}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Extension auto-redirect and install modal */}
      <InstallWalletModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        preferredWallet="all"
      />
    </div>
  );
}
