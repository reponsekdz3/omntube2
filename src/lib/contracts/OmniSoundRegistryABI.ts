// OmniSoundRegistry ABI & Contract Addresses across supported EVM networks
export const OMNI_SOUND_REGISTRY_ABI = [
  "event SoundRegistered(bytes32 indexed fingerprint, address indexed creator, string title, uint96 royaltyBps, uint256 licenseFee, bytes32 indexed parentSoundHash)",
  "event RoyaltyPaid(bytes32 indexed fingerprint, address indexed payer, address indexed creator, uint256 amount)",
  "event AudioNFTMinted(uint256 indexed tokenId, bytes32 indexed fingerprint, address indexed licensee, uint256 feePaid)",
  "event DuetLineageRecorded(bytes32 indexed childVideoFingerprint, bytes32 indexed parentSoundFingerprint, bytes32 indexed parentVideoFingerprint, address creator)",
  "function registerAudioTrack(bytes32 fingerprint, string calldata title, string calldata uri, uint96 royaltyBps, uint256 licenseFee, bytes32 parentSoundHash, bytes32 parentVideoHash) external",
  "function payRoyalty(bytes32 fingerprint) external payable",
  "function mintAudioLicenseNFT(bytes32 fingerprint) external payable returns (uint256)",
  "function royaltyInfo(bytes32 fingerprint, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount)",
  "function isRegistered(bytes32 fingerprint) external view returns (bool)",
  "function totalRegisteredSounds() external view returns (uint256)",
  "function getAudioRecord(bytes32 fingerprint) external view returns (address creator, string memory title, string memory uri, uint96 royaltyBps, uint256 licenseFee, bytes32 parentSoundHash, bytes32 parentVideoHash, uint256 registeredAt, uint256 totalRoyaltiesPaid)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)"
] as const;

// Deployed or designated registry contract addresses per chain (using standard deterministic deploy addresses)
export const REGISTRY_CONTRACT_ADDRESSES: Record<string, string> = {
  "0x38": "0x38F7A1A4E92FeC4410aA84988e404bA3b4009038", // BSC Mainnet
  "0x1": "0x1A1867c293673FBEa88f7850a58Af82eE747F001",  // Ethereum Mainnet
  "0x89": "0x89c72E27e0A3F1F17d9539d48b783fE5dFa8D089", // Polygon Mainnet
  "0xa4b1": "0xa4b1C359f1396a5A4aE61aB9bC2241F8C9E744b1", // Arbitrum One
};
