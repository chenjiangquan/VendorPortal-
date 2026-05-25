import Link from "next/link";

export function Pagination({
  page,
  limit,
  total,
  basePath,
  params = {}
}: {
  page: number;
  limit: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-white p-4 text-sm shadow-sm">
      <span className="text-slate-500">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <Link href={pageHref(basePath, params, page - 1, limit)} className={`rounded-xl border border-line px-3 py-2 font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white hover:bg-panel"}`}>Previous</Link>
        <Link href={pageHref(basePath, params, page + 1, limit)} className={`rounded-xl border border-line px-3 py-2 font-semibold ${page >= totalPages ? "pointer-events-none opacity-40" : "bg-white hover:bg-panel"}`}>Next</Link>
      </div>
    </div>
  );
}

function pageHref(basePath: string, params: Record<string, string | undefined>, page: number, limit: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  search.set("page", String(Math.max(1, page)));
  search.set("limit", String(limit));
  return `${basePath}?${search.toString()}`;
}
