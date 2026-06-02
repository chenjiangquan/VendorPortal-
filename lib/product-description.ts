export type DescriptionDetailRow = {
  id: string;
  label: string;
  value: string;
  locked?: boolean;
};

export type DescriptionData = {
  overview: string[];
  details: DescriptionDetailRow[];
};

const requiredDetails: DescriptionDetailRow[] = [
  { id: "colour", label: "Colour", value: "", locked: true },
  { id: "material", label: "Material", value: "", locked: true },
  { id: "assembly", label: "Assembly", value: "", locked: true }
];

export function normaliseOverviewLines(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export function getDefaultDescriptionData(): DescriptionData {
  return {
    overview: [],
    details: requiredDetails.map((row) => ({ ...row }))
  };
}

export function normaliseDescriptionData(value: unknown): DescriptionData {
  const fallback = getDefaultDescriptionData();
  if (!value || typeof value !== "object") return fallback;
  const data = value as Partial<DescriptionData>;
  const overview = Array.isArray(data.overview) ? data.overview.map(String).map((line) => line.trim()).filter(Boolean) : [];
  const incomingDetails = Array.isArray(data.details) ? data.details : [];
  const customRows = incomingDetails
    .filter((row) => row && typeof row === "object")
    .map((row) => row as DescriptionDetailRow)
    .filter((row) => row.label && !requiredDetails.some((required) => required.label === row.label))
    .map((row, index) => ({
      id: String(row.id ?? `custom-${index}-${row.label}`).trim(),
      label: String(row.label).trim(),
      value: String(row.value ?? "").trim(),
      locked: Boolean(row.locked)
    }));

  return {
    overview,
    details: [
      ...requiredDetails.map((required) => {
        const match = incomingDetails.find((row) => row && typeof row === "object" && (row as DescriptionDetailRow).label === required.label) as DescriptionDetailRow | undefined;
        return { ...required, value: String(match?.value ?? "").trim() };
      }),
      ...customRows
    ]
  };
}

export function titleCaseText(value: string) {
  return value
    .trim()
    .replace(/[A-Za-z][A-Za-z'’-]*/g, (word) => {
      if (word.length > 1 && word === word.toUpperCase()) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .replace(/\s+/g, " ");
}

export function titleCaseRequiredDescriptionDetails(descriptionData: DescriptionData) {
  const requiredIds = new Set(requiredDetails.map((row) => row.id));
  const requiredLabels = new Set(requiredDetails.map((row) => row.label));
  return {
    ...descriptionData,
    details: descriptionData.details.map((row) => {
      const isRequired = requiredIds.has(row.id) || requiredLabels.has(row.label);
      return isRequired ? { ...row, value: titleCaseText(row.value) } : row;
    })
  };
}

export function buildDescriptionHtml(descriptionData?: unknown) {
  const data = normaliseDescriptionData(descriptionData);
  const overviewItems = data.overview.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const detailRows = data.details
    .filter((row) => row.label.trim() && row.value.trim())
    .map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`)
    .join("");

  const overviewHtml = overviewItems
    ? `<div class="seo-overview-section"><h2 class="seo-overview-title">Product Overview</h2><ul class="seo-overview-list">${overviewItems}</ul></div>`
    : "";
  const detailsHtml = detailRows
    ? `<div class="seo-details-section"><h2 class="seo-details-title">Details</h2><div class="seo-table-wrap"><table class="seo-product-details-table"><tbody>${detailRows}</tbody></table></div></div>`
    : "";
  const content = [overviewHtml, detailsHtml].filter(Boolean).join("");
  return content ? `<div class="seo-product-description">${content}</div>` : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
