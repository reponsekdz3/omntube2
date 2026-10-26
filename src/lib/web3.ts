import { ethers } from "ethers";

export type SupportedChainId = "0x38" | "0x1" | "0x89" | "0xa4b1";

export interface ChainConfig {
  chainIdHex: SupportedChainId;
  chainIdDec: number;
  name: string;
  shortName: string;
  nativeSymbol: string;
  rpcUrls: string[];
  blockExplorerUrl: string;
  color: string;
  icon: string;
}

export const SUPPORTED_CHAINS: Record<SupportedChainId, ChainConfig> = {
  "0x38": {
    chainIdHex: "0x38",
    chainIdDec: 56,
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeSymbol: "BNB",
    rpcUrls: ["https://binance.llamarpc.com", "https://bsc-dataseed.binance.org"],
    blockExplorerUrl: "https://bscscan.com",
    color: "#F3BA2F",
    icon: "🟡",
  },
  "0x1": {
    chainIdHex: "0x1",
    chainIdDec: 1,
    name: "Ethereum Mainnet",
    shortName: "ETH",
    nativeSymbol: "ETH",
    rpcUrls: ["https://eth.llamarpc.com", "https://cloudflare-eth.com"],
    blockExplorerUrl: "https://etherscan.io",
    color: "#627EEA",
    icon: "🔷",
  },
  "0x89": {
    chainIdHex: "0x89",
    chainIdDec: 137,
    name: "Polygon PoS",
    shortName: "Polygon",
    nativeSymbol: "MATIC",
    rpcUrls: ["https://polygon.llamarpc.com", "https://rpc-mainnet.maticvigil.com"],
    blockExplorerUrl: "https://polygonscan.com",
    color: "#8247E5",
    icon: "🟣",
  },
  "0xa4b1": {
    chainIdHex: "0xa4b1",
    chainIdDec: 42161,
    name: "Arbitrum One",
    shortName: "Arbitrum",
    nativeSymbol: "ETH",
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    blockExplorerUrl: "https://arbiscan.io",
    color: "#28A0F0",
    icon: "🔵",
  },
};

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: SupportedChainId | string | null;
  balance: string;
  walletName: "MetaMask" | "Binance Web3" | "Injected Web3" | "None";
}

// Get global injected ethereum provider
export function getInjectedProvider(): any {
  if (typeof window === "undefined") return null;
  const anyWindow = window as any;
  if (anyWindow.ethereum) {
    return anyWindow.ethereum;
  }
  if (anyWindow.BinanceChain) {
    return anyWindow.BinanceChain;
  }
  return null;
}

export function detectWalletName(provider: any): WalletState["walletName"] {
  if (!provider) return "None";
  if (provider.isBinance) return "Binance Web3";
  if (provider.isMetaMask) return "MetaMask";
  return "Injected Web3";
}

// Format crypto address (e.g. 0x1234...5678)
export function formatAddress(address: string | null | undefined): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Connect Wallet
export async function connectWeb3Wallet(): Promise<WalletState> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      "No Web3 wallet found. Please install MetaMask or Binance Web3 Wallet extension to continue."
    );
  }

  const browserProvider = new ethers.BrowserProvider(provider);
  const accounts = await browserProvider.send("eth_requestAccounts", []);
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts authorized by wallet.");
  }

  const address = accounts[0];
  const network = await browserProvider.getNetwork();
  const chainIdHex = `0x${network.chainId.toString(16)}` as SupportedChainId;

  let balanceFormatted = "0.00";
  try {
    const rawBalance = await browserProvider.getBalance(address);
    balanceFormatted = parseFloat(ethers.formatEther(rawBalance)).toFixed(4);
  } catch {
    // Ignore balance fetch failure
  }

  return {
    connected: true,
    address,
    chainId: chainIdHex,
    balance: balanceFormatted,
    walletName: detectWalletName(provider),
  };
}

// Switch network to BSC, Ethereum, Polygon, or Arbitrum
export async function switchNetwork(targetChain: SupportedChainId): Promise<void> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error("No Web3 provider available.");

  const config = SUPPORTED_CHAINS[targetChain];
  if (!config) throw new Error("Unsupported network selected.");

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: config.chainIdHex }],
    });
  } catch (switchError: any) {
    // Error code 4902 indicates chain has not been added to wallet yet
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: config.chainIdHex,
            chainName: config.name,
            nativeCurrency: {
              name: config.nativeSymbol,
              symbol: config.nativeSymbol,
              decimals: 18,
            },
            rpcUrls: config.rpcUrls,
            blockExplorerUrls: [config.blockExplorerUrl],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

// Send cryptocurrency tip / unlock transaction
export async function sendCryptoPayment({
  recipientAddress,
  amount,
  tokenSymbol,
  targetChain,
}: {
  recipientAddress: string;
  amount: string; // in native units, e.g. "0.05"
  tokenSymbol: "BNB" | "ETH" | "MATIC" | "USDT";
  targetChain: SupportedChainId;
}): Promise<{ txHash: string; chain: string; amount: string; tokenSymbol: string }> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error("Please connect MetaMask or Binance Web3 Wallet.");

  const browserProvider = new ethers.BrowserProvider(provider);
  const signer = await browserProvider.getSigner();
  const currentNetwork = await browserProvider.getNetwork();
  const currentChainHex = `0x${currentNetwork.chainId.toString(16)}` as SupportedChainId;

  // If wrong network, prompt switch
  if (currentChainHex !== targetChain) {
    await switchNetwork(targetChain);
  }

  // Native token transfer (BNB, ETH, MATIC)
  if (tokenSymbol !== "USDT") {
    const parsedAmount = ethers.parseEther(amount);
    const tx = await signer.sendTransaction({
      to: recipientAddress,
      value: parsedAmount,
    });

    const chainConfig = SUPPORTED_CHAINS[targetChain] || SUPPORTED_CHAINS["0x38"];
    return {
      txHash: tx.hash,
      chain: chainConfig.shortName.toLowerCase(),
      amount,
      tokenSymbol,
    };
  } else {
    // USDT BEP-20 / ERC-20 transfer
    // Simple transfer method: function transfer(address to, uint256 value)
    const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
    // Standard contract addresses
    const usdtAddresses: Record<string, string> = {
      "0x38": "0x55d398326f99059fF775485246999027B3197955", // BSC USDT
      "0x1": "0xdAC17F958D2ee523a2206206994597C13D831ec7", // ETH USDT
      "0x89": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon USDT
      "0xa4b1": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum USDT
    };

    const tokenAddress = usdtAddresses[targetChain] || usdtAddresses["0x38"];
    const contract = new ethers.Contract(tokenAddress, abi, signer);
    // USDT uses 6 decimals or 18 decimals depending on chain (BSC USDT is 18 decimals, ETH USDT is 6 decimals)
    const decimals = targetChain === "0x38" ? 18 : 6;
    const parsedAmount = ethers.parseUnits(amount, decimals);
    const tx = await contract.transfer(recipientAddress, parsedAmount);

    const chainConfig = SUPPORTED_CHAINS[targetChain] || SUPPORTED_CHAINS["0x38"];
    return {
      txHash: tx.hash,
      chain: chainConfig.shortName.toLowerCase(),
      amount,
      tokenSymbol: "USDT",
    };
  }
}
