import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { streamConfigParse } from "@/lib/stream-ai";
import type { ExtractedSections } from "@/lib/extract-sections";
import type { AnalysisResult } from "@/lib/analyse-config";
import DOMPurify from "dompurify";
import { marked } from "marked";

interface Props {
  sections: ExtractedSections;
  analysisResults: Record<string, AnalysisResult>;
  reports: { id: string; label: string; markdown: string }[];
  customerName?: string;
  environment?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const SUGGESTED_QUESTIONS = [
  "What are the highest priority issues to fix first?",
  "Summarise the security posture in one paragraph",
  "Which rules are most permissive and why is that risky?",
  "What quick wins could improve the score the most?",
  "Are there any compliance gaps for Cyber Essentials?",
];

export function AIChatPanel({ sections, analysisResults, reports, customerName, environment }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const buildContext = useCallback(() => {
    const findings = Object.entries(analysisResults)
      .flatMap(([label, r]) => r.findings.map((f) => `[${label}] ${f.severity}: ${f.title} — ${f.detail}`))
      .join("\n");

    const stats = Object.entries(analysisResults)
      .map(([label, r]) => `${label}: ${r.stats.totalRules} rules, ${r.findings.length} findings, WAN rules: ${r.inspectionPosture.totalWanRules}`)
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
  }, [analysisResults, reports, customerName, environment]);

  const sendMessage = useCallback(async (text: string) => {
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
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: Date.now() }]);

    const context = buildContext();
    const conversationHistory = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const enrichedSections: ExtractedSections = {
      ...sections,
      __chat_context: [{
        header: "Chat Context",
        rows: [{
          "System Prompt": `You are a Sophos firewall security expert assistant. The user has uploaded firewall config(s) and you have access to the analysis results. Answer questions helpfully, cite specific rules/findings when possible. Be concise but thorough. Use markdown formatting.`,
          "Context": context,
          "Conversation History": conversationHistory,
          "User Question": text.trim(),
        }],
      }],
    };

    try {
      await streamConfigParse({
        sections: enrichedSections,
        environment,
        customerName,
        onDelta: (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        },
        onDone: () => setIsStreaming(false),
        onError: (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${error}` }
                : m
            )
          );
          setIsStreaming(false);
        },
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Failed to connect to AI service." }
            : m
        )
      );
      setIsStreaming(false);
    }
  }, [isStreaming, messages, sections, environment, customerName, buildContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const renderMarkdown = (text: string) => {
    const html = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(html);
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="no-print fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-[#2006F7] text-white shadow-lg hover:bg-[#10037C] transition-colors flex items-center justify-center group"
          title="Ask AI about your assessment"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#00F2B3] ring-2 ring-background" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="no-print fixed bottom-6 right-6 z-50 w-[380px] max-h-[600px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#001A47] text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">AI Assessment Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[420px]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">Ask questions about your firewall assessment. The AI has full context of your analysis results and reports.</p>
                <div className="space-y-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
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
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#2006F7] text-white"
                    : "bg-muted/50 text-foreground border border-border"
                }`}>
                  {msg.role === "assistant" && msg.content ? (
                    <div
                      className="prose prose-xs dark:prose-invert max-w-none [&_p]:text-xs [&_p]:my-1 [&_ul]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px]"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
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
                placeholder="Ask about your assessment…"
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 min-h-[36px] max-h-[80px]"
                disabled={isStreaming}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isStreaming || !input.trim()}
                className="h-9 w-9 rounded-lg bg-[#2006F7] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#10037C] transition-colors shrink-0"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
