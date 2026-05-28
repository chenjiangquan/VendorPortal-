import { signOut } from "@/lib/auth";
import { TranslatedText } from "@/components/ui/TranslatedText";

export function Topbar({ title, role }: { title: string; role: string }) {
  const titleKey = title === "Products" ? "nav.products" : null;
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{role}</p>
          <h1 className="text-xl font-semibold text-ink">{titleKey ? <TranslatedText translationKey={titleKey} fallback={title} /> : title}</h1>
        </div>
        <form action={signOut}>
          <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-panel">
            <TranslatedText translationKey="common.signOut" fallback="Sign out" />
          </button>
        </form>
      </div>
    </header>
  );
}
