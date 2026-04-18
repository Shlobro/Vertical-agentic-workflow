import { Provider, PROVIDERS } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  open: boolean;
  toProvider: Provider;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProviderSwitchDialog({ open, toProvider, onConfirm, onCancel }: Props) {
  if (!open) return null;

  const toLabel = PROVIDERS.find((p) => p.id === toProvider)?.label ?? toProvider;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <img src={PROVIDER_ICONS[toProvider]} alt={toLabel} className="h-6 w-6 object-contain flex-shrink-0" />
          <h2 className="text-base font-semibold text-text-primary">Switch provider?</h2>
        </div>
        <p className="text-sm text-text-muted leading-relaxed mb-6">
          Switching providers mid-chat will mean we are sending the entire context of this chat to{" "}
          <span className="text-text-primary font-medium">{toLabel}</span>. Are you sure you want to proceed?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
          >
            Yes, switch
          </button>
        </div>
      </div>
    </div>
  );
}
