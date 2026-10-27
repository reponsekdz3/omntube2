import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};

// In-memory data store for AI Studio mock mode when Cloud SQL is offline
const memoryStore = new Map<any, any[]>();

memoryStore.set(schema.creatorsWallets, []);
memoryStore.set(schema.cryptoTransactions, []);
memoryStore.set(schema.videoUnlocks, []);
memoryStore.set(schema.channelMemberships, []);
memoryStore.set(schema.superchatMessages, []);
memoryStore.set(schema.sounds, []);
memoryStore.set(schema.creatorTiers, []);
memoryStore.set(schema.subscriptions, []);
memoryStore.set(schema.soundRoyalties, []);
memoryStore.set(schema.remixLineage, []);
memoryStore.set(schema.searchIndex, []);

function createMockSelect() {
  let targetTable: any = null;
  let filterFn: ((item: any) => boolean) | null = null;
  let orderDesc = false;
  let limitVal = Infinity;

  const builder: any = {
    from(table: any) {
      targetTable = table;
      return builder;
    },
    where(condition: any) {
      if (condition && condition.left && condition.right !== undefined) {
        const colName = condition.left.name;
        const val = condition.right;
        filterFn = (item) => {
          const itemVal = item[colName];
          if (typeof itemVal === "string" && typeof val === "string") {
            return itemVal.toLowerCase() === val.toLowerCase();
          }
          return itemVal === val;
        };
      }
      return builder;
    },
    orderBy(_orderCol: any) {
      orderDesc = true;
      return builder;
    },
    limit(n: number) {
      limitVal = n;
      return builder;
    },
    then(onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) {
      try {
        const rows = memoryStore.get(targetTable) || [];
        let result = filterFn ? rows.filter(filterFn) : [...rows];
        if (orderDesc) {
          result.sort((a, b) => {
            const timeA = a.createdAt?.getTime?.() || 0;
            const timeB = b.createdAt?.getTime?.() || 0;
            return timeB - timeA;
          });
        }
        if (limitVal < Infinity) {
          result = result.slice(0, limitVal);
        }
        return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
      } catch (e) {
        return Promise.reject(onrejected ? onrejected(e) : e);
      }
    },
  };
  return builder;
}

function createMockInsert(table: any) {
  let valuesToInsert: any = null;
  const builder: any = {
    values(vals: any) {
      valuesToInsert = Array.isArray(vals) ? vals : [vals];
      return builder;
    },
    onConflictDoNothing() {
      return builder;
    },
    returning() {
      return builder;
    },
    then(onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) {
      try {
        let rows = memoryStore.get(table);
        if (!rows) {
          rows = [];
          memoryStore.set(table, rows);
        }
        const created: any[] = [];
        for (const item of (valuesToInsert || [])) {
          const record = {
            id: rows.length + 1,
            ...item,
            createdAt: item.createdAt || new Date(),
            updatedAt: item.updatedAt || new Date(),
          };
          rows.push(record);
          created.push(record);
        }
        return Promise.resolve(onfulfilled ? onfulfilled(created) : created);
      } catch (e) {
        return Promise.reject(onrejected ? onrejected(e) : e);
      }
    },
  };
  return builder;
}

function createMockUpdate(table: any) {
  let updateData: any = {};
  let filterFn: ((item: any) => boolean) | null = null;
  const builder: any = {
    set(data: any) {
      updateData = data;
      return builder;
    },
    where(condition: any) {
      if (condition && condition.left && condition.right !== undefined) {
        const colName = condition.left.name;
        const val = condition.right;
        filterFn = (item) => {
          const itemVal = item[colName];
          if (typeof itemVal === "string" && typeof val === "string") {
            return itemVal.toLowerCase() === val.toLowerCase();
          }
          return itemVal === val;
        };
      }
      return builder;
    },
    returning() {
      return builder;
    },
    then(onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) {
      try {
        const rows = memoryStore.get(table) || [];
        const updated: any[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (!filterFn || filterFn(rows[i])) {
            rows[i] = { ...rows[i], ...updateData, updatedAt: new Date() };
            updated.push(rows[i]);
          }
        }
        return Promise.resolve(onfulfilled ? onfulfilled(updated) : updated);
      } catch (e) {
        return Promise.reject(onrejected ? onrejected(e) : e);
      }
    },
  };
  return builder;
}

let realDb: any;
if (process.env.SQL_HOST) {
  try {
    const pool = createPool();
    realDb = drizzle(pool, { schema });
  } catch {
    console.warn("[AI Studio] Database connection initialization failed — using mock");
  }
} else {
  console.warn("[AI Studio] Database not connected (SQL_HOST not configured) — using mock");
}

export const db: any = realDb || {
  select: () => createMockSelect(),
  insert: (table: any) => createMockInsert(table),
  update: (table: any) => createMockUpdate(table),
  query: new Proxy({}, {
    get: () => ({
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (d: any) => d?.data ?? {},
      update: async (d: any) => d?.data ?? {},
      delete: async () => ({}),
    }),
  }),
};
