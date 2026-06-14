import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { defaultOutputDir, loadSettings, saveSettings } from "../lib/settings";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [dir, setDir] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => setDir(s.outputDir));
  }, []);

  async function pick() {
    try {
      const p = await open({ directory: true, defaultPath: dir || undefined });
      if (p && !Array.isArray(p)) setDir(p);
    } catch {
      /* cancelled */
    }
  }

  async function reset() {
    setDir(await defaultOutputDir());
  }

  async function save() {
    setBusy(true);
    try {
      await saveSettings({ outputDir: dir });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop modal-backdrop--top" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("settings.title")}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>
        <div className="modal-body settings-body">
          <label className="field">
            <span>{t("settings.outputDir")}</span>
            <input
              type="text"
              className="settings-path"
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="settings-row">
            <button className="chip" onClick={pick}>
              {t("settings.choose")}
            </button>
            <button className="chip" onClick={reset}>
              {t("settings.reset")}
            </button>
          </div>
          <p className="settings-note">{t("settings.note")}</p>
        </div>
        <div className="modal-foot">
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !dir.trim()}>
            {t("settings.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
