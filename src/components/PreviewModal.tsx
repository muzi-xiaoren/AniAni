import { useTranslation } from "react-i18next";

interface Props {
  url: string;
  width: number;
  height: number;
  saving: boolean;
  status?: { ok: boolean; text: string } | null;
  onSave: () => void;
  onClose: () => void;
}

export function PreviewModal({ url, width, height, saving, status, onSave, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("preview.title", { w: width, h: height })}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <img src={url} alt={t("preview.alt")} />
        </div>
        <div className="modal-foot">
          {status && (
            <span className={`save-msg ${status.ok ? "save-msg--ok" : "save-msg--err"}`} title={status.text}>
              {status.text}
            </span>
          )}
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
          <button className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? t("preview.saving") : t("preview.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
