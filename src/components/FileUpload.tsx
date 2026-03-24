import { useCallback, useState, useMemo } from "react";
import { X, Plus, FileText, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirewallLinkPicker, type FirewallLink } from "@/components/FirewallLinkPicker";

export type UploadedFile = {
  id: string;
  fileName: string;
  label: string;
  content: string;
  serialNumber?: string;
  agentHostname?: string;
  hardwareModel?: string;
  /** When "upload", do not auto-link to Central (manual upload may be a different firewall). */
  source?: "upload" | "agent";
};

type Props = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onFirewallLinked?: (configId: string, link: FirewallLink | null) => void;
};

let fileIdCounter = 0;

export function FileUpload({ files, onFilesChange, onFirewallLinked }: Props) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const readFile = (file: File): Promise<UploadedFile> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) =>
            resolve({
              id: `file-${++fileIdCounter}`,
              fileName: file.name,
              label: file.name.replace(/\.(html|htm)$/i, ""),
              content: e.target?.result as string,
            });
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

      const valid = Array.from(fileList).filter(
        (f) => f.name.endsWith(".html") || f.name.endsWith(".htm") || f.name.endsWith(".xml"),
      );

      Promise.all(valid.map(readFile)).then((parsed) => {
        if (parsed.length > 0) onFilesChange([...files, ...parsed]);
      });
    },
    [files, onFilesChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onBrowse = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm,.xml";
    input.multiple = true;
    input.onchange = (e) => {
      const fl = (e.target as HTMLInputElement).files;
      if (fl?.length) handleFiles(fl);
    };
    input.click();
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const fileHostnames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of files) {
      const match = f.content.match(/Host\s*Name\s*<\/td>\s*<td[^>]*>([^<]+)/i);
      map[f.id] = match?.[1]?.trim() ?? "";
    }
    return map;
  }, [files]);

  const fileHashes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of files) {
      if (!f.content) {
        map[f.id] = f.id;
        continue;
      }
      let hash = 0;
      const str = f.fileName + (f.content.length > 200 ? f.content.slice(0, 200) : f.content);
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      map[f.id] = Math.abs(hash).toString(36);
    }
    return map;
  }, [files]);

  return (
    <div className="space-y-3">
      {/* File list */}
      {files.map((f) => (
        <div
          key={f.id}
          className="relative overflow-hidden rounded-xl border border-[#2006F7]/25 dark:border-[#2006F7]/30 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] flex items-center gap-4 p-4 shadow-[0_10px_28px_rgba(32,6,247,0.10)]"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2006F7]/50 to-transparent" />
          <div className="h-10 w-10 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <input
              type="text"
              value={f.label}
              onChange={(e) => {
                const updated = files.map((file) =>
                  file.id === f.id ? { ...file, label: e.target.value } : file
                );
                onFilesChange(updated);
              }}
              placeholder="Firewall name (e.g. Sophos Firewall)"
              className="w-full bg-transparent border-b border-[#2006F7]/25 focus:border-[#2006F7] outline-none font-semibold tracking-tight text-foreground text-base pb-0.5"
            />
            <p className="text-xs font-medium text-foreground/80 dark:text-white/72">
              {f.serialNumber
                ? [f.hardwareModel, `S/N: ${f.serialNumber}`].filter(Boolean).join(" · ")
                : f.fileName}
            </p>
            <FirewallLinkPicker
              configId={f.id}
              configHostname={fileHostnames[f.id] || f.agentHostname || ""}
              configHash={fileHashes[f.id] ?? ""}
              configSerialNumber={f.serialNumber}
              disableAutoLink={f.source === "upload"}
              onLinked={(link) => onFirewallLinked?.(f.id, link)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove file"
            onClick={() => removeFile(f.id)}
            className="shrink-0 self-start text-foreground/55 hover:text-[#EA0022] hover:bg-[#EA0022]/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {files.length > 0 && (
        <p className="text-xs font-medium text-foreground/80 dark:text-white/70">
          Click on the <span className="text-[#2006F7] dark:text-[#00EDFF] font-semibold">config name</span> above to rename the firewall for the{" "}
          <span className="text-foreground dark:text-white font-semibold">report</span>.
        </p>
      )}

      {/* Drop zone */}
      <div
        data-tour="step-upload"
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={onBrowse}
        className={`cursor-pointer rounded-[28px] border-2 border-dashed text-center transition-all duration-200 shadow-[0_12px_35px_rgba(32,6,247,0.05)] ${
          files.length > 0 ? "p-5" : "p-10 sm:p-12"
        } ${
          dragActive
            ? "border-[#2006F7] bg-[#2006F7]/5 scale-[1.01]"
            : "border-border/60 dark:border-border bg-card/60 hover:border-[#2006F7]/40 hover:bg-[#2006F7]/[0.02] dark:hover:bg-[#2006F7]/[0.04]"
        }`}
      >
        {files.length > 0 ? (
          <div className="flex items-center justify-center gap-2.5 text-foreground/80 dark:text-white/75">
            <Plus className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
            <span className="text-sm font-semibold tracking-tight">Add another firewall config</span>
          </div>
        ) : (
          <>
            <div className="mx-auto h-20 w-20 rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_40%),linear-gradient(135deg,rgba(32,6,247,0.10),rgba(0,242,179,0.10))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.28),transparent_40%),linear-gradient(135deg,rgba(32,6,247,0.16),rgba(0,242,179,0.10))] flex items-center justify-center mb-5 shadow-sm">
              <Network className="h-9 w-9 text-[#2006F7] dark:text-[#00EDFF]" />
            </div>
            <p className="text-xl font-display font-black text-foreground mb-1 tracking-tight">
              Drop your Sophos firewall export here
            </p>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Upload HTML, HTM, or XML exports to generate deterministic findings, posture scoring, compliance mapping, and client-ready reports.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1">HTML / HTM / XML</span>
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1">Multiple files supported</span>
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1">Estate comparison ready</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
