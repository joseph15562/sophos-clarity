import { useState, useCallback } from "react";
import { X, Plus, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  zones: string[];
  onChange: (zones: string[]) => void;
}

const BUILTIN = ["Guest", "IoT", "BYOD", "RED", "Server", "DMZ", "VoIP", "Camera", "Printer"];

export function DpiExclusionBar({ zones, onChange }: Props) {
  const [input, setInput] = useState("");

  const addZone = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (zones.some((z) => z.toLowerCase() === lower)) {
      setInput("");
      return;
    }
    onChange([...zones, trimmed]);
    setInput("");
  }, [input, zones, onChange]);

  const removeZone = useCallback(
    (zone: string) => onChange(zones.filter((z) => z !== zone)),
    [zones, onChange],
  );

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldOff className="h-4 w-4 text-muted-foreground" />
        DPI Zone Exclusions
        <span className="text-[11px] text-muted-foreground font-normal">
          Zones where SSL/TLS certificate cannot be deployed (auto-excluded: {BUILTIN.join(", ")})
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {zones.map((z) => (
          <Badge
            key={z}
            variant="secondary"
            className="gap-1 pl-2 pr-1 py-0.5 text-xs"
          >
            {z}
            <button
              type="button"
              onClick={() => removeZone(z)}
              className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              aria-label={`Remove ${z}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            addZone();
          }}
        >
          <Input
            className="h-7 w-40 rounded-lg text-xs font-mono"
            placeholder="Zone name"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-7 px-2 rounded-lg"
            disabled={!input.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
