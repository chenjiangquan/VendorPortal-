"use client";

import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const whatsappUrl = "https://wa.me/447521530350";

export function LiveChatButton() {
  const { t } = useI18n();

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      aria-label={t("help.liveChat")}
    >
      <MessageCircle className="h-5 w-5" />
      <span>{t("help.liveChat")}</span>
    </a>
  );
}
