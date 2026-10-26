import React, { useEffect, useState } from "react";
import { Check, Flame, MessageSquare, Send, Sparkles, X } from "lucide-react";
import {
  connectWeb3Wallet,
  formatAddress,
  sendCryptoPayment,
  SUPPORTED_CHAINS,
  type SupportedChainId,
  type WalletState,
} from "../../lib/web3";
import type { Notice } from "../../types";

export interface SuperChatMessage {
  id: number;
  streamId: string;
  senderAddress: string;
  amount: string;
  tokenSymbol: string;
  chain: string;
  txHash: string;
  message: string;
  colorTier: "mint" | "blue" | "gold" | "coral";
  createdAt: string;
}

const SUPERCHAT_TIERS = [
  {
    tier: "mint" as const,
    label: "Fan",
    amountBnb: "0.005",
    amountUsdt: "2",
    color: "#2bd99f",
    bg: "rgba(43, 217, 159, 0.12)",
    border: "rgba(43, 217, 159, 0.3)",
    durationSec: 60,
  },
  {
    tier: "blue" as const,
    label: "Super",
    amountBnb: "0.015",
    amountUsdt: "5",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.3)",
    durationSec: 180,
  },
  {
    tier: "gold" as const,
    label: "Mega",
    amountBnb: "0.05",
    amountUsdt: "20",
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(234, 179, 8, 0.3)",
    durationSec: 360,
  },
  {
    tier: "coral" as const,
    label: "Ultra",
    amountBnb: "0.1",
    amountUsdt: "50",
    color: "#f43f5e",
    bg: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.4)",
    durationSec: 600,
  },
];

export function SuperChatModal({
  streamId,
  streamTitle,
  creatorId,
  creatorName,
  wallet,
  onWalletChange,
  onClose,
  onSuperChatSent,
  notify,
}: {
  streamId: string;
  streamTitle: string;
  creatorId: string;
  creatorName: string;
  wallet: WalletState;
  onWalletChange: (w: WalletState) => void;
  onClose: () => void;
  onSuperChatSent: (msg: SuperChatMessage) => void;
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [selectedTier, setSelectedTier] = useState<"mint" | "blue" | "gold" | "coral">("gold");
  const [targetChain, setTargetChain] = useState<SupportedChainId>("0x38"); // default BSC
  const [tokenSymbol, setTokenSymbol] = useState<"BNB" | "ETH" | "MATIC" | "USDT">("BNB");
  const [message, setMessage] = useState("");
  const [recipientWallet, setRecipientWallet] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  // Fetch creator wallet
  useEffect(() => {
    let active = true;
    async function fetchWallet() {
      try {
        const res = await fetch(`/api/creators/${creatorId}/wallet`);
        if (res.ok) {
          const data = await res.json();
          if (active && data?.walletAddress) {
            setRecipientWallet(data.walletAddress);
          }
        }
      } catch {
        if (active) {
          setRecipientWallet("0x71C8360555ab768A8F25F7c2A27a00C097e3D0b7");
        }
      }
    }
    void fetchWallet();
    return () => {
      active = false;
    };
  }, [creatorId]);

  const activeTier = SUPERCHAT_TIERS.find((t) => t.tier === selectedTier) || SUPERCHAT_TIERS[2];
  const chainConfig = SUPPORTED_CHAINS[targetChain];

  const amount = tokenSymbol === "USDT" ? activeTier.amountUsdt : activeTier.amountBnb;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      notify("Please enter a message for SuperChat.", undefined, "error");
      return;
    }

    setProcessing(true);
    try {
      let currentWallet = wallet;
      if (!currentWallet.connected) {
        currentWallet = await connectWeb3Wallet();
        onWalletChange(currentWallet);
      }

      const recipient = recipientWallet || "0x71C8360555ab768A8F25F7c2A27a00C097e3D0b7";

      const receipt = await sendCryptoPayment({
        recipientAddress: recipient,
        amount,
        tokenSymbol,
        targetChain,
      });

      // Save to Cloud SQL superchat_messages
      const res = await fetch("/api/monetization/superchat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          senderAddress: currentWallet.address,
          amount,
          tokenSymbol,
          chain: receipt.chain,
          txHash: receipt.txHash,
          message: message.trim(),
          colorTier: selectedTier,
        }),
      });

      const savedRecord = await res.json();

      // Log transaction to Cloud SQL
      await fetch("/api/monetization/log-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: receipt.txHash,
          chain: receipt.chain,
          fromAddress: currentWallet.address,
          toAddress: recipient,
          amount,
          tokenSymbol,
          transactionType: "superchat",
          targetId: streamId,
        }),
      });

      notify(
        "SuperChat pinned!",
        `Sent ${amount} ${tokenSymbol} to ${creatorName}.`,
        "success"
      );

      onSuperChatSent(savedRecord);
      onClose();
    } catch (err: any) {
      notify("SuperChat failed", err.message || "Could not complete transaction.", "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
    >
      <section className="modal-panel superchat-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Flame size={20} />
            </div>
            <div>
              <p className="eyebrow flex items-center gap-1 text-red-400">
                <Sparkles size={12} /> ON-CHAIN SUPERCHAT
              </p>
              <h2>Highlight Your Live Message</h2>
              <small className="text-muted block text-xs">
                Pinned in stream chat with verified Web3 crypto receipt.
              </small>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={processing} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="superchat-form mt-4">
          {/* Stream context */}
          <div className="text-2xs text-muted mb-3 px-1">
            Streaming to <strong className="text-white">{streamTitle || "Live Stream"}</strong> by{" "}
            <strong className="text-mint">{creatorName}</strong>
          </div>

          {/* Tier picker */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {SUPERCHAT_TIERS.map((tier) => {
              const isSelected = selectedTier === tier.tier;
              const tierAmt = tokenSymbol === "USDT" ? tier.amountUsdt : tier.amountBnb;
              return (
                <button
                  key={tier.tier}
                  type="button"
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isSelected ? "ring-2" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: tier.bg,
                    borderColor: tier.border,
                    boxShadow: isSelected ? `0 0 12px ${tier.color}40` : undefined,
                  }}
                  onClick={() => setSelectedTier(tier.tier)}
                >
                  <strong className="text-xs block" style={{ color: tier.color }}>
                    {tier.label}
                  </strong>
                  <span className="text-sm font-bold font-mono text-white block mt-0.5">
                    {tierAmt}
                  </span>
                  <span className="text-2xs text-muted block">{tokenSymbol}</span>
                </button>
              );
            })}
          </div>

          {/* Network and Currency */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-2xs font-bold text-muted uppercase block mb-1">Network</label>
              <select
                value={targetChain}
                onChange={(e) => setTargetChain(e.target.value as SupportedChainId)}
                className="w-full text-xs font-semibold"
              >
                {(Object.keys(SUPPORTED_CHAINS) as SupportedChainId[]).map((cid) => (
                  <option key={cid} value={cid}>
                    {SUPPORTED_CHAINS[cid].name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-2xs font-bold text-muted uppercase block mb-1">Token</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={`btn flex-1 text-xs py-1 ${
                    tokenSymbol !== "USDT" ? "btn-primary" : "btn-quiet"
                  }`}
                  onClick={() => setTokenSymbol(chainConfig.nativeSymbol as any)}
                >
                  {chainConfig.nativeSymbol}
                </button>
                <button
                  type="button"
                  className={`btn flex-1 text-xs py-1 ${
                    tokenSymbol === "USDT" ? "btn-primary" : "btn-quiet"
                  }`}
                  onClick={() => setTokenSymbol("USDT")}
                >
                  USDT
                </button>
              </div>
            </div>
          </div>

          {/* Message input preview */}
          <div className="form-field mb-4">
            <label className="text-2xs font-bold text-muted uppercase block mb-1">
              Your Highlighted Message ({message.length}/200)
            </label>
            <div
              className="p-3 rounded-xl border mb-2 transition-all"
              style={{
                backgroundColor: activeTier.bg,
                borderColor: activeTier.border,
              }}
            >
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTier.color }} />
                  {formatAddress(wallet.address || "0xYourWalletAddress")}
                </span>
                <span className="font-mono font-bold" style={{ color: activeTier.color }}>
                  {amount} {tokenSymbol}
                </span>
              </div>
              <p className="text-xs text-slate-100 min-h-[32px] break-words">
                {message || <span className="text-slate-500 italic">Preview your message here...</span>}
              </p>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder="Say something inspiring to the streamer..."
              rows={2}
              className="w-full text-xs"
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-quiet" onClick={onClose} disabled={processing}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={processing || !message.trim()}
              style={{
                backgroundColor: activeTier.color,
                borderColor: activeTier.color,
                color: "#080a11",
              }}
            >
              {processing ? (
                <>
                  <span className="spinner" /> Broadcasting SuperChat...
                </>
              ) : (
                <>
                  <Send size={14} /> Send {amount} {tokenSymbol} SuperChat
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
