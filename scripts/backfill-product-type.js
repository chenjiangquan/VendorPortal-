#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(process.cwd(), ".env.local");
loadEnvFile(envPath);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";

const PRODUCT_TYPE_RULES = [
  { type: "Outdoor Table", keywords: ["Outdoor Dining Table", "Garden Table", "Outdoor Table"] },
  { type: "Outdoor Chair", keywords: ["Outdoor Chair", "Garden Chair", "Outdoor Dining Chair", "Outdoor Lounge Chair"] },
  { type: "Outdoor Sofa", keywords: ["Outdoor Sofa", "Garden Sofa"] },
  { type: "Sofa Bed", keywords: ["Sofa Bed", "Sofa Beds"] },
  { type: "Sofa", keywords: ["Corner Sofa", "Sectional Sofa", "Modular Sofa", "Sofa", "Sofas"] },
  { type: "Dining Table", keywords: ["Dining Table", "Dining Tables", "Kitchen & Dining Tables", "Extending Dining Table"] },
  { type: "Dining Chair", keywords: ["Dining Chair", "Dining Chairs", "Kitchen & Dining Chairs"] },
  { type: "Coffee Table", keywords: ["Coffee Table", "Coffee Tables"] },
  { type: "Side Table", keywords: ["Side Table", "Side Tables", "End Table", "End Tables"] },
  { type: "Console Table", keywords: ["Console Table", "Console Tables"] },
  { type: "TV Unit", keywords: ["TV Unit", "TV Units", "TV Stand", "TV Stands", "Media Unit", "Media Units"] },
  { type: "Sideboard", keywords: ["Sideboard", "Sideboards", "Cabinet", "Cabinets", "Storage Cabinet"] },
  { type: "Armchair", keywords: ["Armchair", "Accent Chair", "Lounge Chair", "Sofa Chair", "Single Chair"] },
  { type: "Office Chair", keywords: ["Office Chair", "Desk Chair"] },
  { type: "Office Desk", keywords: ["Office Desk", "Desk", "Desks", "Computer Desk"] },
  { type: "Bed", keywords: ["Bed Frame", "Bed Frames", "Bed", "Beds"] },
  { type: "Dressing Table", keywords: ["Dressing Table", "Vanity Table", "Vanity Desk"] },
  { type: "Bench", keywords: ["Bench", "Benches"] },
  { type: "Stool", keywords: ["Bar Stool", "Bar Stools", "Counter Stool", "Counter Stools", "Stool", "Stools"] },
  { type: "Rug", keywords: ["Rug", "Rugs"] },
  { type: "Lighting", keywords: ["Lighting", "Lamp", "Lamps", "Pendant Light", "Pendant Lights", "Floor Lamp", "Table Lamp", "Wall Light"] },
  { type: "Decor", keywords: ["Decor", "Vase", "Vases", "Wall Art", "Mirror", "Mirrors", "Decoration"] }
];

const PRODUCTS_QUERY = `
query Products($cursor: String) {
  products(first: 100, after: $cursor, sortKey: ID) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      legacyResourceId
      handle
      title
      productType
      vendor
      collections(first: 50) {
        nodes {
          title
          handle
        }
      }
    }
  }
}`;

const PRODUCT_UPDATE = `
mutation ProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      productType
    }
    userErrors {
      field
      message
    }
  }
}`;

async function main() {
  assertEnv();

  const connection = await getShopifyConnection();
  const repairReportPath = process.argv[2] === "--repair-report" ? process.argv[3] : "";
  if (repairReportPath) {
    await repairFromReport(connection, repairReportPath);
    return;
  }

  const summary = {
    total_products_checked: 0,
    skipped_existing_product_type: 0,
    skipped_unclear: 0,
    updated_successfully: 0,
    update_failed: 0
  };
  const rows = [];

  let cursor = null;
  let page = 0;

  do {
    page += 1;
    const data = await shopifyGraphQL(connection, PRODUCTS_QUERY, { cursor });
    const products = data.products.nodes;
    console.log(`Fetched page ${page}: ${products.length} products`);

    for (const product of products) {
      summary.total_products_checked += 1;

      const collectionNames = product.collections.nodes.map((collection) => collection.title).filter(Boolean);
      const baseRow = {
        product_id: product.legacyResourceId || product.id,
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        collections: collectionNames.join(" | "),
        old_product_type: product.productType || "",
        new_product_type: "",
        matched_reason: "",
        status: "",
        error_message: ""
      };

      if (product.productType && product.productType.trim()) {
        summary.skipped_existing_product_type += 1;
        rows.push({ ...baseRow, status: "skipped_existing_product_type" });
        continue;
      }

      const match = inferProductType({
        collections: collectionNames,
        title: product.title
      });

      if (!match) {
        summary.skipped_unclear += 1;
        rows.push({ ...baseRow, status: "skipped_unclear" });
        console.log(`SKIP unclear: ${product.title}`);
        continue;
      }

      try {
        await updateProductType(connection, product.id, match.type);
        summary.updated_successfully += 1;
        rows.push({
          ...baseRow,
          new_product_type: match.type,
          matched_reason: match.reason,
          status: "updated"
        });
        console.log(`UPDATED: ${product.title} -> ${match.type} (${match.reason})`);
      } catch (error) {
        summary.update_failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        rows.push({
          ...baseRow,
          new_product_type: match.type,
          matched_reason: match.reason,
          status: "failed",
          error_message: message
        });
        console.error(`FAILED: ${product.title} -> ${match.type}: ${message}`);
      }
    }

    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);

  const reportPath = writeCsvReport(rows);
  console.log("");
  console.log("Summary");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`CSV report: ${reportPath}`);
}

function inferProductType({ collections, title }) {
  const titleMatch = matchRules(title);
  if (titleMatch) return { ...titleMatch, reason: `title keyword: ${titleMatch.keyword}` };

  const collectionSource = cleanCollectionNames(collections).join(" ");
  const collectionMatch = matchRules(collectionSource);
  if (collectionMatch) return { ...collectionMatch, reason: `collection keyword: ${collectionMatch.keyword}` };

  return null;
}

async function repairFromReport(connection, reportPath) {
  const absoluteReportPath = path.isAbsolute(reportPath) ? reportPath : path.join(process.cwd(), reportPath);
  const rows = parseCsv(fs.readFileSync(absoluteReportPath, "utf8"));
  const reportRows = [];
  const summary = {
    total_report_rows_checked: 0,
    skipped_not_updated_by_backfill: 0,
    skipped_unclear: 0,
    skipped_already_correct: 0,
    corrected_successfully: 0,
    correction_failed: 0
  };

  for (const row of rows) {
    summary.total_report_rows_checked += 1;
    if (row.status !== "updated") {
      summary.skipped_not_updated_by_backfill += 1;
      continue;
    }

    const collections = String(row.collections || "").split("|").map((item) => item.trim()).filter(Boolean);
    const match = inferProductType({ collections, title: row.title });
    const gid = String(row.product_id || "").startsWith("gid://shopify/Product/")
      ? row.product_id
      : `gid://shopify/Product/${row.product_id}`;

    if (!match) {
      try {
        await updateProductType(connection, gid, "");
        summary.skipped_unclear += 1;
        reportRows.push({ ...row, corrected_product_type: "", correction_reason: "no clear title or cleaned collection match; restored blank product type", correction_status: "cleared_unclear", correction_error: "" });
        console.log(`CLEARED UNCLEAR: ${row.title}`);
      } catch (error) {
        summary.correction_failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        reportRows.push({ ...row, corrected_product_type: "", correction_reason: "no clear title or cleaned collection match; attempted restore blank product type", correction_status: "failed", correction_error: message });
        console.error(`CLEAR FAILED: ${row.title}: ${message}`);
      }
      continue;
    }

    if (match.type === row.new_product_type) {
      summary.skipped_already_correct += 1;
      reportRows.push({ ...row, corrected_product_type: match.type, correction_reason: match.reason, correction_status: "skipped_already_correct", correction_error: "" });
      continue;
    }

    try {
      await updateProductType(connection, gid, match.type);
      summary.corrected_successfully += 1;
      reportRows.push({ ...row, corrected_product_type: match.type, correction_reason: match.reason, correction_status: "corrected", correction_error: "" });
      console.log(`CORRECTED: ${row.title} ${row.new_product_type} -> ${match.type} (${match.reason})`);
    } catch (error) {
      summary.correction_failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      reportRows.push({ ...row, corrected_product_type: match.type, correction_reason: match.reason, correction_status: "failed", correction_error: message });
      console.error(`CORRECTION FAILED: ${row.title}: ${message}`);
    }
  }

  const correctionReportPath = writeCsvReport(reportRows, "shopify-product-type-correction");
  console.log("");
  console.log("Correction summary");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Correction CSV report: ${correctionReportPath}`);
}

function matchRules(value) {
  const source = String(value || "").toLowerCase();
  if (!source.trim()) return null;

  for (const rule of PRODUCT_TYPE_RULES) {
    for (const keyword of rule.keywords) {
      if (source.includes(keyword.toLowerCase())) {
        return { type: rule.type, keyword };
      }
    }
  }

  return null;
}

function cleanCollectionNames(collections) {
  return collections.filter((name) => {
    const value = String(name || "").trim();
    if (!value) return false;
    if (/^(all|home page)$/i.test(value)) return false;
    if (/factory/i.test(value)) return false;
    return true;
  });
}

async function updateProductType(connection, productId, productType) {
  const data = await shopifyGraphQL(connection, PRODUCT_UPDATE, {
    input: {
      id: productId,
      productType
    }
  });

  const userErrors = data.productUpdate.userErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors.map((error) => `${(error.field || []).join(".")}: ${error.message}`).join("; "));
  }
}

async function getShopifyConnection() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "shopify_access_token").single();
  if (error) throw new Error(`Could not read Shopify OAuth token from Supabase app_settings: ${error.message}`);

  const value = data && data.value;
  if (!value || !value.access_token) {
    throw new Error("Shopify app is not connected. Please reconnect Shopify from Admin Settings.");
  }

  return {
    shop: value.shop || SHOPIFY_STORE_DOMAIN,
    accessToken: value.access_token
  };
}

async function shopifyGraphQL(connection, query, variables) {
  const response = await fetch(`https://${connection.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": connection.accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    const errors = json.errors?.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(errors);
  }

  return json.data;
}

function writeCsvReport(rows, prefix = "shopify-product-type-backfill") {
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportsDir, `${prefix}-${timestamp}.csv`);
  const fields = rows.some((row) => "correction_status" in row) ? [
    "product_id",
    "handle",
    "title",
    "vendor",
    "collections",
    "old_product_type",
    "new_product_type",
    "matched_reason",
    "status",
    "error_message",
    "corrected_product_type",
    "correction_reason",
    "correction_status",
    "correction_error"
  ] : [
    "product_id",
    "handle",
    "title",
    "vendor",
    "collections",
    "old_product_type",
    "new_product_type",
    "matched_reason",
    "status",
    "error_message"
  ];
  const csv = [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(","))
  ].join("\n");
  fs.writeFileSync(reportPath, `${csv}\n`, "utf8");
  return reportPath;
}

function parseCsv(text) {
  const rows = [];
  const records = [];
  let field = "";
  let record = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      field = "";
      record = [];
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }

  const headers = records.shift() || [];
  for (const values of records) {
    if (!values.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function assertEnv() {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
    ["SHOPIFY_STORE_DOMAIN", SHOPIFY_STORE_DOMAIN]
  ].filter(([, value]) => !value);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.map(([key]) => key).join(", ")}`);
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
