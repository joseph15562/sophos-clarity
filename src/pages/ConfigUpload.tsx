import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, CheckCircle2, Shield, AlertTriangle, ChevronDown, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadStatus {
  status: "pending" | "uploaded" | "downloaded" | "expired";
  customer_name: string | null;
  expires_at: string;
  file_name: string | null;
}

type PageState = "loading" | "ready" | "uploading" | "success" | "already-uploaded" | "expired" | "not-found" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function fetchUploadStatus(token: string): Promise<UploadStatus | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api/config-upload/${token}`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (res.status === 410) return null;
  if (!res.ok) throw new Error(res.status === 404 ? "not-found" : "error");
  return res.json();
}

async function uploadFile(token: string, file: File): Promise<{ ok?: boolean; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/api/config-upload/${token}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Upload failed" };
  return { ok: true };
}

const ConfigUpload = () => {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [statusData, setStatusData] = useState<UploadStatus | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setPageState("not-found"); return; }
    let cancelled = false;
    fetchUploadStatus(token)
      .then((d) => {
        if (cancelled) return;
        if (!d) { setPageState("expired"); return; }
        setStatusData(d);
        if (d.status === "uploaded") setPageState("already-uploaded");
        else if (d.status === "downloaded") setPageState("already-uploaded");
        else setPageState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setPageState(e instanceof Error && e.message === "not-found" ? "not-found" : "error");
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleUpload = useCallback(async (file: File) => {
    if (!token) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setUploadError("Please select an XML file (.xml)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10 MB limit");
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
    setPageState("uploading");
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 300);

    try {
      const result = await uploadFile(token, file);
      clearInterval(progressInterval);
      if (result.error) {
        setUploadError(result.error);
        setPageState("ready");
        setUploadProgress(0);
      } else {
        setUploadProgress(100);
        setTimeout(() => setPageState("success"), 500);
      }
    } catch {
      clearInterval(progressInterval);
      setUploadError("Upload failed. Please try again.");
      setPageState("ready");
      setUploadProgress(0);
    }
  }, [token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (e.target) e.target.value = "";
  }, [handleUpload]);

  const handleReplace = useCallback(() => {
    setPageState("ready");
    setStatusData((d) => d ? { ...d, status: "pending" } : d);
  }, []);

  const expiresLabel = statusData?.expires_at
    ? new Date(statusData.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  // --- Render states ---

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <Shield className="h-8 w-8 text-[#00995a] animate-pulse mb-3" />
        <p className="text-white/60 text-sm">Loading…</p>
      </div>
    );
  }

  if (pageState === "not-found") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-white/30 mx-auto" />
          <h1 className="text-xl font-bold text-white">Upload link not found</h1>
          <p className="text-white/50 text-sm">This link is invalid or has been revoked. Please ask your Sophos SE for a new link.</p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-white/30 mx-auto" />
          <h1 className="text-xl font-bold text-white">This upload link has expired</h1>
          <p className="text-white/50 text-sm">Please ask your Sophos SE for a new upload link.</p>
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="h-10 w-10 text-white/30 mx-auto" />
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-white/50 text-sm">We couldn't load this page. Please try again or contact your Sophos SE.</p>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#00995a]/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[#00995a]" />
          </div>
          <h1 className="text-xl font-bold text-white">Configuration uploaded</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Your configuration has been securely uploaded. Your Sophos SE will review it shortly.
          </p>
          {selectedFile && (
            <p className="text-white/40 text-xs">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)</p>
          )}
        </div>
      </div>
    );
  }

  if (pageState === "already-uploaded") {
    return (
      <div className="min-h-screen bg-[#001A47] flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#00995a]/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[#00995a]" />
          </div>
          <h1 className="text-xl font-bold text-white">Configuration already uploaded</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            {statusData?.file_name && <>File <strong className="text-white/80">{statusData.file_name}</strong> was uploaded previously.</>}
            {!statusData?.file_name && "A configuration file has already been uploaded for this request."}
          </p>
          {statusData?.status !== "downloaded" && (
            <Button
              type="button"
              onClick={handleReplace}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Replace with a different file
            </Button>
          )}
          {statusData?.status === "downloaded" && (
            <p className="text-white/40 text-xs">Your SE has already downloaded this configuration. Please contact them if you need to send a new file.</p>
          )}
        </div>
      </div>
    );
  }

  // Ready / Uploading state
  return (
    <div className="min-h-screen bg-[#001A47] flex flex-col">
      {/* Header */}
      <div className="bg-[#001A47]/95 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5 opacity-70" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">
            Sophos Firewall Health Check
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-white">Upload Firewall Configuration</h1>
            {statusData?.customer_name && (
              <p className="text-white/50 text-sm">for {statusData.customer_name}</p>
            )}
            <p className="text-white/40 text-xs">Link expires {expiresLabel}</p>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "relative rounded-xl border-2 border-dashed transition-all duration-200 p-8",
              pageState === "uploading"
                ? "border-[#00995a]/50 bg-[#00995a]/5"
                : dragOver
                  ? "border-[#00995a] bg-[#00995a]/10"
                  : "border-white/20 hover:border-white/40 bg-white/5",
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {pageState === "uploading" ? (
              <div className="text-center space-y-4">
                <Upload className="h-8 w-8 text-[#00995a] mx-auto animate-pulse" />
                <p className="text-white/80 text-sm font-medium">Uploading…</p>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#00995a] h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-white/40 text-xs">{Math.round(uploadProgress)}%</p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <Upload className="h-8 w-8 text-white/40 mx-auto" />
                <div>
                  <p className="text-white/80 text-sm font-medium">
                    Drag and drop your <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">entities.xml</code> file here
                  </p>
                  <p className="text-white/40 text-xs mt-1">or</p>
                </div>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#00995a] hover:bg-[#00995a]/90 text-white gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <p className="text-white/30 text-xs">XML files only · Max 10 MB</p>
              </div>
            )}
          </div>

          {/* Upload error */}
          {uploadError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-300 text-sm">{uploadError}</p>
            </div>
          )}

          {/* How to export */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setHowToOpen(!howToOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-white/60 text-sm font-medium">How to export entities.xml from Sophos Firewall</span>
              <ChevronDown className={cn("h-4 w-4 text-white/40 transition-transform", howToOpen && "rotate-180")} />
            </button>
            {howToOpen && (
              <div className="px-4 pb-4 text-white/50 text-sm leading-relaxed border-t border-white/5 pt-3 space-y-2">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Log in to your Sophos Firewall web admin console</li>
                  <li>Navigate to <strong className="text-white/70">Backup &amp; firmware</strong></li>
                  <li>Click <strong className="text-white/70">Export</strong> to download the configuration</li>
                  <li>The downloaded file will be named <code className="bg-white/10 px-1 rounded text-xs">entities.xml</code></li>
                  <li>Upload that file using the drop zone above</li>
                </ol>
                <p className="text-white/30 text-xs mt-3">
                  If you&apos;re using Sophos Firewall OS v20+, go to <strong className="text-white/50">System &gt; Backup &amp; firmware &gt; Export config</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Privacy section */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#00995a]" />
              <span className="text-white/70 text-sm font-medium">Your data is secure</span>
            </div>
            <ul className="space-y-1.5 text-white/40 text-xs leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#00995a] mt-0.5">•</span>
                Your configuration file is encrypted in transit (TLS) and at rest
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00995a] mt-0.5">•</span>
                Files are automatically deleted 5 days after your Sophos SE downloads them
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00995a] mt-0.5">•</span>
                Your data is used solely for firewall health check analysis
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-[10px] text-white/25">
        Sophos Firewall Health Check · Powered by Sophos Clarity
      </div>
    </div>
  );
};

export default ConfigUpload;
