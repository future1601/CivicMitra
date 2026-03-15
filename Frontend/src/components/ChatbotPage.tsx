import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { apiService } from "../services/api";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatStats {
  total_complaints: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_category: Record<string, number>;
  recent_complaints: number;
}

interface ParsedComplaint {
  reportId?: string;
  category?: string;
  priority?: string;
  description?: string;
  status?: string;
  createdAt?: string;
}

const quickQuestions = [
  "How many total complaints do we have?",
  "Show me complaints by category",
  "Which complaints have high priority?",
  "Show me the latest 5 complaints",
  "What's the status distribution of complaints?",
];

const formatLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getPriorityTone = (priority: string) => {
  switch (priority.toLowerCase()) {
    case "very_high":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "medium":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    case "low":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const getStatusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "in_progress":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "submitted":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const parseComplaintMessage = (text: string): ReactNode => {
  if (!(text.includes("**Complaint") && text.includes("Report ID:"))) {
    return text;
  }

  const sections = text
    .split(/\*\*Complaint \d+:\*\*/)
    .map((section) => section.trim());
  const intro = sections[0];
  const complaints = sections.slice(1).filter(Boolean);

  return (
    <div className="space-y-4">
      {intro && <p className="text-sm font-medium text-slate-700">{intro}</p>}

      {complaints.map((complaint, index) => {
        const parsed: ParsedComplaint = {};

        complaint
          .split("\n")
          .map((line) => line.replace(/^\*\s*/, "").trim())
          .filter(Boolean)
          .forEach((line) => {
            if (line.includes("**Report ID:**")) {
              parsed.reportId = line.replace("**Report ID:**", "").trim();
            } else if (line.includes("**Category:**")) {
              parsed.category = line.replace("**Category:**", "").trim();
            } else if (line.includes("**Priority:**")) {
              parsed.priority = line.replace("**Priority:**", "").trim();
            } else if (line.includes("**Description:**")) {
              parsed.description = line.replace("**Description:**", "").trim();
            } else if (line.includes("**Status:**")) {
              parsed.status = line.replace("**Status:**", "").trim();
            } else if (line.includes("**Created At:**")) {
              parsed.createdAt = line.replace("**Created At:**", "").trim();
            }
          });

        return (
          <div
            key={`${parsed.reportId ?? "complaint"}-${index}`}
            className="rounded-[20px] border border-slate-200 bg-slate-50/90 p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Complaint {index + 1}
                </p>
                {parsed.reportId && (
                  <p className="mt-1 font-mono text-sm text-slate-900">
                    {parsed.reportId}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {parsed.priority && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityTone(
                      parsed.priority
                    )}`}
                  >
                    {formatLabel(parsed.priority)}
                  </span>
                )}

                {parsed.status && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(
                      parsed.status
                    )}`}
                  >
                    {formatLabel(parsed.status)}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm leading-6 text-slate-700">
              {parsed.category && (
                <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <span className="font-medium text-slate-500">Category</span>
                  <span className="text-slate-900">
                    {formatLabel(parsed.category)}
                  </span>
                </div>
              )}

              {parsed.description && (
                <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <span className="font-medium text-slate-500">
                    Description
                  </span>
                  <span className="text-slate-900">{parsed.description}</span>
                </div>
              )}

              {parsed.createdAt && (
                <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
                  <span className="font-medium text-slate-500">Created</span>
                  <span className="text-slate-900">
                    {new Date(parsed.createdAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {text.includes("For more details") && (
        <div className="rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span className="font-semibold">Tip:</span> Ask with a specific report
          ID to retrieve the full complaint record, location, and attachments.
        </div>
      )}
    </div>
  );
};

export function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      text: "Hello! I'm your complaint data assistant. I can help you analyze complaint patterns, statistics, and answer questions about the complaint database. What would you like to know?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await apiService.getChatbotStats();
        setStats(response);
      } catch (error) {
        console.error("Error fetching chatbot stats:", error);
      }
    };

    void loadStats();
  }, []);

  const submitMessage = async (messageText: string) => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: trimmedMessage,
      sender: "user",
      timestamp: new Date(),
    };

    const nextHistory = [...messages, userMessage].map((message) => ({
      text: message.text,
      sender: message.sender,
    }));

    setMessages((previousMessages) => [...previousMessages, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await apiService.sendChatMessage(
        trimmedMessage,
        nextHistory
      );

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((previousMessages) => [...previousMessages, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: (Date.now() + 1).toString(),
          text: "Sorry, I encountered an error. Please try again.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(inputMessage);
    }
  };

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[22px] border-slate-200 bg-white/94 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total Complaints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {stats.total_complaints}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-slate-200 bg-white/94 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Recent (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-700">
                {stats.recent_complaints}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-slate-200 bg-white/94 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">
                      {formatLabel(status)}
                    </span>
                    <Badge variant="outline" className="border-slate-200">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-slate-200 bg-white/94 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.by_priority).map(([priority, count]) => (
                  <div
                    key={priority}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-700">
                      {formatLabel(priority)}
                    </span>
                    <Badge variant="outline" className="border-slate-200">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="flex h-[700px] flex-col overflow-hidden rounded-[28px] border-slate-200 bg-white/95 shadow-[0_20px_56px_-36px_rgba(15,23,42,0.34)]">
        <CardHeader className="border-b border-slate-200 bg-slate-50/90">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Assistant ready
              </div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Complaint Data Assistant
              </CardTitle>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Ask for status counts, recent complaints, category summaries, or
                high-priority case information.
              </p>
            </div>

            <div className="hidden rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm md:block">
              Uses the live complaints database for operational lookups.
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_28%,#f8fbff_100%)] p-5 text-slate-900">
          {messages.map((message) => {
            const content = parseComplaintMessage(message.text);

            return (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[86%] rounded-[22px] border px-4 py-3 shadow-sm ${
                    message.sender === "user"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  {message.sender === "bot" && (
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <Bot className="h-3.5 w-3.5" />
                      Assistant
                    </div>
                  )}

                  {typeof content === "string" ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-7">
                      {content}
                    </p>
                  ) : (
                    content
                  )}

                  <div
                    className={`mt-3 text-xs ${
                      message.sender === "user"
                        ? "text-slate-300"
                        : "text-slate-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  Assistant is preparing a response
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t border-slate-200 bg-slate-50/70 p-4">
          <p className="mb-3 text-sm font-medium text-slate-600">
            Quick questions
          </p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                onClick={() => void submitMessage(question)}
                disabled={isLoading}
                className="rounded-full border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100"
              >
                {question}
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <textarea
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about complaint data..."
              className="min-h-[96px] flex-1 resize-none rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              rows={3}
              disabled={isLoading}
            />

            <Button
              onClick={() => void submitMessage(inputMessage)}
              disabled={!inputMessage.trim() || isLoading}
              className="h-auto rounded-[20px] bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 md:min-w-[132px]"
            >
              <SendHorizontal className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
