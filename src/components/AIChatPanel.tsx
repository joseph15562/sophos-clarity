import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MessageCircle, X, Send, Loader2, Trash2, FileText } from "lucide-react";
import { streamChat } from "@/lib/stream-ai";
import type { AnalysisResult } from "@/lib/analyse-config";
import { marked } from "marked";
import { SafeHtml } from "@/components/SafeHtml";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { getRouteAssistConfig, normalizeAssistPath } from "@/lib/assist-route-context";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  reports: { id: string; label: string; markdown: string }[];
  customerName?: string;
  environment?: string;
  analysisTab?: string;
  /** Current path for hub-mode suggestions, storage scoping, and system context (default "/"). */
  assistPathname?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const STORAGE_PREFIX = "firecomply_chat_";

function getCustomerHash(
  customerName?: string,
  environment?: string,
  analysisResults?: Record<string, AnalysisResult>,
  routeKey?: string,
): string {
  const parts: string[] = [];
  if (customerName) parts.push(customerName);
  if (environment) parts.push(environment);
  if (analysisResults && Object.keys(analysisResults).length > 0) {
    parts.push(Object.keys(analysisResults).sort().join(","));
  } else if (routeKey) {
    parts.push(`route:${routeKey}`);
  }
  const str = parts.join("|") || "default";
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36);
}

function getStorageKey(customerHash: string): string {
  return `${STORAGE_PREFIX}${customerHash}`;
}

interface StoredChat {
  messages: ChatMessage[];
  lastActive: number;
}

function formatLastActive(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

const EXECUTIVE_SUMMARY_PROMPT =
  "Generate a 3-paragraph executive summary of the firewall security assessment in plain English. Cover the overall security posture, the most important risks, and recommended next steps.";

const TAB_SUGGESTIONS: Record<string, string[]> = {
  overview: ["What's my overall security posture?", "What are the top priorities?"],
  security: ["Which rules need IPS enabled?", "How do I improve web filtering coverage?"],
  compliance: [
    "Which compliance frameworks have the most gaps?",
    "How do I improve my PCI DSS score?",
  ],
  optimisation: ["What rules can be consolidated?", "How do I reduce my attack surface?"],
  remediation: ["What should I fix first?", "How long will remediation take?"],
};

function getSuggestedQuestions(
  analysisResults: Record<string, AnalysisResult>,
  analysisTab: string | undefined,
  hubSuggestions: string[],
  hasAssessmentData: boolean,
): string[] {
  if (!hasAssessmentData) {
    return hubSuggestions.slice(0, 4);
  }

  const tabQuestions = analysisTab ? TAB_SUGGESTIONS[analysisTab] : [];
  const questions: string[] = [...(tabQuestions ?? [])];

  let hasCritical = false;
  let webFilteringLow = false;
  let mfaDisabled = false;

  for (const result of Object.values(analysisResults)) {
    for (const f of result.findings) {
      if (f.severity === "critical") hasCritical = true;
      if (/mfa|otp|multi.?factor/i.test(f.title)) mfaDisabled = true;
    }
    if (result.inspectionPosture?.withoutWebFilter > 0) webFilteringLow = true;
  }

  if (hasCritical && !questions.some((q) => q.toLowerCase().includes("critical")))
    questions.push("What are the most critical security issues?");
  if (webFilteringLow && !questions.some((q) => q.toLowerCase().includes("web filter")))
    questions.push("How do I enable web filtering on my Sophos XGS?");
  if (mfaDisabled && !questions.some((q) => q.toLowerCase().includes("mfa")))
    questions.push("How do I configure MFA/OTP on Sophos Firewall?");
  if (!questions.some((q) => q.toLowerCase().includes("summary")))
    questions.push("Give me a plain-English summary of this assessment");

  return questions.slice(0, 4);
}

export function AIChatPanel({
  analysisResults,
  reports,
  customerName,
  environment,
  analysisTab,
  assistPathname = "/",
  open: controlledOpen,
  onOpenChange,
  initialMessage,
  onInitialMessageSent,
}: Props) {
  const pathKey = normalizeAssistPath(assistPathname);
  const hasAssessmentData = Object.keys(analysisResults).length > 0;
  const routeAssist = useMemo(() => getRouteAssistConfig(pathKey), [pathKey]);

  const customerHash = useMemo(
    () =>
      getCustomerHash(
        customerName,
        environment,
        analysisResults,
        hasAssessmentData ? undefined : pathKey,
      ),
    [customerName, environment, analysisResults, hasAssessmentData, pathKey],
  );
  const storageKey = useMemo(() => getStorageKey(customerHash), [customerHash]);

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = useCallback(
    (value: boolean) => {
      if (isControlled) onOpenChange?.(value);
      else setInternalOpen(value);
    },
    [isControlled, onOpenChange],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastActive, setLastActive] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestedQuestions = useMemo(
    () =>
      getSuggestedQuestions(
        analysisResults,
        analysisTab,
        routeAssist.suggestions,
        hasAssessmentData,
      ),
    [analysisResults, analysisTab, routeAssist.suggestions, hasAssessmentData],
  );

  const didLoadFromStorage = useRef(false);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: StoredChat = JSON.parse(raw);
        if (parsed.messages?.length) {
          setMessages(parsed.messages);
          setLastActive(parsed.lastActive ?? null);
          didLoadFromStorage.current = true;
        }
      }
    } catch (e) {
      warnOptionalError("AIChatPanel.loadStorage", e);
    }
  }, [storageKey]);

  // Save messages to localStorage whenever they change (skip right after load)
  useEffect(() => {
    if (messages.length === 0) return;
    if (didLoadFromStorage.current) {
      didLoadFromStorage.current = false;
      return;
    }
    try {
      const stored: StoredChat = {
        messages,
        lastActive: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(stored));
      setLastActive(stored.lastActive);
    } catch (e) {
      warnOptionalError("AIChatPanel.saveStorage", e);
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const lastSentInitial = useRef<string | null>(null);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setLastActive(null);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      warnOptionalError("AIChatPanel.clearStorage", e);
    }
  }, [storageKey]);

  const buildContext = useCallback(() => {
    if (!hasAssessmentData) {
      return `CONTEXT: Sophos FireComply — ${routeAssist.title} (${pathKey})
${routeAssist.blurb}

No firewall configuration analysis is loaded in this chat session. Answer from product and general security practice knowledge only; do not invent specific findings or rule counts.`;
    }

    const findings = Object.entries(analysisResults)
      .flatMap(([label, r]) =>
        r.findings.map((f) => `[${label}] ${f.severity}: ${f.title} — ${f.detail}`),
      )
      .join("\n");

    const stats = Object.entries(analysisResults)
      .map(
        ([label, r]) =>
          `${label}: ${r.stats.totalRules} rules, ${r.findings.length} findings, WAN rules: ${r.inspectionPosture.totalWanRules}`,
      )
      .join("\n");

    const reportSummary = reports
      .map((r) => `Report: ${r.label} (${r.markdown.length} chars)`)
      .join("\n");

    return `CONTEXT: Sophos FireComply assessment data.
${customerName ? `Customer: ${customerName}` : ""}
${environment ? `Environment: ${environment}` : ""}

FIREWALL STATS:
${stats}

DETERMINISTIC FINDINGS:
${findings}

GENERATED REPORTS:
${reportSummary}`;
  }, [
    hasAssessmentData,
    routeAssist.title,
    routeAssist.blurb,
    pathKey,
    analysisResults,
    reports,
    customerName,
    environment,
  ]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);

      const assistantId = `msg-${Date.now() + 1}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
      ]);

      const context = buildContext();
      const conversationHistory = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const chatContext = `${context}\n\nCONVERSATION HISTORY:\n${conversationHistory}\n\nUSER QUESTION:\n${text.trim()}`;

      try {
        await streamChat({
          chatContext,
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
            );
          },
          onDone: () => setIsStreaming(false),
          onError: (error) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${error}` } : m)),
            );
            setIsStreaming(false);
          },
        });
      } catch (err) {
        console.warn("[sendMessage]", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Failed to connect to AI service." } : m,
          ),
        );
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, buildContext],
  );

  // When opened with initialMessage, send it and notify parent
  useEffect(() => {
    if (!isOpen || !initialMessage?.trim() || isStreaming) return;
    if (lastSentInitial.current === initialMessage) return;
    lastSentInitial.current = initialMessage;
    sendMessage(initialMessage.trim());
    onInitialMessageSent?.();
  }, [isOpen, initialMessage, isStreaming, sendMessage, onInitialMessageSent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          data-tour="ai-chat-trigger"
          onClick={() => setIsOpen(true)}
          className="no-print fixed bottom-40 right-6 z-50 h-12 w-12 rounded-full bg-[#2006F7] text-white shadow-lg hover:bg-[#10037C] transition-colors flex items-center justify-center group"
          aria-label="Open AI chat assistant"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#00F2B3] ring-2 ring-background" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="no-print fixed bottom-40 right-6 z-50 w-[380px] max-h-[600px] rounded-2xl border border-border/50 bg-card shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#001A47] text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">
                {hasAssessmentData ? "AI Assessment Assistant" : "AI Assistant"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => sendMessage(EXECUTIVE_SUMMARY_PROMPT)}
                disabled={isStreaming || !hasAssessmentData}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors text-xs disabled:opacity-50"
                aria-label="Generate executive summary"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Generate Summary</span>
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  aria-label="Clear conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Previous conversation indicator */}
          {messages.length > 0 && lastActive != null && (
            <div className="px-4 py-1.5 border-b border-border bg-muted/30 text-[10px] text-muted-foreground">
              Previous conversation · Last active {formatLastActive(lastActive)}
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[420px]"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  {hasAssessmentData
                    ? "Ask questions about your firewall assessment. The AI has full context of your analysis results and reports."
                    : `Ask about ${routeAssist.title}. Answers use product knowledge for this page — load an assessment for config-specific findings.`}
                </p>
                <div className="space-y-1.5">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#2006F7] text-white"
                      : "bg-muted/50 text-foreground border border-border"
                  }`}
                >
                  {msg.role === "assistant" && msg.content ? (
                    <SafeHtml
                      className="prose prose-xs dark:prose-invert max-w-none [&_p]:text-xs [&_p]:my-1 [&_ul]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px]"
                      html={marked.parse(msg.content, { async: false }) as string}
                    />
                  ) : msg.role === "assistant" && !msg.content && isStreaming ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Thinking…</span>
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasAssessmentData ? "Ask about your assessment…" : "Ask about this page…"
                }
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 min-h-[36px] max-h-[80px]"
                disabled={isStreaming}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isStreaming || !input.trim()}
                aria-label="Send message"
                className="h-9 w-9 rounded-lg bg-[#2006F7] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#10037C] transition-colors shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
