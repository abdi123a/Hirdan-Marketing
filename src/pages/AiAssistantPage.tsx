import { useState, useEffect, useRef } from "react";
import { useAgencyStore } from "@/lib/store";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  User, 
  Bot, 
  FileText, 
  TrendingUp, 
  Mail, 
  CheckCircle,
  HelpCircle,
  Wrench,
  ChevronRight,
  Info
} from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

export default function AiAssistantPage() {
  const { toast } = useToast();
  const { clients, projects, fetchSettings, fetchAllData, settings } = useAgencyStore();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I am your Hirdan Marketing AI assistant. How can I help you today? You can select a client scope below, or try one of the quick drafting actions to summarize files, financials, monthly reports, or emails."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ provider: string; connected: boolean }>({ provider: 'openai', connected: false });
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSettings();
    fetchAllData();
    checkAiStatus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const checkAiStatus = async () => {
    try {
      const status = await apiFetch<{ provider: string; connected: boolean }>('/ai/status');
      setAiStatus(status);
    } catch (e) {
      console.error("Failed to check AI status:", e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    if (!textToSend) {
      setInput("");
    }

    const newMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, newMsg]);
    setIsLoading(true);

    try {
      const body: Record<string, any> = {
        message: text,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      };

      if (selectedClientId && selectedClientId !== "none") {
        body.clientId = selectedClientId;
      }

      const res = await apiFetch<{ reply: string; provider: string; model: string; toolsUsed?: string[] }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply,
        toolsUsed: res.toolsUsed
      }]);
    } catch (err: any) {
      toast({
        title: "AI Response Error",
        description: err.message || "Failed to get a response from AI.",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${err.message || "Could not retrieve AI response. Please make sure the active provider API key is set in Settings."}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action Handlers
  const handleQuickAction = (type: 'report' | 'financials' | 'email' | 'file') => {
    if (selectedClientId === "none" && type !== 'file') {
      toast({
        title: "Client Context Required",
        description: "Please select a client from the dropdown first to draft this content.",
        variant: "destructive"
      });
      return;
    }

    let prompt = "";
    if (type === 'report') {
      const curDate = new Date();
      const prevMonth = curDate.getMonth() === 0 ? 12 : curDate.getMonth();
      const prevYear = curDate.getMonth() === 0 ? curDate.getFullYear() - 1 : curDate.getFullYear();
      prompt = `Draft a monthly report summary for Client ID "${selectedClientId}" for month "${prevMonth}" and year "${prevYear}".`;
    } else if (type === 'financials') {
      prompt = `Summarize the financials (invoices and expenses) for Client ID "${selectedClientId}".`;
    } else if (type === 'email') {
      prompt = `Draft a client email for Client ID "${selectedClientId}" updating them about their projects.`;
    } else if (type === 'file') {
      prompt = `List recent shared files and tell me their IDs, or summarize a file if I give you an ID.`;
    }

    handleSend(prompt);
  };

  const getProviderLabel = (id: string) => {
    const labels: Record<string, string> = {
      openai: 'OpenAI (GPT-4o)',
      claude: 'Anthropic Claude',
      gemini: 'Google Gemini'
    };
    return labels[id] || id.toUpperCase();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)] w-full">
      {/* Sidebar Control Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
        <Card className="shadow-sm border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Info className="h-4 w-4 text-purple-500" /> Assistant Scope
            </CardTitle>
            <CardDescription>Limit the context of the AI assistant to a specific client.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Context</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="rounded-xl border-border/80 h-10">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Context (No Client)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClientId !== "none" && (
              <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Context</label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="rounded-xl border-border/80 h-10">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Projects</SelectItem>
                    {projects
                      .filter(p => p.clientId === selectedClientId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Provider Status Card */}
        <Card className="shadow-sm border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connected Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground">
                {getProviderLabel(aiStatus.provider)}
              </span>
              <span className="text-xs text-muted-foreground">Active Main AI</span>
            </div>
            <Badge className={`rounded-full px-3 py-1 font-semibold text-xs border ${
              aiStatus.connected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' 
                : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:border-orange-850'
            }`}>
              {aiStatus.connected ? "Connected" : "Key Missing"}
            </Badge>
          </CardContent>
        </Card>

        {/* Quick Action Drafting Prompts */}
        <Card className="shadow-sm border-border bg-card flex-grow">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </CardTitle>
            <CardDescription className="text-xs">Quickly run structured context tools to generate drafts.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Button
              variant="outline"
              onClick={() => handleQuickAction('report')}
              className="justify-start text-left rounded-xl h-11 border-border/80 hover:bg-purple-50/50 hover:text-purple-700 hover:border-purple-200 dark:hover:bg-purple-950/10 dark:hover:text-purple-300 transition-all text-sm font-semibold"
            >
              <FileText className="h-4 w-4 mr-2.5 text-purple-500" />
              Draft Monthly Report
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickAction('financials')}
              className="justify-start text-left rounded-xl h-11 border-border/80 hover:bg-purple-50/50 hover:text-purple-700 hover:border-purple-200 dark:hover:bg-purple-950/10 dark:hover:text-purple-300 transition-all text-sm font-semibold"
            >
              <TrendingUp className="h-4 w-4 mr-2.5 text-purple-500" />
              Summarize Financials
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickAction('email')}
              className="justify-start text-left rounded-xl h-11 border-border/80 hover:bg-purple-50/50 hover:text-purple-700 hover:border-purple-200 dark:hover:bg-purple-950/10 dark:hover:text-purple-300 transition-all text-sm font-semibold"
            >
              <Mail className="h-4 w-4 mr-2.5 text-purple-500" />
              Draft Client Email
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickAction('file')}
              className="justify-start text-left rounded-xl h-11 border-border/80 hover:bg-purple-50/50 hover:text-purple-700 hover:border-purple-200 dark:hover:bg-purple-950/10 dark:hover:text-purple-300 transition-all text-sm font-semibold"
            >
              <HelpCircle className="h-4 w-4 mr-2.5 text-purple-500" />
              Summarize Shared File
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Interface */}
      <Card className="flex-1 flex flex-col shadow-sm border-border bg-card overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-purple-500/5 to-transparent py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center border border-purple-200 dark:border-purple-900 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">AI Assistant Chat</CardTitle>
                <p className="text-xs text-muted-foreground">Draft-and-review assistant powered by {getProviderLabel(aiStatus.provider)}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Messages Stream */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {messages.map((m, idx) => {
              const isAi = m.role === 'assistant';
              return (
                <div key={idx} className={`flex gap-3 max-w-[85%] ${isAi ? 'self-start' : 'self-end ml-auto flex-row-reverse'}`}>
                  <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center border ${
                    isAi 
                      ? 'bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-950/20 dark:border-purple-900 dark:text-purple-400' 
                      : 'bg-primary/10 border-primary/20 text-primary'
                  }`}>
                    {isAi ? <Bot className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                  </div>
                  <div className="space-y-2">
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isAi 
                        ? 'bg-muted/40 text-foreground border border-border/40 rounded-tl-sm' 
                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                    }`}>
                      <p className="whitespace-pre-line">{m.content}</p>
                    </div>

                    {/* Rendering tools information */}
                    {m.toolsUsed && m.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted/60 px-2.5 py-1 rounded-full border border-border/30">
                          <Wrench className="h-3 w-3 text-purple-500 animate-pulse" />
                          Context tool run: {m.toolsUsed.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 max-w-[80%] self-start">
                <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center border bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-950/20 dark:border-purple-900 dark:text-purple-400">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="rounded-2xl px-4 py-3 text-sm bg-muted/40 border border-border/40 rounded-tl-sm flex items-center gap-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <span className="text-muted-foreground font-medium">Assistant is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Bar */}
        <div className="p-4 border-t bg-card shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2.5"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything, e.g. 'draft a monthly report summary' or 'summarize financials'..."
              disabled={isLoading || !aiStatus.connected}
              className="flex-1 rounded-xl h-11 focus-visible:ring-purple-500 border-border/80"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim() || !aiStatus.connected}
              className="rounded-xl h-11 px-5 bg-purple-600 text-white hover:bg-purple-700 font-semibold"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
