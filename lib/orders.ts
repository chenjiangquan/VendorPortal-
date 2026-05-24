import { createAdminClient } from "@/lib/supabase/admin";
import { shopifyGraphQL } from "@/lib/shopify";

const ORDERS_QUERY = `
query Orders($query: String!) {
  orders(first: 50, sortKey: CREATED_AT, reverse: true, query: $query) {
    nodes {
      id
      legacyResourceId
      name
      createdAt
      customer { email displayName }
      shippingAddress { name address1 address2 city province country zip phone }
      billingAddress { name address1 address2 city province country zip phone }
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 100) {
        nodes {
          id
          title
          quantity
          sku
          vendor
          originalUnitPriceSet { shopMoney { amount currencyCode } }
          product {
            id
            vendor
            tags
            metafield(namespace: "vendor_portal", key: "vendor_id") { value }
          }
          variant { id }
        }
      }
    }
  }
}`;

type ShopifyOrder = {
  id: string;
  legacyResourceId: string;
  name: string;
  createdAt: string;
  customer?: { email?: string; displayName?: string };
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  displayFinancialStatus?: string;
  displayFulfillmentStatus?: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: { nodes: ShopifyLineItem[] };
};

type ShopifyLineItem = {
  id: string;
  title: string;
  quantity: number;
  sku?: string;
  vendor?: string;
  originalUnitPriceSet: { shopMoney: { amount: string } };
  product?: { id: string; vendor?: string; tags?: string[]; metafield?: { value: string } | null };
  variant?: { id: string };
};

export async function syncShopifyOrders(daysBack = 30) {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const data = await shopifyGraphQL<{ orders: { nodes: ShopifyOrder[] } }>(ORDERS_QUERY, {
    query: `created_at:>=${since}`
  });

  const { data: vendors } = await supabase.from("vendors").select("*").eq("status", "active");
  const vendorRows = vendors ?? [];
  let orderCount = 0;
  let itemCount = 0;

  for (const order of data.orders.nodes) {
    const grouped = new Map<string, ShopifyLineItem[]>();
    for (const item of order.lineItems.nodes) {
      const vendorId = matchVendorId(item, vendorRows);
      if (!vendorId) continue;
      grouped.set(vendorId, [...(grouped.get(vendorId) ?? []), item]);
    }

    for (const [vendorId, items] of grouped) {
      const vendor = vendorRows.find((row) => row.id === vendorId);
      const vendorSubtotal = items.reduce(
        (sum, item) => sum + Number(item.originalUnitPriceSet.shopMoney.amount) * item.quantity,
        0
      );
      const commissionRate = Number(vendor?.commission_rate ?? 0);
      const commissionAmount = vendorSubtotal * (commissionRate / 100);
      const payoutAmount = vendorSubtotal - commissionAmount;

      const { data: vendorOrder } = await supabase
        .from("vendor_orders")
        .upsert(
          {
            vendor_id: vendorId,
            shopify_order_id: order.legacyResourceId,
            shopify_order_gid: order.id,
            shopify_order_name: order.name,
            customer_name: order.customer?.displayName,
            customer_email: order.customer?.email,
            shipping_address: order.shippingAddress ?? {},
            billing_address: order.billingAddress ?? {},
            total_price: Number(order.totalPriceSet.shopMoney.amount),
            vendor_subtotal: vendorSubtotal,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            payout_amount: payoutAmount,
            currency: order.totalPriceSet.shopMoney.currencyCode,
            financial_status: order.displayFinancialStatus,
            fulfillment_status: order.displayFulfillmentStatus,
            ordered_at: order.createdAt
          },
          { onConflict: "shopify_order_id,vendor_id" }
        )
        .select("id")
        .single();

      if (!vendorOrder) continue;
      orderCount += 1;
      await supabase.from("vendor_order_items").delete().eq("vendor_order_id", vendorOrder.id);
      await supabase.from("vendor_order_items").insert(
        items.map((item) => ({
          vendor_order_id: vendorOrder.id,
          vendor_id: vendorId,
          shopify_line_item_id: item.id,
          shopify_product_gid: item.product?.id,
          shopify_variant_gid: item.variant?.id,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          price: Number(item.originalUnitPriceSet.shopMoney.amount),
          total: Number(item.originalUnitPriceSet.shopMoney.amount) * item.quantity
        }))
      );
      itemCount += items.length;
    }
  }

  await supabase.from("activity_logs").insert({
    action: "shopify_orders_synced",
    entity_type: "vendor_orders",
    metadata: { daysBack, orderCount, itemCount }
  });

  return { orderCount, itemCount };
}

function matchVendorId(item: ShopifyLineItem, vendors: Record<string, any>[]) {
  const metafieldVendorId = item.product?.metafield?.value;
  if (metafieldVendorId && vendors.some((vendor) => vendor.id === metafieldVendorId)) return metafieldVendorId;

  const tagVendorId = item.product?.tags?.find((tag) => tag.startsWith("vendor_id:"))?.replace("vendor_id:", "");
  if (tagVendorId && vendors.some((vendor) => vendor.id === tagVendorId)) return tagVendorId;

  const shopifyVendor = item.vendor || item.product?.vendor;
  return vendors.find((vendor) => vendor.shopify_vendor_name && vendor.shopify_vendor_name === shopifyVendor)?.id;
}
