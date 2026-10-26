import React, { useEffect, useState } from "react";
import { Check, Crown, ExternalLink, ShieldCheck, Sparkles, Star, Zap, X } from "lucide-react";
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

export type MembershipTier = "bronze" | "silver" | "gold";

interface TierDetail {
  id: MembershipTier;
  title: string;
  icon: typeof Crown;
  color: string;
  badgeBg: string;
  prices: Record<string, string>; // { BNB: "0.015", ETH: "0.002", MATIC: "8", USDT: "5" }
  perks: string[];
}

const TIERS: TierDetail[] = [
  {
    id: "bronze",
    title: "Bronze Supporter",
    icon: Star,
    color: "#cd7f32",
    badgeBg: "rgba(205, 127, 50, 0.15)",
    prices: { BNB: "0.015", ETH: "0.0025", MATIC: "8", USDT: "5" },
    perks: [
      "Exclusive Bronze channel badge in live chat",
      "Access to Members-only community updates",
      "Priority comment highlights",
    ],
  },
  {
    id: "silver",
    title: "Silver VIP",
    icon: Zap,
    color: "#C0C0C0",
    badgeBg: "rgba(192, 192, 192, 0.18)",
    prices: { BNB: "0.045", ETH: "0.0075", MATIC: "25", USDT: "15" },
    perks: [
      "All Bronze perks included",
      "50% discount on all Creator PPV premieres",
      "Exclusive custom emoji reactions in Live stream",
      "Monthly subscriber-only live Q&A sessions",
    ],
  },
  {
    id: "gold",
    title: "Gold Elite",
    icon: Crown,
    color: "#F3BA2F",
    badgeBg: "rgba(243, 186, 47, 0.2)",
    prices: { BNB: "0.12", ETH: "0.02", MATIC: "65", USDT: "40" },
    perks: [
      "All Bronze & Silver perks",
      "Personalized on-stream shoutout during Live events",
      "Early 48-hour access to high-bitrate video drops",
      "Direct Discord/Chat VIP role connection",
    ],
  },
];

export function ChannelMembershipModal({
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
  const [selectedTier, setSelectedTier] = useState<MembershipTier>("silver");
  const [targetChain, setTargetChain] = useState<SupportedChainId>("0x38"); // default BSC
  const [tokenSymbol, setTokenSymbol] = useState<"BNB" | "ETH" | "MATIC" | "USDT">("BNB");
  const [recipientWallet, setRecipientWallet] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [txSuccessHash, setTxSuccessHash] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [existingMembership, setExistingMembership] = useState<{
    isMember: boolean;
    tier: string | null;
    expiresAt: string | null;
  } | null>(null);

  // Check if subscriber already has active membership
  useEffect(() => {
    if (!wallet.address) return;
    fetch(`/api/monetization/membership/${creator.id}?subscriberAddress=${wallet.address}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.isMember) {
          setExistingMembership(data);
        }
      })
      .catch(() => {});
  }, [creator.id, wallet.address]);

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
        // No mock fallback
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

  const activeTier = TIERS.find((t) => t.id === selectedTier) || TIERS[1];
  const cost = activeTier.prices[tokenSymbol] || activeTier.prices.BNB;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!getInjectedProvider()) {
      setShowInstallModal(true);
      return;
    }

    if (!recipientWallet) {
      notify(
        "Creator Wallet Unset",
        "This creator has not configured their Web3 payout wallet yet. Memberships will open once they link their address in Creator Studio.",
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
        amount: cost,
        tokenSymbol,
        targetChain,
      });

      setTxSuccessHash(receipt.txHash);

      // Record membership in Cloud SQL
      await fetch("/api/monetization/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: creator.id,
          subscriberAddress: currentWallet.address,
          tier: selectedTier,
          chain: receipt.chain,
          txHash: receipt.txHash,
          amount: cost,
          tokenSymbol,
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
          amount: cost,
          tokenSymbol,
          transactionType: "membership",
          targetId: creator.id,
        }),
      });

      notify(
        `Subscribed to ${activeTier.title}!`,
        `Joined ${creator.display_name}'s channel membership for 30 days.`,
        "success"
      );
    } catch (err: any) {
      notify("Membership subscription failed", err.message || "Could not complete transaction.", "error");
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
      <section className="modal-panel membership-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div className="flex items-center gap-3">
            <span className="avatar avatar-md" style={avatarStyle(creator)}>
              {!creator.avatar_url && initials(creator)}
            </span>
            <div>
              <p className="eyebrow flex items-center gap-1">
                <Crown size={12} className="text-yellow-400" /> CHANNEL MEMBERSHIP
              </p>
              <h2>Join {creator.display_name}&apos;s Club</h2>
              <small className="text-muted block text-xs">
                30-day recurring crypto membership verified on-chain.
              </small>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={processing} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {txSuccessHash ? (
          <div className="tx-success-screen p-6 text-center">
            <div className="success-icon-badge mx-auto mb-4" style={{ backgroundColor: activeTier.badgeBg }}>
              <Check size={32} style={{ color: activeTier.color }} />
            </div>
            <h3>Welcome to {activeTier.title}!</h3>
            <p className="text-muted text-xs mt-2">
              Your {cost} {tokenSymbol} membership is active and permanently recorded in Cloud SQL.
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
                Enjoy Perks
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="membership-form mt-4">
            {/* Tiers Grid */}
            <div className="tier-cards-grid grid grid-cols-3 gap-3 mb-4">
              {TIERS.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === tier.id;
                const price = tier.prices[tokenSymbol] || tier.prices.BNB;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    className={`tier-card ${isSelected ? "active" : ""}`}
                    onClick={() => setSelectedTier(tier.id)}
                    style={{
                      borderColor: isSelected ? tier.color : undefined,
                    }}
                  >
                    <div
                      className="tier-icon-wrap"
                      style={{ backgroundColor: tier.badgeBg, color: tier.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <strong className="text-sm block mt-2 text-white">{tier.title}</strong>
                    <div className="tier-price mt-1">
                      <span className="text-base font-bold text-mint font-mono">{price}</span>{" "}
                      <span className="text-xs text-muted">{tokenSymbol}/mo</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Perks breakdown */}
            <div className="perks-box p-3 bg-panel-2 rounded-xl border border-border mb-4">
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-mint" /> Included Perks for {activeTier.title}
              </h4>
              <ul className="space-y-1.5">
                {activeTier.perks.map((perk, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <Check size={13} className="text-mint shrink-0 mt-0.5" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Network & Token selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Network
                </label>
                <select
                  value={targetChain}
                  onChange={(e) => setTargetChain(e.target.value as SupportedChainId)}
                  className="w-full text-xs font-semibold"
                >
                  {(Object.keys(SUPPORTED_CHAINS) as SupportedChainId[]).map((cid) => (
                    <option key={cid} value={cid}>
                      {SUPPORTED_CHAINS[cid].name} ({SUPPORTED_CHAINS[cid].shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Payment Asset
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`btn flex-1 text-xs py-1.5 ${
                      tokenSymbol !== "USDT" ? "btn-primary" : "btn-quiet"
                    }`}
                    onClick={() => setTokenSymbol(chainConfig.nativeSymbol as any)}
                  >
                    {chainConfig.nativeSymbol}
                  </button>
                  <button
                    type="button"
                    className={`btn flex-1 text-xs py-1.5 ${
                      tokenSymbol === "USDT" ? "btn-primary" : "btn-quiet"
                    }`}
                    onClick={() => setTokenSymbol("USDT")}
                  >
                    USDT
                  </button>
                </div>
              </div>
            </div>

            {/* Creator wallet summary */}
            {/* Existing Active Membership Notification */}
            {existingMembership?.isMember && (
              <div className="p-3 mb-4 rounded-xl bg-mint/10 border border-mint/25 text-xs flex items-center justify-between text-text">
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-mint" />
                  <span>
                    You are already an active <strong>{existingMembership.tier?.toUpperCase()}</strong> member!
                  </span>
                </div>
                {existingMembership.expiresAt && (
                  <span className="text-2xs text-muted">
                    Renews: {new Date(existingMembership.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Creator wallet summary */}
            <div className="p-2.5 bg-panel-2/60 rounded-lg border border-border text-xs flex justify-between items-center mb-4">
              <span className="text-muted">Creator Wallet:</span>
              <span className="font-mono text-text font-semibold">
                {recipientWallet ? formatAddress(recipientWallet) : "Not configured yet"}
              </span>
            </div>

            {!recipientWallet && (
              <div className="p-2.5 mb-3 bg-coral/10 border border-coral/25 rounded-lg text-2xs text-coral">
                This creator has not configured their Web3 payout wallet yet.
              </div>
            )}

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
                    <span className="spinner" /> Authorizing Membership...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Join for {cost} {tokenSymbol} / month
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {showInstallModal && (
          <InstallWalletModal
            onClose={() => setShowInstallModal(false)}
            onInstalledAndConnected={() => {
              setShowInstallModal(false);
              void connectWeb3Wallet().then((w) => onWalletChange(w));
            }}
            notify={notify}
            autoRedirectWallet="metamask"
          />
        )}
      </section>
    </div>
  );
}
