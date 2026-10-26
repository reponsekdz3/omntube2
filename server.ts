import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import * as schema from "./src/db/schema.ts";
import { desc, eq } from "drizzle-orm";

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 1. Get creator wallet
app.get("/api/creators/:creatorId/wallet", async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.params;
    const [row] = await db
      .select()
      .from(schema.creatorsWallets)
      .where(eq(schema.creatorsWallets.creatorId, creatorId))
      .limit(1);

    if (!row) {
      // Default fallback mock address if creator hasn't set one yet
      return res.json({
        creatorId,
        walletAddress: "0x71C8360555ab768A8F25F7c2A27a00C097e3D0b7",
        preferredChain: "bsc",
        payoutEnabled: true,
      });
    }

    return res.json(row);
  } catch (err: any) {
    console.error("Error fetching creator wallet:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch wallet" });
  }
});

// 2. Update creator wallet
app.post("/api/creators/:creatorId/wallet", async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.params;
    const { walletAddress, preferredChain } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const [existing] = await db
      .select()
      .from(schema.creatorsWallets)
      .where(eq(schema.creatorsWallets.creatorId, creatorId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(schema.creatorsWallets)
        .set({
          walletAddress,
          preferredChain: preferredChain || existing.preferredChain,
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
          walletAddress,
          preferredChain: preferredChain || "bsc",
          payoutEnabled: true,
        })
        .returning();
      return res.json(inserted);
    }
  } catch (err: any) {
    console.error("Error setting creator wallet:", err);
    return res.status(500).json({ error: err.message || "Failed to set wallet" });
  }
});

// 3. Log a crypto transaction (tips, PPV, membership, superchat)
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

    if (!txHash || !fromAddress || !toAddress || !amount || !tokenSymbol) {
      return res.status(400).json({ error: "Missing required transaction fields" });
    }

    const [record] = await db
      .insert(schema.cryptoTransactions)
      .values({
        txHash,
        chain: chain || "bsc",
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress.toLowerCase(),
        amount,
        tokenSymbol,
        usdEquivalent: usdEquivalent || null,
        transactionType: transactionType || "tip",
        targetId: targetId || null,
        status: "confirmed",
      })
      .onConflictDoNothing()
      .returning();

    return res.json(record || { success: true, txHash });
  } catch (err: any) {
    console.error("Error logging crypto transaction:", err);
    return res.status(500).json({ error: err.message || "Failed to log transaction" });
  }
});

// 4. Get transaction history
app.get("/api/monetization/transactions", async (req: Request, res: Response) => {
  try {
    const { creatorAddress, limit = "50" } = req.query;
    let query = db
      .select()
      .from(schema.cryptoTransactions)
      .orderBy(desc(schema.cryptoTransactions.createdAt))
      .limit(parseInt(limit as string, 10));

    if (creatorAddress) {
      query = query.where(
        eq(schema.cryptoTransactions.toAddress, (creatorAddress as string).toLowerCase())
      ) as typeof query;
    }

    const rows = await query;
    return res.json(rows);
  } catch (err: any) {
    console.error("Error querying transactions:", err);
    return res.status(500).json({ error: err.message || "Failed to query transactions" });
  }
});

// 5. Pay-per-view unlock record
app.post("/api/monetization/ppv-unlock", async (req: Request, res: Response) => {
  try {
    const { videoId, userAddress, txHash, amountPaid, tokenSymbol, chain } = req.body;
    if (!videoId || !userAddress || !txHash) {
      return res.status(400).json({ error: "Missing videoId, userAddress or txHash" });
    }

    const [record] = await db
      .insert(schema.videoUnlocks)
      .values({
        videoId,
        userAddress: userAddress.toLowerCase(),
        txHash,
        amountPaid: amountPaid || "0",
        tokenSymbol: tokenSymbol || "BNB",
        chain: chain || "bsc",
      })
      .returning();

    return res.json(record);
  } catch (err: any) {
    console.error("Error unlocking PPV video:", err);
    return res.status(500).json({ error: err.message || "Failed to unlock video" });
  }
});

// 6. Check if user unlocked a PPV video
app.get("/api/monetization/ppv-unlocks/:videoId", async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { userAddress } = req.query;

    if (!userAddress) {
      return res.json({ unlocked: false });
    }

    const rows = await db
      .select()
      .from(schema.videoUnlocks)
      .where(eq(schema.videoUnlocks.videoId, videoId));

    const isUnlocked = rows.some(
      (r) => r.userAddress.toLowerCase() === (userAddress as string).toLowerCase()
    );

    return res.json({ unlocked: isUnlocked });
  } catch (err: any) {
    console.error("Error checking video unlock:", err);
    return res.status(500).json({ error: err.message || "Failed to check unlock" });
  }
});

// 7. Subscribe to Channel Membership
app.post("/api/monetization/membership", async (req: Request, res: Response) => {
  try {
    const { creatorId, subscriberAddress, tier, chain, txHash, amount, tokenSymbol } = req.body;
    if (!creatorId || !subscriberAddress || !txHash) {
      return res.status(400).json({ error: "Missing required membership fields" });
    }

    // 30 days expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [record] = await db
      .insert(schema.channelMemberships)
      .values({
        creatorId,
        subscriberAddress: subscriberAddress.toLowerCase(),
        tier: tier || "bronze",
        chain: chain || "bsc",
        txHash,
        amount: amount || "0",
        tokenSymbol: tokenSymbol || "BNB",
        expiresAt,
      })
      .returning();

    return res.json(record);
  } catch (err: any) {
    console.error("Error saving membership:", err);
    return res.status(500).json({ error: err.message || "Failed to record membership" });
  }
});

// 8. SuperChat message creation
app.post("/api/monetization/superchat", async (req: Request, res: Response) => {
  try {
    const { streamId, senderAddress, amount, tokenSymbol, chain, txHash, message, colorTier } =
      req.body;

    if (!streamId || !senderAddress || !txHash || !message) {
      return res.status(400).json({ error: "Missing required superchat fields" });
    }

    const [record] = await db
      .insert(schema.superchatMessages)
      .values({
        streamId,
        senderAddress: senderAddress.toLowerCase(),
        amount,
        tokenSymbol,
        chain: chain || "bsc",
        txHash,
        message,
        colorTier: colorTier || "gold",
      })
      .returning();

    return res.json(record);
  } catch (err: any) {
    console.error("Error recording superchat:", err);
    return res.status(500).json({ error: err.message || "Failed to record superchat" });
  }
});

// 9. Fetch SuperChats for a stream
app.get("/api/monetization/superchats/:streamId", async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    const rows = await db
      .select()
      .from(schema.superchatMessages)
      .where(eq(schema.superchatMessages.streamId, streamId))
      .orderBy(desc(schema.superchatMessages.createdAt))
      .limit(50);

    return res.json(rows);
  } catch (err: any) {
    console.error("Error fetching superchats:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch superchats" });
  }
});

// 10. Creator revenue summary from Cloud SQL
app.get("/api/monetization/creator-stats/:creatorAddress", async (req: Request, res: Response) => {
  try {
    const { creatorAddress } = req.params;
    const address = creatorAddress.toLowerCase();

    const txs = await db
      .select()
      .from(schema.cryptoTransactions)
      .where(eq(schema.cryptoTransactions.toAddress, address));

    let totalTips = 0;
    let totalPPV = 0;
    let totalMemberships = 0;
    let totalSuperChats = 0;

    txs.forEach((tx) => {
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
    console.error("Error computing creator stats:", err);
    return res.status(500).json({ error: err.message || "Failed to compute stats" });
  }
});

// Mount Vite middleware in development
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (_req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`OmniTube Pro Full-Stack Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
