import { FilePlus2 } from "lucide-react";
import { CompanionFileName } from "../types";

interface Props {
  open: boolean;
  missingFiles: CompanionFileName[];
  selectedFiles: CompanionFileName[];
  onToggle: (fileName: CompanionFileName) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export default function MissingCompanionFilesDialog({
  open,
  missingFiles,
  selectedFiles,
  onToggle,
  onContinue,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#090910]/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-[linear-gradient(180deg,#1a1a27_0%,#141420_100%)] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-blue-400/30 bg-blue-400/12 p-2 text-blue-200">
            <FilePlus2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-text-primary">Missing repo instruction files</h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              Select which default files to create in the chosen project root before continuing.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {missingFiles.map((fileName) => {
            const checked = selectedFiles.includes(fileName);

            return (
              <label
                key={fileName}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface/70 px-3 py-3 text-sm text-text-primary transition-colors hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(fileName)}
                  aria-label={`Create ${fileName}`}
                  className="h-4 w-4 rounded border-border bg-surface"
                />
                <span className="font-medium">{fileName}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
