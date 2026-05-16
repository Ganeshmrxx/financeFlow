import { NextResponse } from "next/server";
import { kv, createClient } from "@vercel/kv";
import Redis from "ioredis";

const KV_KEY = "finance_transactions";

// Helper to get the right redis client
const getStorage = () => {
  const url = process.env.KV_URL || process.env.REDIS_URL || "";
  
  // If it's a standard redis:// or rediss:// URL, use ioredis
  if (url.startsWith("redis")) {
    return new Redis(url);
  }
  
  // Otherwise use @vercel/kv (for https:// urls)
  if (process.env.KV_URL) return kv;
  
  return createClient({
    url: process.env.REDIS_URL || "",
    token: process.env.KV_REST_API_TOKEN || "",
  });
};

const storage = getStorage();

export async function GET(request: Request) {
  const userKey = request.headers.get("x-user-key");
  if (userKey !== process.env.USER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let transactions;
    if (storage instanceof Redis) {
      const data = await storage.get(KV_KEY);
      transactions = data ? JSON.parse(data) : [];
    } else {
      transactions = await storage.get(KV_KEY) || [];
    }
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("KV GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userKey = request.headers.get("x-user-key");
  if (userKey !== process.env.USER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (storage instanceof Redis) {
      await storage.set(KV_KEY, JSON.stringify(body));
    } else {
      await storage.set(KV_KEY, body);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("KV POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
