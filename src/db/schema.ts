import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Users registered via Firebase Auth & linked to Web3 wallets
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  displayName: text("display_name"),
  walletAddress: text("wallet_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Creator receiving wallets for crypto payouts
export const creatorsWallets = pgTable("creators_wallets", {
  id: serial("id").primaryKey(),
  creatorId: text("creator_id").notNull().unique(),
  walletAddress: text("wallet_address").notNull(),
  preferredChain: text("preferred_chain").notNull().default("bsc"),
  payoutEnabled: boolean("payout_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// All on-chain verified crypto transactions (Tips, PPV, Memberships, SuperChats)
export const cryptoTransactions = pgTable("crypto_transactions", {
  id: serial("id").primaryKey(),
  txHash: text("tx_hash").notNull().unique(),
  chain: text("chain").notNull(), // 'bsc' | 'ethereum' | 'polygon' | 'arbitrum'
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: text("amount").notNull(),
  tokenSymbol: text("token_symbol").notNull(), // 'BNB' | 'ETH' | 'MATIC' | 'USDT'
  usdEquivalent: text("usd_equivalent"),
  transactionType: text("transaction_type").notNull(), // 'tip' | 'ppv_unlock' | 'membership' | 'superchat'
  targetId: text("target_id"), // videoId, creatorId, or streamId
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Video pay-per-view access records
export const videoUnlocks = pgTable("video_unlocks", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  userAddress: text("user_address").notNull(),
  txHash: text("tx_hash").notNull(),
  amountPaid: text("amount_paid").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// Creator channel memberships with tiers
export const channelMemberships = pgTable("channel_memberships", {
  id: serial("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  subscriberAddress: text("subscriber_address").notNull(),
  tier: text("tier").notNull(), // 'bronze' | 'silver' | 'gold'
  chain: text("chain").notNull(),
  txHash: text("tx_hash").notNull(),
  amount: text("amount").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Live SuperChat messages with color tiering
export const superchatMessages = pgTable("superchat_messages", {
  id: serial("id").primaryKey(),
  streamId: text("stream_id").notNull(),
  senderAddress: text("sender_address").notNull(),
  amount: text("amount").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").notNull(),
  txHash: text("tx_hash").notNull(),
  message: text("message").notNull(),
  colorTier: text("color_tier").notNull().default("gold"), // 'gold' | 'mint' | 'violet' | 'coral'
  createdAt: timestamp("created_at").defaultNow(),
});

// Comprehensive On-Chain Registered Audio & Sounds
export const sounds = pgTable("sounds", {
  id: serial("id").primaryKey(),
  soundId: text("sound_id").notNull().unique(),
  creatorId: text("creator_id").notNull(),
  creatorAddress: text("creator_address"),
  sourceVideoId: text("source_video_id"),
  title: text("title").notNull(),
  audioPath: text("audio_path").notNull(),
  durationSeconds: integer("duration_seconds").default(30),
  waveformPeaks: text("waveform_peaks"), // JSON array of float peaks
  bpm: integer("bpm").default(120),
  musicalKey: text("musical_key"),
  audioFingerprint: text("audio_fingerprint").notNull(), // Keccak256 hash
  royaltyBps: integer("royalty_bps").default(500), // 5% default
  licenseFee: text("license_fee").default("0"),
  usesCount: integer("uses_count").default(0),
  isNftMinted: boolean("is_nft_minted").default(false),
  nftTokenId: text("nft_token_id"),
  nftTxHash: text("nft_tx_hash"),
  chain: text("chain").default("bsc"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Creator Tier Configuration for Subscriptions
export const creatorTiers = pgTable("creator_tiers", {
  id: serial("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  tierName: text("tier_name").notNull(), // 'Supporter' | 'VIP' | 'Elite Patron'
  tierLevel: integer("tier_level").notNull().default(1),
  monthlyPriceUsd: text("monthly_price_usd").notNull(), // e.g. "4.99"
  monthlyPriceCrypto: text("monthly_price_crypto").notNull(), // e.g. "0.008"
  tokenSymbol: text("token_symbol").notNull().default("BNB"),
  perksJson: text("perks_json"), // JSON string of perk bullet points
  badgeColor: text("badge_color").default("#59ebc8"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscriber Membership Subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  subscriberId: text("subscriber_id"),
  subscriberAddress: text("subscriber_address").notNull(),
  tierId: integer("tier_id"),
  tierName: text("tier_name").notNull(),
  amount: text("amount").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").notNull(),
  txHash: text("tx_hash").notNull().unique(),
  status: text("status").notNull().default("active"), // 'active' | 'expired' | 'cancelled'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sound Royalties & Licensing Records
export const soundRoyalties = pgTable("sound_royalties", {
  id: serial("id").primaryKey(),
  soundId: text("sound_id").notNull(),
  payerAddress: text("payer_address").notNull(),
  creatorAddress: text("creator_address").notNull(),
  amount: text("amount").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  chain: text("chain").notNull(),
  txHash: text("tx_hash").notNull().unique(),
  royaltyType: text("royalty_type").default("remix_license"), // 'tip' | 'remix_license' | 'nft_mint'
  status: text("status").default("confirmed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Derivative Remix & Duet Lineage
export const remixLineage = pgTable("remix_lineage", {
  id: serial("id").primaryKey(),
  childVideoId: text("child_video_id").notNull(),
  parentVideoId: text("parent_video_id"),
  parentSoundId: text("parent_sound_id"),
  creatorId: text("creator_id").notNull(),
  remixType: text("remix_type").notNull(), // 'duet_split' | 'duet_pip' | 'audio_swap' | 'camera_take'
  childFingerprint: text("child_fingerprint"),
  notarizedTxHash: text("notarized_tx_hash"),
  chain: text("chain"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Open Search Full-Text Inverted Index
export const searchIndex = pgTable("search_index", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'video' | 'sound' | 'creator' | 'playlist'
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  tags: text("tags"), // comma-separated or space-separated tokens
  category: text("category"),
  kind: text("kind"), // 'video' | 'short' | 'audio'
  viewCount: integer("view_count").default(0),
  scoreWeight: integer("score_weight").default(100),
  searchVector: text("search_vector"), // pre-computed searchable string
  indexedAt: timestamp("indexed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
