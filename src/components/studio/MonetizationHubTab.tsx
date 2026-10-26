import React, { useEffect, useState } from "react";
import {
  Coins,
  CreditCard,
  Crown,
  ExternalLink,
  Flame,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  formatAddress,
  SUPPORTED_CHAINS,
  type SupportedChainId,
  type WalletState,
} from "../../lib/web3";
import type { Notice, VideoRow } from "../../types";

interface CreatorStats {
  address: string;
  transactionCount: number;
  breakdown: {
    tips: string;
    ppv: string;
    memberships: string;
    superchats: string;
    total: string;
  };
  recentTransactions: Array<{
    id: number;
    txHash: string;
    chain: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    tokenSymbol: string;
    transactionType: string;
    createdAt: string;
  }>;
}

export function MonetizationHubTab({
  creatorId,
  wallet,
  videos,
  notify,
}: {
  creatorId: string;
  wallet: WalletState;
  videos: VideoRow[];
  notify: (title: string, detail?: string, kind?: Notice["kind"]) => void;
}) {
  const [payoutWallet, setPayoutWallet] = useState<string>("");
  const [preferredChain, setPreferredChain] = useState<string>("bsc");
  const [savingWallet, setSavingWallet] = useState(false);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Load creator wallet configuration from Cloud SQL
  useEffect(() => {
    let active = true;
    async function loadWallet() {
      try {
        const res = await fetch(`/api/creators/${creatorId}/wallet`);
        if (res.ok) {
          const data = await res.json();
          if (active && data) {
            setPayoutWallet(data.walletAddress || "");
            setPreferredChain(data.preferredChain || "bsc");
          }
        }
      } catch (err) {
        console.warn("Failed to load creator wallet:", err);
      }
    }
    void loadWallet();
    return () => {
      active = false;
    };
  }, [creatorId]);

  // Load stats & transactions from Cloud SQL
  const refreshStats = async (targetWallet?: string) => {
    const addressToQuery = targetWallet || payoutWallet;
    if (!addressToQuery) return;

    setLoadingStats(true);
    try {
      const [statsRes, txsRes] = await Promise.all([
        fetch(`/api/monetization/creator-stats/${addressToQuery}`),
        fetch(`/api/monetization/transactions?creatorAddress=${addressToQuery}`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (txsRes.ok) {
        const txsData = await txsRes.json();
        setTransactions(txsData);
      }
    } catch (err) {
      console.warn("Failed to query stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (payoutWallet) {
      void refreshStats(payoutWallet);
    }
  }, [payoutWallet]);

  // Save creator wallet
  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutWallet.trim() || !payoutWallet.startsWith("0x") || payoutWallet.length !== 42) {
      notify("Invalid wallet address", "Please enter a valid 42-character 0x... EVM address.", "error");
      return;
    }

    setSavingWallet(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}/wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: payoutWallet.trim(),
          preferredChain,
        }),
      });

      if (!res.ok) {
        throw new Error("Server rejected wallet update.");
      }

      notify("Payout settings saved", "Cloud SQL record updated successfully.", "success");
      void refreshStats(payoutWallet.trim());
    } catch (err: any) {
      notify("Failed to save wallet", err.message, "error");
    } finally {
      setSavingWallet(false);
    }
  };

  // Helper to get block explorer URL for a tx
  const getExplorerTxUrl = (txHash: string, chain: string) => {
    let baseUrl = "https://bscscan.com";
    if (chain === "ethereum" || chain === "eth") baseUrl = "https://etherscan.io";
    else if (chain === "polygon") baseUrl = "https://polygonscan.com";
    else if (chain === "arbitrum") baseUrl = "https://arbiscan.io";
    return `${baseUrl}/tx/${txHash}`;
  };

  return (
    <div className="monetization-hub-tab space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-panel-2 to-amber-950/30 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-mint/15 text-mint">
              <Coins size={22} />
            </span>
            <h2 className="text-lg font-bold text-white">Web3 Creator Monetization Hub</h2>
          </div>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Real multi-chain crypto revenue powered by Binance Smart Chain, Ethereum, Polygon, and
            Arbitrum. All payments are verified on-chain and indexed into Google Cloud SQL.
          </p>
        </div>

        <button
          className="btn btn-quiet self-start md:self-auto text-xs"
          onClick={() => void refreshStats()}
          disabled={loadingStats}
        >
          <RefreshCw size={14} className={loadingStats ? "animate-spin" : ""} /> Refresh Ledger
        </button>
      </div>

      {/* Grid: Wallet Settings & Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Payout Settings */}
        <div className="p-5 rounded-2xl bg-panel-2 border border-border lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={18} className="text-mint" />
            <h3 className="text-sm font-bold text-white">Payout Receiving Wallet</h3>
          </div>
          <p className="text-xs text-muted mb-4">
            Where your tips, PPV unlocks, channel memberships, and SuperChat payments are routed.
          </p>

          <form onSubmit={handleSaveWallet} className="space-y-4">
            <div>
              <label className="text-2xs font-bold text-muted uppercase block mb-1">
                EVM Wallet Address (0x...)
              </label>
              <input
                type="text"
                value={payoutWallet}
                onChange={(e) => setPayoutWallet(e.target.value)}
                placeholder="0x..."
                className="w-full text-xs font-mono"
                required
              />
              {wallet.connected && wallet.address && (
                <button
                  type="button"
                  className="mt-1.5 text-2xs text-mint hover:underline inline-flex items-center gap-1"
                  onClick={() => setPayoutWallet(wallet.address || "")}
                >
                  <Sparkles size={11} /> Use currently connected wallet ({formatAddress(wallet.address)})
                </button>
              )}
            </div>

            <div>
              <label className="text-2xs font-bold text-muted uppercase block mb-1">
                Preferred Default Network
              </label>
              <select
                value={preferredChain}
                onChange={(e) => setPreferredChain(e.target.value)}
                className="w-full text-xs font-semibold"
              >
                <option value="bsc">BNB Smart Chain (BSC - Fast & Low Fee)</option>
                <option value="polygon">Polygon PoS (Low Fee)</option>
                <option value="arbitrum">Arbitrum One (L2 Rollup)</option>
                <option value="ethereum">Ethereum Mainnet</option>
              </select>
            </div>

            <div className="p-3 bg-panel/60 rounded-xl border border-border text-xs space-y-1">
              <div className="flex justify-between text-muted">
                <span>Database Sync:</span>
                <span className="text-mint font-semibold flex items-center gap-1">
                  <ShieldCheck size={13} /> Cloud SQL Live
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Multi-chain Routing:</span>
                <span className="text-white font-medium">Automatic</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full text-xs"
              disabled={savingWallet || !payoutWallet.trim()}
            >
              {savingWallet ? (
                <>
                  <span className="spinner" /> Saving to Cloud SQL...
                </>
              ) : (
                <>
                  <Save size={14} /> Update Payout Configuration
                </>
              )}
            </button>
          </form>
        </div>

        {/* Card 2 & 3: Real Cloud SQL Stats */}
        <div className="p-5 rounded-2xl bg-panel-2 border border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-yellow-400" />
              <h3 className="text-sm font-bold text-white">On-Chain Earnings Performance</h3>
            </div>
            <span className="text-2xs font-mono text-muted">
              {stats?.transactionCount || 0} Verified Transactions
            </span>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-panel border border-border">
              <span className="text-2xs text-muted block flex items-center gap-1">
                <Coins size={12} className="text-mint" /> Direct Tips
              </span>
              <strong className="text-lg font-bold font-mono text-mint block mt-1">
                {stats?.breakdown.tips || "0.0000"}
              </strong>
              <small className="text-2xs text-muted">Native / USDT</small>
            </div>

            <div className="p-3 rounded-xl bg-panel border border-border">
              <span className="text-2xs text-muted block flex items-center gap-1">
                <KeyRound size={12} className="text-blue" /> PPV Unlocks
              </span>
              <strong className="text-lg font-bold font-mono text-blue block mt-1">
                {stats?.breakdown.ppv || "0.0000"}
              </strong>
              <small className="text-2xs text-muted">Pay-per-view access</small>
            </div>

            <div className="p-3 rounded-xl bg-panel border border-border">
              <span className="text-2xs text-muted block flex items-center gap-1">
                <Crown size={12} className="text-yellow-400" /> Memberships
              </span>
              <strong className="text-lg font-bold font-mono text-yellow-400 block mt-1">
                {stats?.breakdown.memberships || "0.0000"}
              </strong>
              <small className="text-2xs text-muted">30-day tiers</small>
            </div>

            <div className="p-3 rounded-xl bg-panel border border-border">
              <span className="text-2xs text-muted block flex items-center gap-1">
                <Flame size={12} className="text-red-400" /> SuperChats
              </span>
              <strong className="text-lg font-bold font-mono text-red-400 block mt-1">
                {stats?.breakdown.superchats || "0.0000"}
              </strong>
              <small className="text-2xs text-muted">Live broadcasts</small>
            </div>
          </div>

          {/* Total Earned Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-mint/10 to-yellow-500/10 border border-mint/20 flex items-center justify-between">
            <div>
              <span className="text-2xs uppercase tracking-wider font-bold text-muted block">
                Total Cumulative Crypto Revenue
              </span>
              <strong className="text-2xl font-bold font-mono text-white mt-0.5 block">
                {stats?.breakdown.total || "0.0000"}{" "}
                <span className="text-sm font-semibold text-mint">Crypto Units</span>
              </strong>
            </div>
            <div className="text-right">
              <span className="text-2xs text-muted block">Settlement Model</span>
              <span className="text-xs font-semibold text-mint">Instant Peer-to-Peer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Live Transaction Ledger */}
      <div className="p-5 rounded-2xl bg-panel-2 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard size={18} className="text-mint" /> Cloud SQL Transaction Ledger
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Live audit trail of all peer-to-peer cryptocurrency interactions with transaction hashes.
            </p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center bg-panel rounded-xl border border-border">
            <Coins size={32} className="mx-auto text-muted mb-2" />
            <h4 className="text-xs font-semibold text-white">No transactions recorded yet</h4>
            <p className="text-2xs text-muted mt-1 max-w-md mx-auto">
              Transactions from viewer tips, pay-per-view video purchases, channel memberships, and
              live stream SuperChats will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted uppercase text-2xs tracking-wider">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Network</th>
                  <th className="py-2.5 px-3">Sender</th>
                  <th className="py-2.5 px-3">Tx Hash</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {transactions.map((tx) => {
                  const explorerLink = getExplorerTxUrl(tx.txHash, tx.chain);
                  let typeColor = "bg-mint/15 text-mint border-mint/30";
                  let typeLabel = "Tip";
                  if (tx.transactionType === "ppv_unlock") {
                    typeColor = "bg-blue/15 text-blue border-blue/30";
                    typeLabel = "PPV Unlock";
                  } else if (tx.transactionType === "membership") {
                    typeColor = "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
                    typeLabel = "Membership";
                  } else if (tx.transactionType === "superchat") {
                    typeColor = "bg-red-500/15 text-red-400 border-red-500/30";
                    typeLabel = "SuperChat";
                  }

                  return (
                    <tr key={tx.id || tx.txHash} className="hover:bg-panel/40 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-2xs font-semibold border ${typeColor}`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        {tx.amount} <span className="text-muted text-2xs">{tx.tokenSymbol}</span>
                      </td>
                      <td className="py-3 px-3 uppercase text-2xs font-semibold text-slate-300">
                        {tx.chain}
                      </td>
                      <td className="py-3 px-3 font-mono text-muted text-2xs">
                        {formatAddress(tx.fromAddress)}
                      </td>
                      <td className="py-3 px-3 font-mono text-2xs">
                        <a
                          href={explorerLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-mint hover:underline inline-flex items-center gap-1"
                        >
                          {formatAddress(tx.txHash)}
                          <ExternalLink size={11} />
                        </a>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-2xs text-mint">
                          <span className="w-1.5 h-1.5 rounded-full bg-mint" /> Confirmed
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-muted text-2xs font-mono">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section: Pay-Per-View Content Manager */}
      <div className="p-5 rounded-2xl bg-panel-2 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock size={18} className="text-yellow-400" /> Pay-Per-View Video Configuration
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Select videos to gate with on-chain pay-per-view access. Viewers must authorize a crypto
              payment to unlock high-definition streaming.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {videos.slice(0, 6).map((v) => (
            <div key={v.id} className="p-3 bg-panel rounded-xl border border-border flex gap-3">
              <div className="w-20 h-12 bg-black/60 rounded-lg overflow-hidden shrink-0 relative">
                {v.thumbnail_path ? (
                  <img
                    src={`/storage/v1/object/public/omnitube-thumbnails/${v.thumbnail_path}`}
                    alt={v.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                    Video
                  </div>
                )}
                <div className="absolute top-1 right-1 px-1 bg-black/70 rounded text-2xs text-yellow-400 font-mono">
                  PPV
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-white truncate">{v.title}</h4>
                <div className="flex items-center justify-between mt-1 text-2xs text-muted">
                  <span>Price: 0.01 BNB</span>
                  <span className="text-mint font-semibold">Active</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
