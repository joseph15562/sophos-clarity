import { useCallback, useState, useMemo } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirewallLinkPicker, type FirewallLink } from "@/components/FirewallLinkPicker";

export type UploadedFile = {
  id: string;
  fileName: string;
  label: string;
  content: string;
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
        (f) => f.name.endsWith(".html") || f.name.endsWith(".htm"),
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
    input.accept = ".html,.htm";
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
        <div key={f.id} className="rounded-xl border border-[#2006F7]/25 dark:border-[#2006F7]/30 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] flex items-center gap-4 p-4">
          <div className="h-10 w-10 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0">
            <img src="/icons/sophos-document.svg" alt="" className="h-5 w-5 sophos-icon" />
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
              className="w-full bg-transparent border-b border-[#2006F7]/25 focus:border-[#2006F7] outline-none font-bold text-foreground text-sm pb-0.5"
            />
            <p className="text-[11px] text-muted-foreground">{f.fileName}</p>
            <FirewallLinkPicker
              configId={f.id}
              configHostname={fileHostnames[f.id] ?? ""}
              configHash={fileHashes[f.id] ?? ""}
              onLinked={(link) => onFirewallLinked?.(f.id, link)}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)} className="shrink-0 opacity-50 hover:opacity-100 self-start">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {files.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Click on the config name above to rename the firewall for the report.
        </p>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={onBrowse}
        className={`cursor-pointer rounded-xl border-2 border-dashed text-center transition-all duration-200 ${
          files.length > 0 ? "p-5" : "p-10"
        } ${
          dragActive
            ? "border-[#2006F7] bg-[#2006F7]/5 scale-[1.01]"
            : "border-border/60 dark:border-border hover:border-[#2006F7]/40 hover:bg-[#2006F7]/[0.02] dark:hover:bg-[#2006F7]/[0.04]"
        }`}
      >
        {files.length > 0 ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Add another firewall config</span>
          </div>
        ) : (
          <>
            <div className="mx-auto h-16 w-16 rounded-2xl bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center mb-4">
              <img src="/icons/sophos-network.svg" alt="" className="h-8 w-8 sophos-icon" />
            </div>
            <p className="text-base font-display font-bold text-foreground mb-1">
              Drop your Sophos Config HTML file(s) here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse &middot; Accepts .html / .htm &middot; Multiple files supported
            </p>
          </>
        )}
      </div>
    </div>
  );
}
