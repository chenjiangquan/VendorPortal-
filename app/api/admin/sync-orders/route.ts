import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { syncShopifyOrders } from "@/lib/orders";

export async function POST() {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  try {
    const result = await syncShopifyOrders(30);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order sync failed." }, { status: 400 });
  }
}
