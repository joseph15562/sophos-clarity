import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  firewall?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-amber-500",
  error: "text-red-500",
};

export function LogViewer() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.electronAPI?.getLogs().then((entries: LogEntry[]) => setLogs(entries ?? []));

    const handler = (_event: unknown, entry: LogEntry) => {
      setLogs((prev) => [...prev.slice(-999), entry]);
    };
    window.electronAPI?.onLogEntry(handler);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [logs]);

  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.level !== filter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => navigate("/dashboard")} className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</button>
        <h1 className="text-sm font-bold text-foreground flex-1">Logs</h1>
        <div className="flex gap-1">
          {["all", "debug", "info", "warn", "error"].map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-1 rounded text-[10px] font-medium ${filter === level ? "bg-[#6B5BFF]/10 text-[#6B5BFF]" : "text-muted-foreground hover:bg-muted"}`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-40 rounded border border-border bg-background px-2 py-1 text-xs"
        />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-0.5">
        {filtered.map((entry, i) => (
          <div key={i} className={`${LEVEL_COLORS[entry.level] ?? ""} leading-relaxed`}>
            <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            {" "}
            <span className="font-semibold">{entry.level.toUpperCase().padEnd(5)}</span>
            {" "}
            {entry.firewall && <span className="text-[#6B5BFF]">[{entry.firewall}]</span>}
            {" "}
            {entry.message}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">No log entries</p>}
      </div>
    </div>
  );
}
