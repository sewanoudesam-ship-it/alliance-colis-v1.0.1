type Props = {
  toast: { type: "success" | "danger"; text: string } | null;
};

/** Bandeau de confirmation/erreur discret, affiché en haut d'un écran après une action. */
export default function Toast({ toast }: Props) {
  if (!toast) return null;
  return (
    <div className={`ac-alert ac-alert--${toast.type} ac-mb-8`}>
      {toast.type === "success" ? "✅ " : "⚠️ "}
      {toast.text}
    </div>
  );
}
