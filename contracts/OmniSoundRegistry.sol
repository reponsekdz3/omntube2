// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OmniSoundRegistry
 * @dev On-Chain Audio, Sound & Video Remix Rights Registry with ERC-2981 Royalty Standard.
 * Stores immutable content fingerprints (Keccak-256), creator attribution, license fees,
 * and audio/video remix lineage (parent sounds and duets) on EVM blockchains (BSC, Polygon, Arbitrum, Ethereum).
 */
contract OmniSoundRegistry {
    // Structure defining an on-chain sound/audio track record
    struct AudioRecord {
        bytes32 fingerprint;         // Keccak256 content hash of audio PCM/WAV
        address payable creator;     // Creator's Web3 payout wallet
        string title;                // Title of the audio track
        string uri;                  // Metadata URI / IPFS / storage URL
        uint96 royaltyBps;           // Royalty basis points (e.g. 500 = 5.00%)
        uint256 licenseFee;          // Commercial remix license fee in native token wei
        bytes32 parentSoundHash;     // Fingerprint of parent sound if remixed (0x0 if original)
        bytes32 parentVideoHash;     // Fingerprint of parent video if duet (0x0 if original)
        uint256 registeredAt;        // Unix block timestamp
        uint256 totalRoyaltiesPaid;  // Cumulative royalties paid in wei
        bool exists;
    }

    // Structure defining an issued Audio NFT license
    struct AudioLicenseNFT {
        uint256 tokenId;
        bytes32 fingerprint;
        address licensee;
        uint256 mintedAt;
        uint256 feePaid;
    }

    string public name = "OmnPlay Audio & Remix Rights Registry";
    string public symbol = "OMNSND";
    address public owner;

    uint256 private _nextTokenId = 1;

    // Mapping from audio fingerprint to on-chain record
    mapping(bytes32 => AudioRecord) public audioRecords;

    // Mapping from token ID to NFT license
    mapping(uint256 => AudioLicenseNFT) public licenseNFTs;

    // Array of all registered fingerprints for on-chain enumeration
    bytes32[] public registeredFingerprints;

    // Events
    event SoundRegistered(
        bytes32 indexed fingerprint,
        address indexed creator,
        string title,
        uint96 royaltyBps,
        uint256 licenseFee,
        bytes32 indexed parentSoundHash
    );

    event RoyaltyPaid(
        bytes32 indexed fingerprint,
        address indexed payer,
        address indexed creator,
        uint256 amount
    );

    event AudioNFTMinted(
        uint256 indexed tokenId,
        bytes32 indexed fingerprint,
        address indexed licensee,
        uint256 feePaid
    );

    event DuetLineageRecorded(
        bytes32 indexed childVideoFingerprint,
        bytes32 indexed parentSoundFingerprint,
        bytes32 indexed parentVideoFingerprint,
        address creator
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only registry owner can execute");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register a new sound or remixed audio track on-chain.
     * @param fingerprint Keccak256 hash of the audio content
     * @param title Title of the sound
     * @param uri Metadata or audio stream URI
     * @param royaltyBps Basis points for royalties (e.g. 500 for 5%)
     * @param licenseFee Fee required to mint a commercial remix license (in wei)
     * @param parentSoundHash Fingerprint of source sound if remixed (0x0 if original)
     * @param parentVideoHash Fingerprint of source video if duet (0x0 if original)
     */
    function registerAudioTrack(
        bytes32 fingerprint,
        string calldata title,
        string calldata uri,
        uint96 royaltyBps,
        uint256 licenseFee,
        bytes32 parentSoundHash,
        bytes32 parentVideoHash
    ) external {
        require(fingerprint != bytes32(0), "Invalid audio fingerprint");
        require(!audioRecords[fingerprint].exists, "Sound fingerprint already registered");
        require(royaltyBps <= 5000, "Royalty cannot exceed 50%");

        audioRecords[fingerprint] = AudioRecord({
            fingerprint: fingerprint,
            creator: payable(msg.sender),
            title: title,
            uri: uri,
            royaltyBps: royaltyBps,
            licenseFee: licenseFee,
            parentSoundHash: parentSoundHash,
            parentVideoHash: parentVideoHash,
            registeredAt: block.timestamp,
            totalRoyaltiesPaid: 0,
            exists: true
        });

        registeredFingerprints.push(fingerprint);

        emit SoundRegistered(
            fingerprint,
            msg.sender,
            title,
            royaltyBps,
            licenseFee,
            parentSoundHash
        );

        if (parentSoundHash != bytes32(0) || parentVideoHash != bytes32(0)) {
            emit DuetLineageRecorded(
                fingerprint,
                parentSoundHash,
                parentVideoHash,
                msg.sender
            );
        }
    }

    /**
     * @notice Send on-chain royalty payment directly to sound creator.
     * @param fingerprint Keccak256 content hash of the sound
     */
    function payRoyalty(bytes32 fingerprint) external payable {
        require(msg.value > 0, "Royalty amount must be greater than zero");
        AudioRecord storage record = audioRecords[fingerprint];
        require(record.exists, "Sound not registered on-chain");

        record.totalRoyaltiesPaid += msg.value;

        // Forward payment directly to creator
        (bool sent, ) = record.creator.call{value: msg.value}("");
        require(sent, "Failed to send royalty to creator");

        emit RoyaltyPaid(fingerprint, msg.sender, record.creator, msg.value);
    }

    /**
     * @notice Mint an immutable Audio NFT license for commercial remixing and playback.
     * @param fingerprint Keccak256 content hash of the sound
     */
    function mintAudioLicenseNFT(bytes32 fingerprint) external payable returns (uint256) {
        AudioRecord storage record = audioRecords[fingerprint];
        require(record.exists, "Sound not registered on-chain");
        require(msg.value >= record.licenseFee, "Insufficient license fee provided");

        uint256 tokenId = _nextTokenId++;

        licenseNFTs[tokenId] = AudioLicenseNFT({
            tokenId: tokenId,
            fingerprint: fingerprint,
            licensee: msg.sender,
            mintedAt: block.timestamp,
            feePaid: msg.value
        });

        if (msg.value > 0) {
            record.totalRoyaltiesPaid += msg.value;
            (bool sent, ) = record.creator.call{value: msg.value}("");
            require(sent, "Failed to forward license fee to creator");
        }

        emit AudioNFTMinted(tokenId, fingerprint, msg.sender, msg.value);
        return tokenId;
    }

    /**
     * @notice ERC-2981 Standard: Returns royalty recipient and amount for a given sound or token.
     */
    function royaltyInfo(bytes32 fingerprint, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        AudioRecord memory record = audioRecords[fingerprint];
        if (!record.exists) {
            return (address(0), 0);
        }
        uint256 amount = (salePrice * record.royaltyBps) / 10000;
        return (record.creator, amount);
    }

    /**
     * @notice Check whether a sound fingerprint is already registered on-chain.
     */
    function isRegistered(bytes32 fingerprint) external view returns (bool) {
        return audioRecords[fingerprint].exists;
    }

    /**
     * @notice Get total count of registered audio records.
     */
    function totalRegisteredSounds() external view returns (uint256) {
        return registeredFingerprints.length;
    }

    /**
     * @notice Get audio record details by fingerprint.
     */
    function getAudioRecord(bytes32 fingerprint)
        external
        view
        returns (
            address creator,
            string memory title,
            string memory uri,
            uint96 royaltyBps,
            uint256 licenseFee,
            bytes32 parentSoundHash,
            bytes32 parentVideoHash,
            uint256 registeredAt,
            uint256 totalRoyaltiesPaid
        )
    {
        AudioRecord memory r = audioRecords[fingerprint];
        require(r.exists, "Sound not found");
        return (
            r.creator,
            r.title,
            r.uri,
            r.royaltyBps,
            r.licenseFee,
            r.parentSoundHash,
            r.parentVideoHash,
            r.registeredAt,
            r.totalRoyaltiesPaid
        );
    }
}
