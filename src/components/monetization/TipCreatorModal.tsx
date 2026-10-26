import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Coins, ExternalLink, Heart, Sparkles, Wallet, X } from "lucide-react";
import {
  connectWeb3Wallet,
  formatAddress,
  getInjectedProvider,
  sendCryptoPayment,
  SUPPORTED_CHAINS,
  type SupportedChainId,
  type WalletState,
} from "../../lib/web3";
import { avatarStyle, initials } from "../../lib/utils";
import type { Notice, Profile } from "../../types";
import { InstallWalletModal } from "./InstallWalletModal";

export function TipCreatorModal({
  creator,
  wallet,
  onWalletChange,
  onClose,
  notify,
}: {
  creator: Profile;
  wallet: WalletState;
  onWalletChange: (w: WalletState) => void;
  onClose: () => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [recipientWallet, setRecipientWallet] = useState<string>("");
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [targetChain, setTargetChain] = useState<SupportedChainId>("0x38"); // default BSC
  const [tokenSymbol, setTokenSymbol] = useState<"BNB" | "ETH" | "MATIC" | "USDT">("BNB");
  const [tipAmount, setTipAmount] = useState<string>("0.02");
  const [isCustom, setIsCustom] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Fetch creator's recipient address from Cloud SQL backend
  useEffect(() => {
    let active = true;
    async function fetchWallet() {
      try {
        const res = await fetch(`/api/creators/${creator.id}/wallet`);
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
  }, [creator.id]);

  // Update token symbol based on chain
  useEffect(() => {
    const chainConfig = SUPPORTED_CHAINS[targetChain];
    if (tokenSymbol !== "USDT") {
      setTokenSymbol(chainConfig.nativeSymbol as any);
    }
  }, [targetChain, tokenSymbol]);

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipAmount || parseFloat(tipAmount) <= 0) {
      notify("Enter a valid tip amount.", undefined, "error");
      return;
    }

    if (!getInjectedProvider()) {
      setShowInstallModal(true);
      return;
    }

    if (!recipientWallet) {
      notify(
        "Creator payout address pending",
        `${creator.display_name} has not linked an EVM payout address yet. Tips cannot be broadcast.`,
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
        amount: tipAmount,
        tokenSymbol,
        targetChain,
      });

      setTxSuccessHash(receipt.txHash);

      // Log transaction to Cloud SQL PostgreSQL database
      await fetch("/api/monetization/log-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: receipt.txHash,
          chain: receipt.chain,
          fromAddress: currentWallet.address,
          toAddress: recipientWallet,
          amount: receipt.amount,
          tokenSymbol: receipt.tokenSymbol,
          transactionType: "tip",
          targetId: creator.id,
        }),
      });

      notify(
        "Tip sent successfully!",
        `Sent ${tipAmount} ${tokenSymbol} to ${creator.display_name}`,
        "success"
      );
    } catch (err: any) {
      notify("Transaction failed", err.message || "Failed to broadcast transaction.", "error");
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
      <section className="modal-panel tip-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div className="flex items-center gap-3">
            <span className="avatar avatar-md" style={avatarStyle(creator)}>
              {!creator.avatar_url && initials(creator)}
            </span>
            <div>
              <p className="eyebrow">CREATOR SUPPORT</p>
              <h2>Tip {creator.display_name}</h2>
              <small className="text-muted block text-xs">
                Direct peer-to-peer crypto tip verified on-chain.
              </small>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            disabled={processing}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {txSuccessHash ? (
          <div className="tx-success-screen p-6 text-center">
            <div className="success-icon-badge mx-auto mb-4">
              <Check size={32} className="text-mint" />
            </div>
            <h3>Transaction Confirmed!</h3>
            <p className="text-muted text-xs mt-2">
              Your {tipAmount} {tokenSymbol} tip was verified and recorded in Cloud SQL.
            </p>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-quiet mt-4 inline-flex items-center gap-2 text-xs"
            >
              <span>View on {chainConfig.shortName} Explorer</span>
              <ExternalLink size={14} />
            </a>

            <div className="mt-6">
              <button className="btn btn-primary full" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendTip} className="tip-form mt-4">
            {/* Warning if creator has not configured their wallet */}
            {!loadingWallet && !recipientWallet && (
              <div className="p-3 bg-coral/10 border border-coral/30 rounded-xl mb-4 flex items-start gap-2.5 text-coral text-xs">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Payout Address Pending</strong>
                  <p className="text-muted text-2xs mt-0.5">
                    {creator.display_name} has not linked an EVM payout address in Creator Studio yet. Direct tips will be enabled as soon as the creator saves their address.
                  </p>
                </div>
              </div>
            )}

            {/* Network Selector */}
            <div className="form-field mb-4">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Select Network
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

            {/* Currency Selector */}
            <div className="form-field mb-4">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Token
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

            {/* Amount Selection */}
            <div className="form-field mb-4">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                Tip Amount
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  { label: "Small", val: tokenSymbol === "USDT" ? "5" : "0.01" },
                  { label: "Medium", val: tokenSymbol === "USDT" ? "15" : "0.03" },
                  { label: "Generous", val: tokenSymbol === "USDT" ? "50" : "0.1" },
                  { label: "Super", val: tokenSymbol === "USDT" ? "100" : "0.25" },
                ].map((tier) => (
                  <button
                    key={tier.label}
                    type="button"
                    className={`tier-preset-btn ${
                      tipAmount === tier.val && !isCustom ? "active" : ""
                    }`}
                    onClick={() => {
                      setTipAmount(tier.val);
                      setIsCustom(false);
                    }}
                  >
                    <strong>{tier.val}</strong>
                    <small className="text-muted block text-xs">{tier.label}</small>
                  </button>
                ))}
              </div>

              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="Or custom amount..."
                value={tipAmount}
                onChange={(e) => {
                  setTipAmount(e.target.value);
                  setIsCustom(true);
                }}
                className="w-full text-xs font-mono"
                required
              />
            </div>

            {/* Recipient Wallet Display */}
            <div className="p-3 bg-panel-2 rounded-xl border border-border mb-4 text-xs">
              <div className="flex justify-between text-muted mb-1">
                <span>Creator Address</span>
                <span className="font-semibold text-white">
                  {recipientWallet ? formatAddress(recipientWallet) : "Unconfigured"}
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Network Standard</span>
                <span className="text-mint font-semibold">{chainConfig.name}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={onClose}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={processing || !tipAmount || !recipientWallet}
              >
                {processing ? (
                  <>
                    <span className="spinner" /> Broadcasting...
                  </>
                ) : (
                  <>
                    <Heart size={15} fill="currentColor" /> Send {tipAmount} {tokenSymbol} Tip
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
