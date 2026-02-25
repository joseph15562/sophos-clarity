import { useCallback, useState } from "react";
import { Upload, FileText, X, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type UploadedFile = {
  id: string;
  fileName: string;
  label: string;
  content: string;
};

type Props = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
};

let fileIdCounter = 0;

export function FileUpload({ files, onFilesChange }: Props) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: UploadedFile[] = [];
      const promises: Promise<void>[] = [];

      Array.from(fileList).forEach((file) => {
        if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) return;
        promises.push(
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              newFiles.push({
                id: `file-${++fileIdCounter}`,
                fileName: file.name,
                label: file.name.replace(/\.(html|htm)$/i, ""),
                content: e.target?.result as string,
              });
              resolve();
            };
            reader.readAsText(file);
          })
        );
      });

      Promise.all(promises).then(() => {
        if (newFiles.length > 0) {
          onFilesChange([...files, ...newFiles]);
        }
      });
    },
    [files, onFilesChange]
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

  return (
    <div className="space-y-3">
      {/* File list */}
      {files.map((f) => (
        <Card key={f.id} className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <FileText className="h-8 w-8 text-primary shrink-0" />
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
                className="w-full bg-transparent border-b border-primary/30 focus:border-primary outline-none font-semibold text-foreground text-sm pb-0.5"
              />
              <p className="text-xs text-muted-foreground">{f.fileName}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={onBrowse}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-${files.length > 0 ? "6" : "12"} text-center transition-all ${
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        {files.length > 0 ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Add another firewall config</span>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground mb-1">
              Drop your Sophos Config HTML file(s) here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse • Accepts .html / .htm files • Multiple files supported
            </p>
          </>
        )}
      </div>
    </div>
  );
}
