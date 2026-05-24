export type DescriptionDetailRow = {
  label: string;
  value: string;
  locked?: boolean;
};

export type DescriptionData = {
  overview: string[];
  details: DescriptionDetailRow[];
};

const requiredDetails: DescriptionDetailRow[] = [
  { label: "Colour", value: "", locked: true },
  { label: "Material", value: "", locked: true },
  { label: "Assembly", value: "", locked: true }
];

export function normaliseOverviewLines(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
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
    .map((row) => ({ label: String(row.label).trim(), value: String(row.value ?? "").trim(), locked: Boolean(row.locked) }));

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

export function buildDescriptionHtml(descriptionData?: unknown) {
  const data = normaliseDescriptionData(descriptionData);
  const overviewItems = data.overview.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const detailRows = data.details
    .filter((row) => row.label.trim() && row.value.trim())
    .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
    .join("");

  const overviewHtml = overviewItems ? `<h2>Product Overview</h2><ul>${overviewItems}</ul>` : "";
  const detailsHtml = detailRows ? `<h2>Details</h2><table><tbody>${detailRows}</tbody></table>` : "";
  return [overviewHtml, detailsHtml].filter(Boolean).join("\n\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
