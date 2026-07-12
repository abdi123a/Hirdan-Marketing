import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { 
  UploadCloud, Copy, Trash2, Clock, Mail, Check, Link2, 
  File, FileText, FileSpreadsheet, FileArchive, FileImage, 
  FileVideo, FileAudio, AlertCircle, Sparkles, Send, Eye, Loader2,
  RefreshCw, Play, Monitor, Globe, Activity
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FilePreviewModal from "@/components/FilePreviewModal";
import RichTextEditor from "@/components/RichTextEditor";

interface TransferItem {
  id: string;
  shareId: string;
  fileName: string;
  fileSize: number;
  client: { id: string; name: string; email?: string } | null;
  expiresAt: string;
  downloadCount: number;
  viewCount: number;
  isExpired: boolean;
  isDeleted: boolean;
  createdAt: string;
  emailSentTo: string | null;
  emailSentAt: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="h-8 w-8 text-rose-500" />;
    case "xlsx":
    case "xls":
    case "csv":
      return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
    case "zip":
    case "rar":
    case "7z":
      return <FileArchive className="h-8 w-8 text-amber-500" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return <FileImage className="h-8 w-8 text-blue-500" />;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
      return <FileVideo className="h-8 w-8 text-purple-500" />;
    case "mp3":
    case "wav":
    case "ogg":
    case "aac":
      return <FileAudio className="h-8 w-8 text-teal-500" />;
    default:
      return <File className="h-8 w-8 text-muted-foreground" />;
  }
}

function isImageFile(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
}

function isVideoFile(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["mp4", "mov", "avi", "mkv", "webm"].includes(ext || "");
}

export default function FileTransfer() {
  const queryClient = useQueryClient();
  const { clients, fetchClients } = useAgencyStore();

  // Expiry states
  const [expiryType, setExpiryType] = useState<"preset" | "custom">("preset");
  const [expiryPreset, setExpiryPreset] = useState<number>(7);
  const [customExpiryValue, setCustomExpiryValue] = useState<number>(1);
  const [customExpiryUnit, setCustomExpiryUnit] = useState<"minutes" | "hours" | "days">("days");

  const [message, setMessage] = useState("");
  
  // Real-time custom uploader metrics
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Email sending popup state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogTransfer, setEmailDialogTransfer] = useState<TransferItem | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const richTextRef = useRef<HTMLDivElement>(null);
  const noteRichTextRef = useRef<HTMLDivElement>(null);

  // In-app File preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");

  // Post-upload share popup state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successShareUrl, setSuccessShareUrl] = useState("");
  const [successFileName, setSuccessFileName] = useState("");

  // Access Logs dialog state
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsDialogTransfer, setLogsDialogTransfer] = useState<TransferItem | null>(null);
  const [transferEvents, setTransferEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Renew Dialog state
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewDialogTransfer, setRenewDialogTransfer] = useState<TransferItem | null>(null);
  const [renewType, setRenewType] = useState<"preset" | "custom">("preset");
  const [renewPreset, setRenewPreset] = useState<number>(7);
  const [customRenewValue, setCustomRenewValue] = useState<number>(1);
  const [customRenewUnit, setCustomRenewUnit] = useState<"minutes" | "hours" | "days">("days");

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const { data: transfers, isLoading } = useQuery<TransferItem[]>({
    queryKey: ["transfers"],
    queryFn: () => apiFetch<TransferItem[]>("/transfer"),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({
      transferId,
      email,
      name,
      message,
    }: {
      transferId: string;
      email: string;
      name?: string;
      message?: string;
    }) => {
      return apiFetch(`/transfer/${transferId}/send`, {
        method: "POST",
        body: JSON.stringify({ recipientEmail: email, recipientName: name, customMessage: message }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Email sent successfully.");
      setEmailDialogOpen(false);
      setCustomMessage("");
      if (richTextRef.current) richTextRef.current.innerHTML = "";
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || "Couldn't send the email. Try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/transfer/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Share link revoked and file deleted.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke link.");
    },
  });

  const renewMutation = useMutation({
    mutationFn: async ({
      transferId,
      value,
      unit,
    }: {
      transferId: string;
      value: number;
      unit: string;
    }) => {
      return apiFetch(`/transfer/${transferId}/renew`, {
        method: "POST",
        body: JSON.stringify({ expiryValue: value, expiryUnit: unit }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Transfer link renewed successfully!");
      setRenewDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to renew transfer link.");
    },
  });

  const uploadFile = useCallback(
    async (file: File) => {
      setUploadProgress(0);
      setUploadSpeed("0 B/s");
      setTimeRemaining("Calculating...");

      const startTime = Date.now();
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        if (expiryType === "preset") {
          formData.append("expiryValue", String(expiryPreset));
          formData.append("expiryUnit", "days");
        } else {
          formData.append("expiryValue", String(customExpiryValue));
          formData.append("expiryUnit", customExpiryUnit);
        }

        if (message) formData.append("message", message);
        if (selectedClientId && selectedClientId !== "none") {
          formData.append("clientId", selectedClientId);
        }

        const token = useAuthStore.getState().token;

        await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_BASE}/transfer/upload`);
          
          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }
          
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const loaded = event.loaded;
              const total = event.total;
              const now = Date.now();
              const elapsed = (now - startTime) / 1000; // seconds
              const speed = elapsed > 0 ? loaded / elapsed : 0; // bytes/sec
              const remainingBytes = total - loaded;
              const remainingTime = speed > 0 ? remainingBytes / speed : 0; // seconds
              
              setUploadProgress(Math.round((loaded / total) * 100));
              setUploadSpeed(formatBytes(speed) + "/s");
              setTimeRemaining(
                remainingTime > 0 
                  ? `${Math.round(remainingTime)}s` 
                  : "Calculating..."
              );
            }
          };
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                resolve({});
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.message || err.error || "Upload failed."));
              } catch (e) {
                reject(new Error(`Upload failed with status: ${xhr.status}`));
              }
            }
          };
          
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new Error("Upload aborted"));
          
          xhr.withCredentials = true;
          xhr.send(formData);
        }).then(async (data: any) => {
          const selectedClient = clients.find((c) => c.id === selectedClientId);

          // Generate local frontend URL using window.location.origin or custom short link domain to match environment ports
          const linkDomain = import.meta.env.VITE_SHORT_LINK_DOMAIN || window.location.origin;
          const shareUrl = `${linkDomain.replace(/\/$/, "")}/f/${data.shareId}`;

          if (selectedClient?.email) {
            await sendEmailMutation.mutateAsync({
              transferId: data.id,
              email: selectedClient.email,
              name: selectedClient.name,
            });
          } else {
            // Store details and open success dialog showing generated link
            setSuccessShareUrl(shareUrl);
            setSuccessFileName(file.name);
            setSuccessDialogOpen(true);
            
            // Auto copy generated link to clipboard
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Upload complete! Link copied.");
          }

          queryClient.invalidateQueries({ queryKey: ["transfers"] });
          setMessage("");
          if (noteRichTextRef.current) noteRichTextRef.current.innerHTML = "";
          setSelectedClientId("none");
        });
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Upload failed. Please try again.");
      } finally {
        setUploadProgress(null);
        setUploadSpeed(null);
        setTimeRemaining(null);
      }
    },
    [expiryType, expiryPreset, customExpiryValue, customExpiryUnit, message, selectedClientId, clients, sendEmailMutation, queryClient]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        uploadFile(acceptedFiles[0]);
      }
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 2 * 1024 * 1024 * 1024,
  });

  const handleCopyLink = (shareId: string) => {
    const linkDomain = import.meta.env.VITE_SHORT_LINK_DOMAIN || window.location.origin;
    const shareUrl = `${linkDomain.replace(/\/$/, "")}/f/${shareId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(shareId);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleEmailActionClick = (transfer: TransferItem) => {
    setEmailDialogTransfer(transfer);
    setRecipientEmail(transfer.client?.email || "");
    setRecipientName(transfer.client?.name || "");
    setCustomMessage("");
    if (richTextRef.current) richTextRef.current.innerHTML = "";
    setEmailDialogOpen(true);
  };

  const handleEmailSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailDialogTransfer) return;
    if (!recipientEmail.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }
    const msgHtml = richTextRef.current?.innerHTML?.trim() || "";
    sendEmailMutation.mutate({
      transferId: emailDialogTransfer.id,
      email: recipientEmail,
      name: recipientName || undefined,
      message: msgHtml || undefined,
    });
  };


  const handlePreviewClick = (transfer: TransferItem) => {
    // Add ?preview=true parameter to avoid incrementing downloadCount in-app
    const fileUrl = `/transfer/${transfer.shareId}/download?preview=true&t=${new Date(transfer.expiresAt).getTime()}`;
    setPreviewUrl(fileUrl);
    setPreviewLabel(transfer.fileName);
    setPreviewOpen(true);
  };

  const handleLogsClick = async (transfer: TransferItem) => {
    setLogsDialogTransfer(transfer);
    setTransferEvents([]);
    setLogsDialogOpen(true);
    setLoadingEvents(true);
    try {
      const data = await apiFetch<any[]>(`/transfer/${transfer.id}/events`);
      setTransferEvents(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load events logs.");
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleRenewClick = (transfer: TransferItem) => {
    setRenewDialogTransfer(transfer);
    setRenewType("preset");
    setRenewPreset(7);
    setCustomRenewValue(1);
    setCustomRenewUnit("days");
    setRenewDialogOpen(true);
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewDialogTransfer) return;
    const value = renewType === "preset" ? renewPreset : customRenewValue;
    const unit = renewType === "preset" ? "days" : customRenewUnit;
    renewMutation.mutate({
      transferId: renewDialogTransfer.id,
      value,
      unit,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            File Transfer
          </h1>
          <p className="text-muted-foreground mt-1">
            Send large files securely via self-expiring download links.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Upload Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-card border-border bg-card rounded-2xl">
            <CardContent className="p-6 space-y-5">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-primary" />
                Upload New File
              </h2>

              {/* Drag and Drop Zone */}
              <div
                {...getRootProps()}
                className={`group relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <input {...getInputProps()} />
                
                {uploadProgress !== null ? (
                  <div className="space-y-4 py-3">
                    <div className="relative mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
                      <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-foreground">
                        Uploading... {uploadProgress}%
                      </p>
                      <Progress value={uploadProgress} className="h-1.5 w-full max-w-[180px] mx-auto bg-muted" />
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground max-w-[180px] mx-auto px-1">
                        <span>Speed: {uploadSpeed}</span>
                        <span>ETA: {timeRemaining}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-2">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted group-hover:scale-105 transition-transform duration-300">
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        Drag & drop a file here
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        or click to browse from device
                      </p>
                    </div>
                    <span className="inline-block text-[9px] bg-muted px-2.5 py-1 rounded-md text-muted-foreground font-medium">
                      Max Size: 2 GB
                    </span>
                  </div>
                )}
              </div>

              {/* Expiry selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Expiry Duration
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setExpiryType("preset")}
                      disabled={uploadProgress !== null}
                      className={`text-[10px] font-bold ${expiryType === "preset" ? "text-primary underline" : "text-muted-foreground"}`}
                    >
                      Presets
                    </button>
                    <span className="text-[10px] text-muted-foreground/40">|</span>
                    <button 
                      type="button" 
                      onClick={() => setExpiryType("custom")}
                      disabled={uploadProgress !== null}
                      className={`text-[10px] font-bold ${expiryType === "custom" ? "text-primary underline" : "text-muted-foreground"}`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {expiryType === "preset" ? (
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                    {[7, 10].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setExpiryPreset(days)}
                        disabled={uploadProgress !== null}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          expiryPreset === days
                            ? "bg-card shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 animate-fade-in">
                    <Input
                      type="number"
                      min={1}
                      value={customExpiryValue}
                      onChange={(e) => setCustomExpiryValue(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={uploadProgress !== null}
                      className="w-20 h-10 rounded-xl bg-muted/50 border-border/50 text-sm focus:bg-card focus:border-primary/50"
                    />
                    <Select
                      value={customExpiryUnit}
                      onValueChange={(val: any) => setCustomExpiryUnit(val)}
                      disabled={uploadProgress !== null}
                    >
                      <SelectTrigger className="flex-1 h-10 rounded-xl bg-muted/50 border-border/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Client assignment */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Assign Client (Optional)
                </label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  disabled={uploadProgress !== null}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl bg-muted/50 border-border/50 text-sm">
                    <SelectValue placeholder="No client (just copy link)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">No client — just copy link</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClientId !== "none" && (
                  <p className="text-[10px] text-primary flex items-center gap-1.5 px-1 font-medium">
                    <Mail className="h-3.5 w-3.5" />
                    Autosends email notification on successful upload.
                  </p>
                )}
              </div>

              {/* Optional note */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Add Note / Message (Optional)
                </label>
                <RichTextEditor
                  editorRef={noteRichTextRef}
                  onChange={(html) => setMessage(html)}
                  disabled={uploadProgress !== null}
                  minHeight="90px"
                  maxHeight="160px"
                  placeholder="Tell your client what this file is..."
                />
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Table Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-card border-border bg-card rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Active Transfers ({transfers?.length || 0})
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground space-y-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs">Loading transfers...</p>
                  </div>
                ) : !transfers?.length ? (
                  <div className="p-12 text-center text-muted-foreground space-y-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs">No files uploaded yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Details</TableHead>
                        <TableHead>Client / Status</TableHead>
                        <TableHead className="text-center">Views</TableHead>
                        <TableHead className="text-center">Downloads</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map((t) => {
                        const fileUrl = `${API_BASE}/transfer/${t.shareId}/download?preview=true&t=${new Date(t.expiresAt).getTime()}`;
                        const isImage = isImageFile(t.fileName) && !t.isDeleted;
                        const isVideo = isVideoFile(t.fileName) && !t.isDeleted;

                        return (
                          <TableRow key={t.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="max-w-[200px]">
                              <div className="flex items-center gap-3">
                                
                                {/* Image / Video preview thumbnail */}
                                {isImage ? (
                                  <div 
                                    onClick={() => handlePreviewClick(t)}
                                    className="shrink-0 h-10 w-10 bg-muted border border-border rounded-lg overflow-hidden flex items-center justify-center cursor-zoom-in hover:opacity-85 transition-opacity"
                                  >
                                    <img src={fileUrl} className="h-full w-full object-cover" alt="" />
                                  </div>
                                ) : isVideo ? (
                                  <div 
                                    onClick={() => handlePreviewClick(t)}
                                    className="shrink-0 h-10 w-10 bg-black border border-border rounded-lg overflow-hidden flex items-center justify-center relative cursor-zoom-in hover:opacity-85 transition-opacity"
                                  >
                                    <video src={fileUrl} className="h-full w-full object-cover" preload="metadata" muted />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <FileVideo className="h-4 w-4 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="shrink-0 p-2 bg-muted rounded-xl">
                                    {getFileIcon(t.fileName)}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p 
                                    onClick={() => (isImage || isVideo) && handlePreviewClick(t)}
                                    className={`font-semibold text-sm text-foreground truncate ${isImage || isVideo ? "cursor-pointer hover:underline hover:text-primary" : ""}`}
                                    title={t.fileName}
                                  >
                                    {t.fileName}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {formatBytes(t.fileSize)}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-foreground">
                                  {t.client?.name ?? "No Client"}
                                </span>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  {t.isDeleted ? (
                                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 font-medium">
                                      Deleted (Revoked)
                                    </Badge>
                                  ) : t.isExpired ? (
                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                                      Expired
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                                      Active · Expires {new Date(t.expiresAt).toLocaleDateString()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              <button
                                type="button"
                                onClick={() => handleLogsClick(t)}
                                className="text-foreground hover:text-primary hover:underline transition-colors"
                              >
                                {t.viewCount || 0}
                              </button>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              <button
                                type="button"
                                onClick={() => handleLogsClick(t)}
                                className="text-foreground hover:text-primary hover:underline transition-colors"
                              >
                                {t.downloadCount || 0}
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                <div className="flex justify-end gap-1.5">
                                  
                                  {/* Renew link if expired but not deleted */}
                                  {t.isExpired && !t.isDeleted && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 hover:bg-muted text-primary"
                                      onClick={() => handleRenewClick(t)}
                                      title="Renew expired link"
                                    >
                                      <RefreshCw className="h-4 w-4 animate-spin-slow" />
                                    </Button>
                                  )}

                                  {/* Quick Preview Action */}
                                  {(isImage || isVideo) && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 hover:bg-muted"
                                      onClick={() => handlePreviewClick(t)}
                                      title="Preview file"
                                    >
                                      <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    </Button>
                                  )}

                                  {/* Copy Link Action */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-muted"
                                    disabled={t.isExpired || t.isDeleted}
                                    onClick={() => handleCopyLink(t.shareId)}
                                    title="Copy direct sharing link"
                                  >
                                    {copiedId === t.shareId ? (
                                      <Check className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    )}
                                  </Button>

                                  {/* Send/Resend Email Action */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-muted"
                                    disabled={t.isExpired || t.isDeleted || sendEmailMutation.isPending}
                                    onClick={() => handleEmailActionClick(t)}
                                    title="Send download link via email"
                                  >
                                    <Mail className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  </Button>

                                  {/* Revoke/Delete Action */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                    disabled={t.isDeleted}
                                    onClick={() => {
                                      if (confirm("Are you sure you want to revoke this link early? This will delete the file off our server immediately.")) {
                                        deleteMutation.mutate(t.id);
                                      }
                                    }}
                                    title="Revoke link & delete file"
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </div>
                                {t.emailSentTo && (
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-muted border border-border px-2 py-0.5 rounded-full">
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    Sent to {t.emailSentTo}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Recipient Email input Popup Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        setEmailDialogOpen(open);
        if (!open) {
          setCustomMessage("");
          if (richTextRef.current) richTextRef.current.innerHTML = "";
        }
      }}>
        <DialogContent className="max-w-[500px] rounded-3xl">
          <form onSubmit={handleEmailSendSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
                <Mail className="h-5 w-5 text-primary" />
                Share Link via Email
              </DialogTitle>
              <DialogDescription className="text-xs">
                Send the secure self-expiring link directly to your client.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dialog-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recipient Email Address
                </Label>
                <Input 
                  id="dialog-email"
                  type="email"
                  placeholder="client@company.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialog-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Recipient Name (Optional)
                </Label>
                <Input 
                  id="dialog-name"
                  type="text"
                  placeholder="John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm"
                />
              </div>

              {/* Rich Text Custom Message */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Custom Message for Client (Optional)
                </Label>
                <RichTextEditor
                  editorRef={richTextRef}
                  onChange={(html) => setCustomMessage(html)}
                  minHeight="110px"
                  maxHeight="220px"
                  placeholder="Write a personal message to your client... (appears at the top of the email)"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setEmailDialogOpen(false);
                  setCustomMessage("");
                  if (richTextRef.current) richTextRef.current.innerHTML = "";
                }} 
                className="h-10 rounded-xl text-xs font-semibold uppercase tracking-wider border-border/50 hover:bg-muted"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={sendEmailMutation.isPending}
                className="h-10 rounded-xl text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 text-white"
              >
                {sendEmailMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Send Email <Send className="h-3 w-3 ml-1.5" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog: Upload Finished - link display and QR code */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="max-w-[420px] rounded-3xl">
          <div className="space-y-5 text-center py-3">
            <DialogHeader>
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 mb-2">
                <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Upload Finished!
              </DialogTitle>
              <DialogDescription className="text-xs truncate max-w-[340px] mx-auto" title={successFileName}>
                "{successFileName}" has been securely uploaded.
              </DialogDescription>
            </DialogHeader>

            {/* QR Code */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Scan to download on mobile
              </p>
              <div className="p-3 bg-white rounded-2xl border border-border w-fit mx-auto shadow-sm">
                <QRCodeSVG value={successShareUrl} size={120} />
              </div>
            </div>

            {/* Copy link section */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-left px-1">
                Shareable Link (Auto-copied)
              </p>
              <div className="flex gap-2">
                <Input 
                  value={successShareUrl} 
                  readOnly 
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="h-11 rounded-xl bg-muted/60 border-border text-xs font-mono"
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(successShareUrl).then(() => {
                      toast.success("Link copied!");
                    });
                  }}
                  className="h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 text-white"
                >
                  Copy
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button 
                onClick={() => setSuccessDialogOpen(false)} 
                className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider bg-muted text-foreground hover:bg-muted/80 border border-border/50"
              >
                Close Window
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Renew Expired Link Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-[420px] rounded-3xl">
          <form onSubmit={handleRenewSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
                <RefreshCw className="h-5 w-5 text-primary" />
                Renew Expired Link
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set a new expiration duration to make the file available for download again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Expiration Duration
                </label>
                
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl mb-2">
                  <button 
                    type="button" 
                    onClick={() => setRenewType("preset")}
                    className={`py-1 text-xs font-semibold rounded-lg transition-all ${
                      renewType === "preset"
                        ? "bg-card shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Presets
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setRenewType("custom")}
                    className={`py-1 text-xs font-semibold rounded-lg transition-all ${
                      renewType === "custom"
                        ? "bg-card shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {renewType === "preset" ? (
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                    {[7, 10].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setRenewPreset(days)}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          renewPreset === days
                            ? "bg-card shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 animate-fade-in">
                    <Input
                      type="number"
                      min={1}
                      value={customRenewValue}
                      onChange={(e) => setCustomRenewValue(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 h-10 rounded-xl bg-muted/50 border-border/50 text-sm focus:bg-card focus:border-primary/50"
                    />
                    <Select
                      value={customRenewUnit}
                      onValueChange={(val: any) => setCustomRenewUnit(val)}
                    >
                      <SelectTrigger className="flex-1 h-10 rounded-xl bg-muted/50 border-border/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setRenewDialogOpen(false)} 
                className="h-10 rounded-xl text-xs font-semibold uppercase tracking-wider border-border/50 hover:bg-muted"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={renewMutation.isPending}
                className="h-10 rounded-xl text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/95 text-white"
              >
                {renewMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Renew Link"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access Activity Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Transfer Activity History
            </DialogTitle>
            <DialogDescription className="text-xs truncate max-w-[420px]" title={logsDialogTransfer?.fileName}>
              Access log for "{logsDialogTransfer?.fileName}"
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-[300px] overflow-y-auto space-y-3 pr-1">
            {loadingEvents ? (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="text-xs">Loading activity logs...</p>
              </div>
            ) : !transferEvents.length ? (
              <div className="p-12 text-center text-muted-foreground text-xs">
                No view or download actions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {transferEvents.map((evt: any) => (
                  <div 
                    key={evt.id} 
                    className="p-3 bg-muted/40 border border-border/50 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={evt.eventType === "DOWNLOAD" 
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold"
                          }
                        >
                          {evt.eventType}
                        </Badge>
                        <span className="font-semibold text-slate-500 font-mono">
                          {evt.ipAddress || "Unknown IP"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[280px]" title={evt.userAgent}>
                        Agent: {evt.userAgent || "Unknown Browser"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button 
              onClick={() => setLogsDialogOpen(false)} 
              className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider bg-muted text-foreground hover:bg-muted/80 border border-border/50"
            >
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-app File Preview Modal */}
      <FilePreviewModal 
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl(null);
          setPreviewLabel("");
        }}
        fileUrl={previewUrl}
        fileLabel={previewLabel}
      />

    </div>
  );
}
