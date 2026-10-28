import React, { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Globe, LogOut, Wallet } from "lucide-react";
import {
  connectWeb3Wallet,
  formatAddress,
  getInjectedProvider,
  SUPPORTED_CHAINS,
  switchNetwork,
  type SupportedChainId,
  type WalletState,
} from "../../lib/web3";
import { MultiChainWalletModal } from "./MultiChainWalletModal";

export function Web3WalletBar({
  wallet,
  onWalletChange,
  notify,
}: {
  wallet: WalletState;
  onWalletChange: (w: WalletState) => void;
  notify: (title: string, detail?: string, kind?: "success" | "error" | "info") => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [showChainMenu, setShowChainMenu] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Listen to provider account and chain changes
  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        onWalletChange({
          connected: false,
          address: null,
          chainId: null,
          balance: "0.00",
          walletName: "None",
        });
        notify("Wallet disconnected.");
      } else {
        onWalletChange({
          ...wallet,
          connected: true,
          address: accounts[0],
        });
      }
    };

    const handleChainChanged = (chainId: string) => {
      onWalletChange({
        ...wallet,
        chainId: chainId as SupportedChainId,
      });
    };

    if (provider.on) {
      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [wallet, onWalletChange, notify]);

  const handleSwitchChain = async (targetChain: SupportedChainId) => {
    setShowChainMenu(false);
    try {
      await switchNetwork(targetChain);
      onWalletChange({
        ...wallet,
        chainId: targetChain,
      });
      const config = SUPPORTED_CHAINS[targetChain];
      notify("Network switched", `Active network: ${config.name}`, "success");
    } catch (err: any) {
      notify("Failed to switch network", err.message, "error");
    }
  };

  const activeChainConfig =
    (wallet.chainId && SUPPORTED_CHAINS[wallet.chainId as SupportedChainId]) ||
    SUPPORTED_CHAINS["0x38"]; // default to BSC

  if (!wallet.connected) {
    return (
      <>
        <button
          className="btn btn-quiet text-xs flex items-center gap-2 web3-connect-btn"
          onClick={() => setShowWalletModal(true)}
          disabled={connecting}
          title="Connect Web3 Wallet (MetaMask, Phantom, Mobile)"
        >
          <Wallet size={15} className="text-amber-400" />
          <span>Connect Wallet</span>
        </button>
        <MultiChainWalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          wallet={wallet}
          onWalletChange={onWalletChange}
          notify={notify}
        />
      </>
    );
  }

  return (
    <div className="web3-wallet-status-cluster relative flex items-center gap-2">
      {/* Network Switcher Button */}
      <button
        className="chain-badge-btn"
        onClick={() => setShowChainMenu(!showChainMenu)}
        title="Switch Blockchain Network"
      >
        <span>{activeChainConfig.icon}</span>
        <span className="font-semibold text-xs">{activeChainConfig.shortName}</span>
        <ChevronDown size={12} className="text-muted" />
      </button>

      {/* Chain Dropdown */}
      {showChainMenu && (
        <div className="chain-selector-dropdown">
          <div className="p-2 border-b border-border text-xs text-muted font-bold uppercase tracking-wider">
            Select Network
          </div>
          {(Object.keys(SUPPORTED_CHAINS) as SupportedChainId[]).map((cid) => {
            const c = SUPPORTED_CHAINS[cid];
            const isActive = wallet.chainId === cid;
            return (
              <button
                key={cid}
                className={`chain-dropdown-item ${isActive ? "active text-mint" : ""}`}
                onClick={() => handleSwitchChain(cid)}
              >
                <span>{c.icon}</span>
                <span className="flex-1 text-left">{c.name}</span>
                {isActive && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Address & Balance Pill */}
      <div className="wallet-chip">
        <span className="wallet-balance font-mono text-xs">
          {wallet.balance} {activeChainConfig.nativeSymbol}
        </span>
        <span className="wallet-sep">·</span>
        <span className="wallet-addr font-mono text-xs font-semibold">
          {formatAddress(wallet.address)}
        </span>
      </div>
    </div>
  );
}
