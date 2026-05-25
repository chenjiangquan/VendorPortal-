export type ProductCategory = {
  id: string;
  name: string;
  fullName: string;
  shopifyTaxonomyId?: string;
  children?: ProductCategory[];
};

type RawProductCategory = Omit<ProductCategory, "fullName" | "children"> & { children?: RawProductCategory[] };

const furnitureChildren: RawProductCategory[] = [
  { id: "baby-toddler-furniture", name: "Baby & Toddler Furniture" },
  { id: "furniture-sets", name: "Furniture Sets" },
  { id: "futons", name: "Futons" },
  { id: "office-furniture", name: "Office Furniture", children: [
    { id: "desks", name: "Desks" },
    { id: "office-chairs", name: "Office Chairs" },
    { id: "filing-cabinets", name: "Filing Cabinets" }
  ] },
  { id: "office-furniture-accessories", name: "Office Furniture Accessories" },
  { id: "ottomans", name: "Ottomans" },
  { id: "outdoor-furniture", name: "Outdoor Furniture", children: [
    { id: "outdoor-chairs", name: "Outdoor Chairs" },
    { id: "outdoor-tables", name: "Outdoor Tables" },
    { id: "outdoor-sofas", name: "Outdoor Sofas" },
    { id: "patio-furniture-sets", name: "Patio Furniture Sets" }
  ] },
  { id: "outdoor-furniture-accessories", name: "Outdoor Furniture Accessories" },
  { id: "living-room-furniture", name: "Living Room Furniture", children: [
    { id: "sofas", name: "Sofas" },
    { id: "sofa-beds", name: "Sofa Beds" },
    { id: "armchairs", name: "Armchairs" },
    { id: "coffee-tables", name: "Coffee Tables" },
    { id: "tv-stands", name: "TV Stands" },
    { id: "side-tables", name: "Side Tables" }
  ] },
  { id: "bedroom-furniture", name: "Bedroom Furniture", children: [
    { id: "beds", name: "Beds" },
    { id: "bed-frames", name: "Bed Frames" },
    { id: "wardrobes", name: "Wardrobes" },
    { id: "dressers", name: "Dressers" },
    { id: "bedside-tables", name: "Bedside Tables" }
  ] },
  { id: "dining-room-furniture", name: "Dining Room Furniture", children: [
    { id: "dining-tables", name: "Dining Tables" },
    { id: "dining-chairs", name: "Dining Chairs" },
    { id: "bar-stools", name: "Bar Stools" },
    { id: "sideboards", name: "Sideboards" }
  ] },
  { id: "storage-furniture", name: "Storage Furniture", children: [
    { id: "shoe-cabinets", name: "Shoe Cabinets" },
    { id: "bookcases", name: "Bookcases" },
    { id: "cabinets", name: "Cabinets" },
    { id: "shelving-units", name: "Shelving Units" }
  ] }
];

export const shopifyFurnitureCategories: ProductCategory[] = withFullNames([{ id: "furniture", name: "Furniture", children: furnitureChildren }]);

export function flattenCategories(categories: ProductCategory[] = shopifyFurnitureCategories): ProductCategory[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

function withFullNames(categories: RawProductCategory[], parent = ""): ProductCategory[] {
  return categories.map((category) => {
    const fullName = parent ? `${parent} > ${category.name}` : category.name;
    return {
      ...category,
      fullName,
      children: category.children ? withFullNames(category.children, fullName) : undefined
    };
  });
}
