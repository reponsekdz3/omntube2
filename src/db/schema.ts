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
