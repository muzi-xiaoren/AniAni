import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CJK_FONTS, downloadCjkFont, removeCjkFont, useInstalledCjkFonts } from "../lib/fontStore";

export function FontManager({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const installed = useInstalledCjkFonts();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function run(id: string, action: () => Promise<void>) {
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      await action();
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  return (
    <div className="modal-backdrop modal-backdrop--top" onClick={onClose}>
      <div className="modal font-manager" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("fontMgr.title")}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>
        <div className="font-list">
          {CJK_FONTS.map((f) => {
            const isInstalled = installed.includes(f.id);
            const isBusy = !!busy[f.id];
            return (
              <div className="font-row" key={f.id}>
                <div className="font-info">
                  <span className="font-label" style={isInstalled ? { fontFamily: `"${f.family}"` } : undefined}>
                    {f.label}
                  </span>
                  <span className="font-size-tag">{f.sizeMB} MB</span>
                  {errors[f.id] && <span className="font-error">{errors[f.id]}</span>}
                </div>
                {isInstalled ? (
                  <button className="chip chip--x" disabled={isBusy} onClick={() => run(f.id, () => removeCjkFont(f.id))}>
                    {isBusy ? "…" : t("common.delete")}
                  </button>
                ) : (
                  <button className="chip" disabled={isBusy} onClick={() => run(f.id, () => downloadCjkFont(f.id))}>
                    {isBusy ? t("fontMgr.downloading") : t("fontMgr.download")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-foot">
          <span className="meta">{t("fontMgr.note")}</span>
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
