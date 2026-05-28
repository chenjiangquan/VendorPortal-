"use client";

import { TranslationKey, useI18n } from "@/lib/i18n";

export function TranslatedText({ translationKey, fallback }: { translationKey: TranslationKey; fallback: string }) {
  const { t } = useI18n();
  return <>{t(translationKey) || fallback}</>;
}
