import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import * as schema from "./src/db/schema.ts";
import { desc, eq, and, gt } from "drizzle-orm";

dotenv.config();

const app = express();
const port = 3000;

// Security & Validation Helpers
const EVM_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const VALID_CHAINS = new Set(["bsc", "ethereum", "polygon", "arbitrum"]);
const VALID_TIERS = new Set(["bronze", "silver", "gold"]);
const VALID_COLOR_TIERS = new Set(["gold", "mint", "violet", "coral"]);
const VALID_TX_TYPES = new Set(["tip", "ppv_unlock", "membership", "superchat"]);

function sanitizeText(str: any, maxLen = 1000): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function isValidAmount(amount: any): boolean {
  if (typeof amount !== "string" && typeof amount !== "number") return false;
  const num = parseFloat(String(amount));
  return !isNaN(num) && num > 0 && num < 1000000;
}

// In-memory IP rate limiter to protect API against abuse & brute-force
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(req: Request, res: Response, next: () => void) {
  const ip = req.ip || (req.socket ? req.socket.remoteAddress : "127.0.0.1") || "127.0.0.1";
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + 60000;
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);
  if (entry.count > 180) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }
  next();
}

// High-level Security Headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), payment=(self)"
  );
  next();
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/api", rateLimiter);

// Health check endpoint for container orchestrators & hosting probes
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "OmniTube Pro Backend",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: process.env.SQL_HOST ? "connected" : "in-memory-fallback",
    env: process.env.NODE_ENV || "development",
  });
});

// 1. Get creator wallet
app.get("/api/creators/:creatorId/wallet", async (req: Request, res: Response) => {
  try {
    const creatorId = sanitizeText(req.params.creatorId, 100);
    if (!creatorId) {
      return res.status(400).json({ error: "creatorId is required" });
    }

    const [row] = await db
      .select()
      .from(schema.creatorsWallets)
      .where(eq(schema.creatorsWallets.creatorId, creatorId))
      .limit(1);

    if (!row) {
      return res.json({
        creatorId,
        walletAddress: null,
        preferredChain: "bsc",
        payoutEnabled: false,
      });
    }

    return res.json(row);
  } catch (err: any) {
    console.error("Error fetching creator wallet:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch creator wallet" });
  }
});

// 2. Update creator wallet (Protected with validation)
app.post("/api/creators/:creatorId/wallet", async (req: Request, res: Response) => {
  try {
    const creatorId = sanitizeText(req.params.creatorId, 100);
    const { walletAddress, preferredChain } = req.body;

    if (!creatorId) {
      return res.status(400).json({ error: "creatorId is required" });
    }

    if (!walletAddress || !EVM_ADDR_REGEX.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum/BSC hex wallet address" });
    }

    const chain = preferredChain && VALID_CHAINS.has(preferredChain) ? preferredChain : "bsc";
    const normalizedAddress = walletAddress.toLowerCase();

    const [existing] = await db
      .select()
      .from(schema.creatorsWallets)
      .where(eq(schema.creatorsWallets.creatorId, creatorId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.creatorsWallets)
        .set({
          walletAddress: normalizedAddress,
          preferredChain: chain,
          payoutEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.creatorsWallets.creatorId, creatorId))
        .returning();
      return res.json(updated);
    } else {
      const [inserted] = await db
        .insert(schema.creatorsWallets)
        .values({
          creatorId,
          walletAddress: normalizedAddress,
          preferredChain: chain,
          payoutEnabled: true,
        })
        .returning();
      return res.json(inserted);
    }
  } catch (err: any) {
    console.error("Error setting creator wallet:", err?.message || err);
    return res.status(500).json({ error: "Failed to set creator wallet" });
  }
});

// 3. Log a verified crypto transaction (tips, PPV, membership, superchat)
app.post("/api/monetization/log-tx", async (req: Request, res: Response) => {
  try {
    const {
      txHash,
      chain,
      fromAddress,
      toAddress,
      amount,
      tokenSymbol,
      usdEquivalent,
      transactionType,
      targetId,
    } = req.body;

    if (!txHash || !TX_HASH_REGEX.test(txHash)) {
      return res.status(400).json({ error: "Invalid transaction hash format" });
    }
    if (!fromAddress || !EVM_ADDR_REGEX.test(fromAddress)) {
      return res.status(400).json({ error: "Invalid sender wallet address" });
    }
    if (!toAddress || !EVM_ADDR_REGEX.test(toAddress)) {
      return res.status(400).json({ error: "Invalid recipient wallet address" });
    }
    if (!isValidAmount(amount)) {
      return res.status(400).json({ error: "Invalid transaction amount" });
    }

    const validatedChain = chain && VALID_CHAINS.has(chain) ? chain : "bsc";
    const validatedType = transactionType && VALID_TX_TYPES.has(transactionType) ? transactionType : "tip";
    const cleanSymbol = sanitizeText(tokenSymbol, 10).toUpperCase() || "BNB";

    const [record] = await db
      .insert(schema.cryptoTransactions)
      .values({
        txHash,
        chain: validatedChain,
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        amount: String(amount),
        tokenSymbol: cleanSymbol,
        usdEquivalent: usdEquivalent ? sanitizeText(usdEquivalent, 20) : null,
        transactionType: validatedType,
        targetId: targetId ? sanitizeText(targetId, 100) : null,
        status: "confirmed",
      })
      .onConflictDoNothing()
      .returning();

    return res.json(record || { success: true, txHash });
  } catch (err: any) {
    console.error("Error logging crypto transaction:", err?.message || err);
    return res.status(500).json({ error: "Failed to log crypto transaction" });
  }
});

// 4. Get transaction history
app.get("/api/monetization/transactions", async (req: Request, res: Response) => {
  try {
    const { creatorAddress, userAddress, limit = "50" } = req.query;
    const maxLimit = Math.min(parseInt(limit as string, 10) || 50, 100);

    let query = db
      .select()
      .from(schema.cryptoTransactions)
      .orderBy(desc(schema.cryptoTransactions.createdAt))
      .limit(maxLimit);

    if (creatorAddress && typeof creatorAddress === "string" && EVM_ADDR_REGEX.test(creatorAddress)) {
      query = query.where(
        eq(schema.cryptoTransactions.toAddress, creatorAddress.toLowerCase())
      ) as typeof query;
    } else if (userAddress && typeof userAddress === "string" && EVM_ADDR_REGEX.test(userAddress)) {
      query = query.where(
        eq(schema.cryptoTransactions.fromAddress, userAddress.toLowerCase())
      ) as typeof query;
    }

    const rows = await query;
    return res.json(rows);
  } catch (err: any) {
    console.error("Error querying transactions:", err?.message || err);
    return res.status(500).json({ error: "Failed to query transactions" });
  }
});

// 5. Pay-per-view unlock record
app.post("/api/monetization/ppv-unlock", async (req: Request, res: Response) => {
  try {
    const { videoId, userAddress, txHash, amountPaid, tokenSymbol, chain } = req.body;
    const cleanVideoId = sanitizeText(videoId, 100);

    if (!cleanVideoId) {
      return res.status(400).json({ error: "Valid videoId is required" });
    }
    if (!userAddress || !EVM_ADDR_REGEX.test(userAddress)) {
      return res.status(400).json({ error: "Valid userAddress is required" });
    }
    if (!txHash || !TX_HASH_REGEX.test(txHash)) {
      return res.status(400).json({ error: "Valid txHash is required" });
    }

    const validatedChain = chain && VALID_CHAINS.has(chain) ? chain : "bsc";
    const cleanSymbol = sanitizeText(tokenSymbol, 10).toUpperCase() || "BNB";

    const [record] = await db
      .insert(schema.videoUnlocks)
      .values({
        videoId: cleanVideoId,
        userAddress: userAddress.toLowerCase(),
        txHash,
        amountPaid: String(amountPaid || "0"),
        tokenSymbol: cleanSymbol,
        chain: validatedChain,
      })
      .returning();

    return res.json(record);
  } catch (err: any) {
    console.error("Error unlocking PPV video:", err?.message || err);
    return res.status(500).json({ error: "Failed to record PPV unlock" });
  }
});

// 6. Check if user unlocked a specific PPV video OR get user's unlocks if address provided
app.get("/api/monetization/ppv-unlocks/:identifier", async (req: Request, res: Response) => {
  try {
    const identifier = sanitizeText(req.params.identifier, 100);

    // If identifier is an EVM address, return all unlocks for this user
    if (EVM_ADDR_REGEX.test(identifier)) {
      const userAddress = identifier.toLowerCase();
      const rows = await db
        .select()
        .from(schema.videoUnlocks)
        .where(eq(schema.videoUnlocks.userAddress, userAddress));

      const videoIds = rows.map((r: any) => r.videoId);
      return res.json({
        success: true,
        count: videoIds.length,
        videoIds,
        unlocks: rows.map((r: any) => ({
          id: r.id,
          videoId: r.videoId,
          txHash: r.txHash,
          amountPaid: r.amountPaid,
          tokenSymbol: r.tokenSymbol,
          chain: r.chain,
          unlockedAt: r.createdAt,
        })),
      });
    }

    // Otherwise treat as videoId and check userAddress query
    const userAddress = req.query.userAddress as string | undefined;
    if (!userAddress || !EVM_ADDR_REGEX.test(userAddress)) {
      return res.json({ unlocked: false });
    }

    const rows = await db
      .select()
      .from(schema.videoUnlocks)
      .where(eq(schema.videoUnlocks.videoId, identifier));

    const isUnlocked = rows.some(
      (r: any) => r.userAddress.toLowerCase() === userAddress.toLowerCase()
    );

    return res.json({ unlocked: isUnlocked });
  } catch (err: any) {
    console.error("Error checking video unlock:", err?.message || err);
    return res.status(500).json({ error: "Failed to check unlock status" });
  }
});

// 7. Get all unlocked video IDs and records for a user address
app.get("/api/monetization/user-unlocks", async (req: Request, res: Response) => {
  try {
    const userAddress = req.query.userAddress as string | undefined;
    if (!userAddress || !EVM_ADDR_REGEX.test(userAddress)) {
      return res.json({ success: true, count: 0, videoIds: [], unlocks: [] });
    }

    const rows = await db
      .select()
      .from(schema.videoUnlocks)
      .where(eq(schema.videoUnlocks.userAddress, userAddress.toLowerCase()));

    const videoIds = rows.map((r: any) => r.videoId);
    return res.json({
      success: true,
      count: videoIds.length,
      videoIds,
      unlocks: rows.map((r: any) => ({
        id: r.id,
        videoId: r.videoId,
        txHash: r.txHash,
        amountPaid: r.amountPaid,
        tokenSymbol: r.tokenSymbol,
        chain: r.chain,
        unlockedAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    console.error("Error querying user unlocks:", err?.message || err);
    return res.status(500).json({ error: "Failed to query user unlocks" });
  }
});

// 8. Subscribe to Channel Membership
app.post("/api/monetization/membership", async (req: Request, res: Response) => {
  try {
    const { creatorId, subscriberAddress, tier, chain, txHash, amount, tokenSymbol } = req.body;
    const cleanCreatorId = sanitizeText(creatorId, 100);

    if (!cleanCreatorId) {
      return res.status(400).json({ error: "creatorId is required" });
    }
    if (!subscriberAddress || !EVM_ADDR_REGEX.test(subscriberAddress)) {
      return res.status(400).json({ error: "Valid subscriberAddress is required" });
    }
    if (!txHash || !TX_HASH_REGEX.test(txHash)) {
      return res.status(400).json({ error: "Valid txHash is required" });
    }

    const validatedTier = tier && VALID_TIERS.has(tier) ? tier : "bronze";
    const validatedChain = chain && VALID_CHAINS.has(chain) ? chain : "bsc";

    // 30 days expiration duration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [record] = await db
      .insert(schema.channelMemberships)
      .values({
        creatorId: cleanCreatorId,
        subscriberAddress: subscriberAddress.toLowerCase(),
        tier: validatedTier,
        chain: validatedChain,
        txHash,
        amount: String(amount || "0"),
        tokenSymbol: sanitizeText(tokenSymbol, 10).toUpperCase() || "BNB",
        expiresAt,
      })
      .returning();

    return res.json(record);
  } catch (err: any) {
    console.error("Error saving membership:", err?.message || err);
    return res.status(500).json({ error: "Failed to record channel membership" });
  }
});

// 9. Check active membership for a creator
app.get("/api/monetization/membership/:creatorId", async (req: Request, res: Response) => {
  try {
    const creatorId = sanitizeText(req.params.creatorId, 100);
    const subscriberAddress = req.query.subscriberAddress as string | undefined;

    if (!subscriberAddress || !EVM_ADDR_REGEX.test(subscriberAddress)) {
      return res.json({ isMember: false, tier: null });
    }

    const rows = await db
      .select()
      .from(schema.channelMemberships)
      .where(eq(schema.channelMemberships.creatorId, creatorId));

    const now = new Date();
    const active = rows.find(
      (r: any) =>
        r.subscriberAddress.toLowerCase() === subscriberAddress.toLowerCase() &&
        new Date(r.expiresAt) > now
    );

    if (active) {
      return res.json({
        isMember: true,
        tier: active.tier,
        expiresAt: active.expiresAt,
      });
    }

    return res.json({ isMember: false, tier: null });
  } catch (err: any) {
    console.error("Error checking membership:", err?.message || err);
    return res.status(500).json({ error: "Failed to check membership" });
  }
});

// 10. Get all active channel memberships for a subscriber
app.get("/api/monetization/user-memberships", async (req: Request, res: Response) => {
  try {
    const subscriberAddress = req.query.subscriberAddress as string | undefined;
    if (!subscriberAddress || !EVM_ADDR_REGEX.test(subscriberAddress)) {
      return res.json({ memberships: [] });
    }

    const rows = await db
      .select()
      .from(schema.channelMemberships)
      .where(eq(schema.channelMemberships.subscriberAddress, subscriberAddress.toLowerCase()));

    const now = new Date();
    const activeMemberships = rows.filter((r: any) => new Date(r.expiresAt) > now);

    return res.json({ memberships: activeMemberships });
  } catch (err: any) {
    console.error("Error querying user memberships:", err?.message || err);
    return res.status(500).json({ error: "Failed to query memberships" });
  }
});

// 11. SuperChat message creation
app.post("/api/monetization/superchat", async (req: Request, res: Response) => {
  try {
    const { streamId, senderAddress, amount, tokenSymbol, chain, txHash, message, colorTier } =
      req.body;
    const cleanStreamId = sanitizeText(streamId, 100);
    const cleanMsg = sanitizeText(message, 300);

    if (!cleanStreamId || !cleanMsg) {
      return res.status(400).json({ error: "streamId and message are required" });
    }
    if (!senderAddress || !EVM_ADDR_REGEX.test(senderAddress)) {
      return res.status(400).json({ error: "Valid senderAddress is required" });
    }
    if (!txHash || !TX_HASH_REGEX.test(txHash)) {
      return res.status(400).json({ error: "Valid txHash is required" });
    }

    const validatedColorTier = colorTier && VALID_COLOR_TIERS.has(colorTier) ? colorTier : "gold";
    const validatedChain = chain && VALID_CHAINS.has(chain) ? chain : "bsc";

    const [record] = await db
      .insert(schema.superchatMessages)
      .values({
        streamId: cleanStreamId,
        senderAddress: senderAddress.toLowerCase(),
        amount: String(amount || "0"),
        tokenSymbol: sanitizeText(tokenSymbol, 10).toUpperCase() || "BNB",
        chain: validatedChain,
        txHash,
        message: cleanMsg,
        colorTier: validatedColorTier,
      })
      .returning();

    return res.json(record);
  } catch (err: any) {
    console.error("Error recording superchat:", err?.message || err);
    return res.status(500).json({ error: "Failed to record superchat" });
  }
});

// 12. Fetch SuperChats for a stream
app.get("/api/monetization/superchats/:streamId", async (req: Request, res: Response) => {
  try {
    const streamId = sanitizeText(req.params.streamId, 100);
    const rows = await db
      .select()
      .from(schema.superchatMessages)
      .where(eq(schema.superchatMessages.streamId, streamId))
      .orderBy(desc(schema.superchatMessages.createdAt))
      .limit(50);

    return res.json(rows);
  } catch (err: any) {
    console.error("Error fetching superchats:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch superchats" });
  }
});

// 13. Creator revenue summary from Cloud SQL
app.get("/api/monetization/creator-stats/:creatorAddress", async (req: Request, res: Response) => {
  try {
    const creatorAddress = req.params.creatorAddress;
    if (!creatorAddress || !EVM_ADDR_REGEX.test(creatorAddress)) {
      return res.status(400).json({ error: "Valid creator address is required" });
    }
    const address = creatorAddress.toLowerCase();

    const txs = await db
      .select()
      .from(schema.cryptoTransactions)
      .where(eq(schema.cryptoTransactions.toAddress, address));

    let totalTips = 0;
    let totalPPV = 0;
    let totalMemberships = 0;
    let totalSuperChats = 0;

    txs.forEach((tx: any) => {
      const val = parseFloat(tx.amount) || 0;
      if (tx.transactionType === "tip") totalTips += val;
      else if (tx.transactionType === "ppv_unlock") totalPPV += val;
      else if (tx.transactionType === "membership") totalMemberships += val;
      else if (tx.transactionType === "superchat") totalSuperChats += val;
    });

    return res.json({
      address,
      transactionCount: txs.length,
      breakdown: {
        tips: totalTips.toFixed(4),
        ppv: totalPPV.toFixed(4),
        memberships: totalMemberships.toFixed(4),
        superchats: totalSuperChats.toFixed(4),
        total: (totalTips + totalPPV + totalMemberships + totalSuperChats).toFixed(4),
      },
      recentTransactions: txs.slice(0, 10),
    });
  } catch (err: any) {
    console.error("Error computing creator stats:", err?.message || err);
    return res.status(500).json({ error: "Failed to compute stats" });
  }
});

// 14. API 404 Catch-All for unknown /api routes (Express 5 compatible)
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Global Express Error Handler Middleware (Prevents crashes and stack trace leaks)
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error("Unhandled server error:", err?.message || err);
  const status = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 500;
  res.status(status).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : (err?.message || "Internal server error"),
  });
});

// Start Full-Stack Server
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(
      `OmniTube Pro Full-Stack Server active on port ${port} [Mode: ${isDev ? "Development" : "Production"}]`
    );
  });

  const handleTermination = (signal: string) => {
    console.log(`Received ${signal}, gracefully terminating OmniTube server...`);
    server.close(() => {
      console.log("OmniTube HTTP server safely closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => handleTermination("SIGTERM"));
  process.on("SIGINT", () => handleTermination("SIGINT"));
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

