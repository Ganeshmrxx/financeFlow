import { NextResponse } from "next/server";
import { kv, createClient } from "@vercel/kv";

const KV_KEY = "finance_transactions";

// If KV_URL is missing but REDIS_URL is present, we create a custom client
const storage = process.env.KV_URL 
  ? kv 
  : createClient({
      url: process.env.REDIS_URL || "",
      token: process.env.KV_REST_API_TOKEN || "", // Vercel KV token if using Upstash REST
    });

export async function GET(request: Request) {
  const userKey = request.headers.get("x-user-key");
  if (userKey !== process.env.USER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const transactions = await storage.get(KV_KEY) || [];
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
    // In a real app, you'd validate the body here
    await storage.set(KV_KEY, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("KV POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
