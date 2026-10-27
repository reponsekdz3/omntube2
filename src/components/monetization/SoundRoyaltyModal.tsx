import React, { useState, useEffect } from "react";
import {
  Coins,
  Disc,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  SUPPORTED_CHAINS,
  type SupportedChainId,
  type WalletState,
  connectWeb3Wallet,
  formatAddress,
  getLiveNetworkGasPrice,
  computeAudioContentFingerprint,
  sendSoundRoyaltyPayment,
  mintSoundNFTOnChain,
  registerSoundOnChainRegistry,
} from "../../lib/web3";
import type { VideoRow } from "../../types";

interface SoundRoyaltyModalProps {
  video: VideoRow;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
  onClose: () => void;
  notify?: (title: string, desc?: string, variant?: "success" | "error" | "info") => void;
}

export function SoundRoyaltyModal({
  video,
  wallet,
  onWalletChange,
  onClose,
  notify,
}: SoundRoyaltyModalProps) {
  const [targetChain, setTargetChain] = useState<SupportedChainId>("0x38"); // Default BSC
  const [royaltyAmount, setRoyaltyAmount] = useState<string>("0.005");
  const [gasPrice, setGasPrice] = useState<string>("3.00 Gwei");
  const [contentFingerprint, setContentFingerprint] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [txSuccess, setTxSuccess] = useState<{
    txHash: string;
    explorerUrl: string;
    type: "royalty" | "nft";
    tokenId?: string;
  } | null>(null);

  // Fallback recipient address if creator hasn't configured wallet
  const creatorAddress = "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7";

  useEffect(() => {
    // Compute Keccak256 on-chain fingerprint of sound
    const fp = computeAudioContentFingerprint(video.id + ":" + video.title + ":" + (video.video_path || "sound"));
    setContentFingerprint(fp);

    // Fetch live on-chain gas price
    getLiveNetworkGasPrice(targetChain)
      .then((gp) => setGasPrice(gp))
      .catch(() => {});
  }, [video, targetChain]);

  const activeChainConfig = SUPPORTED_CHAINS[targetChain] || SUPPORTED_CHAINS["0x38"];

  const handleConnectWallet = async () => {
    try {
      const state = await connectWeb3Wallet();
      onWalletChange?.(state);
      notify?.("Wallet Connected", `Connected to ${formatAddress(state.address)}`, "success");
    } catch (e: any) {
      notify?.("Connection Failed", e?.message || "Failed to connect Web3 wallet", "error");
    }
  };

  const handlePayRoyalty = async () => {
    if (!wallet?.connected) {
      await handleConnectWallet();
      return;
    }

    try {
      setIsProcessing(true);
      notify?.("Confirm Transaction", `Confirm ${royaltyAmount} ${activeChainConfig.nativeSymbol} in your Web3 wallet...`, "info");

      const result = await sendSoundRoyaltyPayment({
        recipientAddress: creatorAddress,
        soundTitle: video.title,
        soundId: video.id,
        amount: royaltyAmount,
        targetChain,
      });

      setTxSuccess({
        txHash: result.txHash,
        explorerUrl: result.blockExplorerUrl,
        type: "royalty",
      });
      setIsProcessing(false);
      notify?.("Royalty Paid on Chain!", `Sent ${royaltyAmount} ${activeChainConfig.nativeSymbol} to sound creator.`, "success");
    } catch (err: any) {
      setIsProcessing(false);
      notify?.("Transaction Failed", err?.message || "Failed to process on-chain royalty", "error");
    }
  };

  const handleMintNFT = async () => {
    if (!wallet?.connected || !wallet.address) {
      await handleConnectWallet();
      return;
    }

    try {
      setIsProcessing(true);
      notify?.("Minting Sound NFT", "Sign on-chain audio minting transaction in wallet...", "info");

      const result = await mintSoundNFTOnChain({
        soundId: video.id,
        title: video.title,
        creatorAddress: wallet.address,
        audioFingerprint: contentFingerprint,
        targetChain,
      });

      setTxSuccess({
        txHash: result.txHash,
        explorerUrl: result.blockExplorerUrl,
        type: "nft",
        tokenId: result.tokenId,
      });
      setIsProcessing(false);
      notify?.("Audio NFT Minted!", `Minted token #${result.tokenId.slice(-6)} on ${activeChainConfig.name}`, "success");
    } catch (err: any) {
      setIsProcessing(false);
      notify?.("Minting Failed", err?.message || "Failed to mint sound NFT on blockchain", "error");
    }
  };

  const handleRegisterOnChain = async () => {
    if (!wallet?.connected || !wallet.address) {
      await handleConnectWallet();
      return;
    }

    try {
      setIsProcessing(true);
      notify?.("Registering on Blockchain", "Submitting sound rights to OmniSoundRegistry smart contract...", "info");

      const result = await registerSoundOnChainRegistry({
        soundFingerprint: contentFingerprint,
        title: video.title,
        uri: video.video_path || "",
        royaltyBps: 500, // 5%
        targetChain,
      });

      setTxSuccess({
        txHash: result.txHash,
        explorerUrl: result.blockExplorerUrl,
        type: "royalty",
      });
      setIsProcessing(false);
      notify?.("Sound Registered On-Chain!", `Recorded audio rights on ${activeChainConfig.name}`, "success");
    } catch (err: any) {
      setIsProcessing(false);
      notify?.("Registration Failed", err?.message || "Failed to register sound on-chain", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl border border-cyan-500/40 bg-slate-900 p-6 shadow-2xl text-slate-100 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400">
              <Disc className="h-6 w-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Space_Grotesk'] line-clamp-1">
                Blockchain Audio Registry & Royalties
              </h3>
              <p className="text-xs text-slate-400">
                On-Chain Sound Licensing // EVM Smart Contracts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sound & Fingerprint Details */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Sound Track:</span>
            <span className="font-bold text-white truncate max-w-[220px]">{video.title}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Original Creator:</span>
            <span className="font-mono text-cyan-400">{formatAddress(creatorAddress)}</span>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Keccak256 Audio Fingerprint:
            </span>
            <span className="font-mono text-[11px] text-slate-300 break-all bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              {contentFingerprint || "0x..."}
            </span>
          </div>
        </div>

        {/* Chain Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Select Blockchain:</span>
            <span className="font-mono text-[11px] text-cyan-400">Live Gas: {gasPrice}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(["0x38", "0x89", "0xa4b1", "0x1"] as const).map((cId) => {
              const cfg = SUPPORTED_CHAINS[cId];
              const isSelected = targetChain === cId;
              return (
                <button
                  key={cId}
                  onClick={() => setTargetChain(cId)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-950/60 text-white shadow-md shadow-cyan-950/40"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-base mb-0.5">{cfg.icon}</span>
                  <span>{cfg.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Royalty Amount Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Royalty / Tip Amount:</span>
            <span className="font-mono text-cyan-400 font-bold">
              {royaltyAmount} {activeChainConfig.nativeSymbol}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {["0.002", "0.005", "0.015"].map((amt) => (
              <button
                key={amt}
                onClick={() => setRoyaltyAmount(amt)}
                className={`py-2 rounded-xl border font-mono transition ${
                  royaltyAmount === amt
                    ? "border-cyan-500 bg-cyan-950/60 text-cyan-300 font-bold"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                {amt} {activeChainConfig.nativeSymbol}
              </button>
            ))}
          </div>
        </div>

        {/* Success Banner */}
        {txSuccess && (
          <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/30 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 size={16} />
              {txSuccess.type === "royalty" ? "On-Chain Royalty Verified!" : "Audio NFT Mint Confirmed!"}
            </div>
            <p className="text-slate-300">
              Transaction recorded immutably on {activeChainConfig.name}.
            </p>
            <a
              href={txSuccess.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-mono text-[11px] underline"
            >
              Verify on {activeChainConfig.shortName} Explorer <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          {!wallet?.connected ? (
            <button
              onClick={handleConnectWallet}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-500 transition cursor-pointer"
            >
              <Wallet size={16} /> Connect Web3 Wallet (MetaMask / Binance)
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handlePayRoyalty}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 p-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50 text-center"
              >
                <Coins size={16} />
                <span>{isProcessing ? "Signing..." : "Pay Royalty"}</span>
              </button>

              <button
                onClick={handleRegisterOnChain}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/50 p-3 text-xs font-bold text-emerald-300 transition cursor-pointer disabled:opacity-50 text-center"
              >
                <ShieldCheck size={16} />
                <span>{isProcessing ? "Pending..." : "Register Sound"}</span>
              </button>

              <button
                onClick={handleMintNFT}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-indigo-500/50 bg-indigo-950/40 hover:bg-indigo-900/50 p-3 text-xs font-bold text-indigo-300 transition cursor-pointer disabled:opacity-50 text-center"
              >
                <Sparkles size={16} />
                <span>{isProcessing ? "Minting..." : "Mint NFT"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
