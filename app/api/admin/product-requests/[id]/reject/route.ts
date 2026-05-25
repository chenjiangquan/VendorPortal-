import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/permissions";
import { rejectProductRequest } from "@/lib/product-request-actions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdminApi();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const adminNote = String(body.admin_note ?? "").trim();

  try {
    const data = await rejectProductRequest(ctx, id, adminNote);
    return NextResponse.json({ request: data, message: "Request rejected." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request rejection failed." }, { status: 400 });
  }
}
