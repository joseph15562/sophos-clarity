import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  onFileLoaded: (content: string, fileName: string) => void;
};

export function FileUpload({ onFileLoaded }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileName(file.name);
        onFileLoaded(content, file.name);
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const onBrowse = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const clear = () => {
    setFileName(null);
    onFileLoaded("", "");
  };

  if (fileName) {
    return (
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-6">
          <FileText className="h-10 w-10 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{fileName}</p>
            <p className="text-sm text-muted-foreground">Ready to process</p>
          </div>
          <Button variant="ghost" size="icon" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      onClick={onBrowse}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
        dragActive
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-semibold text-foreground mb-1">
        Drop your Sophos Config HTML file here
      </p>
      <p className="text-sm text-muted-foreground">
        or click to browse • Accepts .html / .htm files
      </p>
    </div>
  );
}
