import { z } from "zod";

export const vendorCreateSchema = z.object({
  company_name: z.string().min(2),
  contact_name: z.string().min(2),
  email: z.string().email(),
  temporary_password: z.string().min(10),
  phone: z.string().optional().nullable(),
  country: z.string().default("United Kingdom"),
  city: z.string().optional().nullable(),
  shopify_vendor_name: z.string().optional().nullable(),
  commission_rate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable()
});

export const productDraftSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  description_data: z.unknown().optional().nullable(),
  product_type: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  price: z.coerce.number().positive(),
  compare_at_price: z.coerce.number().optional().nullable(),
  cost_price: z.coerce.number().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  stock: z.coerce.number().int().min(0).default(0),
  material: z.string().optional().nullable(),
  colour: z.string().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  weight: z.string().optional().nullable(),
  lead_time: z.string().optional().nullable(),
  shipping_note: z.string().optional().nullable(),
  care_instruction: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  google_product_category: z.string().optional().nullable(),
  has_variants: z.coerce.boolean().optional().default(false),
  options: z.unknown().optional().nullable(),
  variants: z.array(z.object({
    option1_name: z.string().optional().nullable(),
    option1_value: z.string().optional().nullable(),
    option2_name: z.string().optional().nullable(),
    option2_value: z.string().optional().nullable(),
    option3_name: z.string().optional().nullable(),
    option3_value: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    price: z.coerce.number().optional().nullable(),
    compare_at_price: z.coerce.number().optional().nullable(),
    stock: z.coerce.number().int().min(0).optional().nullable()
  })).optional(),
  pending_images: z.array(z.object({
    url: z.string().url(),
    storage_path: z.string(),
    alt_text: z.string().optional().nullable(),
    position: z.coerce.number().int().min(0).optional()
  })).optional()
});

export const productSubmitSchema = productDraftSchema.extend({
  description: z.string().min(10),
  image_count: z.coerce.number().min(1).max(12)
});

export const trackingSchema = z.object({
  vendor_order_id: z.string().uuid(),
  carrier: z.string().min(2),
  tracking_number: z.string().min(2),
  tracking_url: z.string().url().optional().or(z.literal("")).nullable(),
  note: z.string().optional().nullable()
});

export const trackingRejectSchema = z.object({
  admin_note: z.string().min(2)
});

export const productRejectSchema = z.object({
  rejection_reason: z.string().optional().nullable().default("")
});
