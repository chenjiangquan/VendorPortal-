import { titleCaseText } from "@/lib/product-description";

const furnitureProductTypes = [
  "Sofa Bed",
  "Dining Table",
  "Dining Chair",
  "Coffee Table",
  "Side Table",
  "Bedside Table",
  "TV Stand",
  "Office Chair",
  "Office Desk",
  "Bar Stool",
  "Outdoor Sofa",
  "Outdoor Chair",
  "Outdoor Table",
  "Patio Furniture Set",
  "Furniture Set",
  "Shoe Cabinet",
  "Filing Cabinet",
  "Bookcase",
  "Shelving Unit",
  "Bed Frame",
  "Armchair",
  "Wardrobe",
  "Dresser",
  "Sideboard",
  "Cabinet",
  "Ottoman",
  "Futon",
  "Sofa",
  "Bed",
  "Chair",
  "Table",
  "Desk"
];

export function inferProductType(title?: string | null, category?: string | null) {
  const source = `${title ?? ""} ${category ?? ""}`.toLowerCase();
  const match = furnitureProductTypes.find((type) => {
    const pattern = new RegExp(`\\b${escapeRegExp(type.toLowerCase()).replaceAll("\\ ", "\\s+")}s?\\b`, "i");
    return pattern.test(source);
  });
  if (match) return match;

  const leafCategory = category?.split(">").pop()?.trim();
  if (!leafCategory) return "";
  return titleCaseText(singulariseFurnitureType(leafCategory));
}

function singulariseFurnitureType(value: string) {
  return value
    .replace(/\bSofas\b/i, "Sofa")
    .replace(/\bChairs\b/i, "Chair")
    .replace(/\bTables\b/i, "Table")
    .replace(/\bBeds\b/i, "Bed")
    .replace(/\bCabinets\b/i, "Cabinet")
    .replace(/\bBookcases\b/i, "Bookcase")
    .replace(/\bWardrobes\b/i, "Wardrobe")
    .replace(/\bDressers\b/i, "Dresser")
    .replace(/\bOttomans\b/i, "Ottoman")
    .replace(/\bFutons\b/i, "Futon")
    .replace(/\bSets\b/i, "Set");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
