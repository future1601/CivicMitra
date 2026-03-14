import { useState, useRef, useEffect } from "react";
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch initial stats
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/chatbot/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Prepare chat history for API
      const chatHistory = messages.map((msg) => ({
        text: msg.text,
        sender: msg.sender,
      }));

      const response = await fetch(
        "http://localhost:8000/api/chatbot/message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: inputMessage,
            chat_history: chatHistory,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response from chatbot");
      }

      const data = await response.json();

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    "How many total complaints do we have?",
    "Show me complaints by category",
    "Which complaints have high priority?",
    "Show me the latest 5 complaints",
    "What's the status distribution of complaints?",
  ];

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  // Helper function to format complaint listings
  const formatComplaintText = (text: string) => {
    // Check if the text contains complaint data pattern
    if (text.includes("**Complaint") && text.includes("Report ID:")) {
      // Split by complaint sections
      const parts = text.split(/\*\*Complaint \d+:\*\*/);
      const intro = parts[0].trim();
      const complaints = parts.slice(1);

      return (
        <div className="space-y-4">
          {intro && (
            <div className="text-gray-700 font-medium mb-4">{intro}</div>
          )}

          {complaints.map((complaint, index) => {
            // Parse each complaint's details
            const lines = complaint
              .trim()
              .split("\n")
              .filter((line) => line.trim());
            const complaintData: any = {};

            lines.forEach((line) => {
              const cleanLine = line.replace(/^\*\s*/, "").trim();
              if (cleanLine.includes("**Report ID:**")) {
                complaintData.reportId = cleanLine
                  .replace("**Report ID:**", "")
                  .trim();
              } else if (cleanLine.includes("**Category:**")) {
                complaintData.category = cleanLine
                  .replace("**Category:**", "")
                  .trim();
              } else if (cleanLine.includes("**Priority:**")) {
                complaintData.priority = cleanLine
                  .replace("**Priority:**", "")
                  .trim();
              } else if (cleanLine.includes("**Description:**")) {
                complaintData.description = cleanLine
                  .replace("**Description:**", "")
                  .trim();
              } else if (cleanLine.includes("**Status:**")) {
                complaintData.status = cleanLine
                  .replace("**Status:**", "")
                  .trim();
              } else if (cleanLine.includes("**Created At:**")) {
                complaintData.createdAt = cleanLine
                  .replace("**Created At:**", "")
                  .trim();
              }
            });

            const getPriorityColor = (priority: string) => {
              switch (priority?.toLowerCase()) {
                case "very_high":
                  return "bg-red-100 text-red-800 border-red-200";
                case "high":
                  return "bg-orange-100 text-orange-800 border-orange-200";
                case "medium":
                  return "bg-yellow-100 text-yellow-800 border-yellow-200";
                case "low":
                  return "bg-green-100 text-green-800 border-green-200";
                default:
                  return "bg-gray-100 text-gray-800 border-gray-200";
              }
            };

            return (
              <div
                key={index}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Complaint {index + 1}
                  </h4>
                  <div className="flex gap-2">
                    {complaintData.priority && (
                      <Badge
                        className={getPriorityColor(complaintData.priority)}
                      >
                        {complaintData.priority.replace("_", " ").toUpperCase()}{" "}
                        Priority
                      </Badge>
                    )}
                    {complaintData.status && (
                      <Badge
                        variant="outline"
                        className="border-blue-200 text-blue-800 bg-blue-50"
                      >
                        {complaintData.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {complaintData.reportId && (
                    <div className="flex">
                      <span className="font-medium text-gray-600 w-24">
                        Report ID:
                      </span>
                      <span className="font-mono text-gray-900">
                        {complaintData.reportId}
                      </span>
                    </div>
                  )}

                  {complaintData.category && (
                    <div className="flex">
                      <span className="font-medium text-gray-600 w-24">
                        Category:
                      </span>
                      <span className="text-gray-900 capitalize">
                        {complaintData.category.replace("_", " ")}
                      </span>
                    </div>
                  )}

                  {complaintData.description && (
                    <div className="flex">
                      <span className="font-medium text-gray-600 w-24">
                        Description:
                      </span>
                      <span className="text-gray-900 flex-1">
                        {complaintData.description}
                      </span>
                    </div>
                  )}

                  {complaintData.createdAt && (
                    <div className="flex">
                      <span className="font-medium text-gray-600 w-24">
                        Created:
                      </span>
                      <span className="text-gray-900">
                        {new Date(complaintData.createdAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {text.includes("For more details") && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> For more details on any complaint,
                including phone number, location, and images, please specify the
                Report ID.
              </p>
            </div>
          )}
        </div>
      );
    }

    // Return original text if not a complaint listing
    return text;
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Complaint Data Assistant
        </h1>
        <p className="text-gray-600">
          Ask me anything about complaint patterns, statistics, and data
          analysis
        </p>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Complaints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_complaints}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Recent (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.recent_complaints}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.by_status).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="capitalize">{status}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(stats.by_priority).map(([priority, count]) => (
                  <div key={priority} className="flex justify-between text-sm">
                    <span className="capitalize">
                      {priority.replace("_", " ")}
                    </span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chat Interface */}
      <Card className="h-[600px] flex flex-col">
        {/* Chat Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {message.sender === "bot" ? (
                  <div className="text-sm leading-relaxed">
                    {typeof formatComplaintText(message.text) === "string" ? (
                      <p className="whitespace-pre-wrap font-mono">
                        {formatComplaintText(message.text)}
                      </p>
                    ) : (
                      formatComplaintText(message.text)
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.text}</p>
                )}
                <div
                  className={`text-xs mt-1 ${
                    message.sender === "user"
                      ? "text-blue-100"
                      : "text-gray-500"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Quick Questions */}
        <div className="border-t p-4">
          <p className="text-sm text-gray-600 mb-2">Quick questions:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {quickQuestions.map((question, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuestion(question)}
                className="text-xs"
              >
                {question}
              </Button>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about complaint data..."
              className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6"
            >
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
