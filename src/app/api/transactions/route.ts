import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const KV_KEY = "finance_transactions";

export async function GET(request: Request) {
  const userKey = request.headers.get("x-user-key");
  if (userKey !== process.env.USER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const transactions = await kv.get(KV_KEY) || [];
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("KV GET Error:", error);
    return NextResponse.json([], { status: 500 });
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
    await kv.set(KV_KEY, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("KV POST Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
