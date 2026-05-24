import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { optimiseProduct } from "@/lib/ai";

export async function POST(request: Request) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const body = await request.json();
  if (!body.product_id) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  try {
    const result = await optimiseProduct(body.product_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI optimisation failed." }, { status: 400 });
  }
}
