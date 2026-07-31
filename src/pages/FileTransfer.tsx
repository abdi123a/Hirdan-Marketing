import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  UploadCloud, Copy, Trash2, Clock, Mail, Check, Link2,
  File, FileText, FileSpreadsheet, FileArchive, FileImage,
  FileVideo, FileAudio, Send, Eye, Loader2, X, Search,
  RefreshCw, Activity, Inbox, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { getShortShareUrl } from "@/lib/short-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  message?: string | null;
}

/** Live byte counters for the in-flight upload, driven by XHR progress events. */
interface UploadMeta {
  loaded: number;
  total: number;
  bytesPerSecond: number;
  secondsRemaining: number;
}

type TransferStatus = "active" | "expired" | "revoked";
type StatusFilter = "all" | TransferStatus;

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// Mirror of the server-side caps in transfer.routes.ts. nginx enforces the byte
// limit first via `client_max_body_size` on the /api/ proxy locations, so all
// three have to be raised together for a larger transfer to actually go through.
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB per file
const MAX_FILES = 300;

/** Transfers listed per page. */
const ROWS_PER_PAGE = 10;

/**
 * Page numbers to render, collapsing long runs to a single "…".
 * e.g. 12 pages on page 7 → [1, "…", 6, 7, 8, "…", 12]
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDuration(seconds: number) {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** "in 6 days" / "3 hours ago" — friendlier than a bare timestamp in a list. */
function formatRelative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60_000, "minute"],
    [3_600_000, "hour"],
    [86_400_000, "day"],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60_000) return diff < 0 ? "just now" : "in under a minute";
  for (const [ms, unit] of units) {
    const next = unit === "day" ? Infinity : ms * (unit === "minute" ? 60 : 24);
    if (abs < next) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

function getFileIcon(fileName: string, className = "h-8 w-8") {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className={`${className} text-rose-500`} />;
    case "xlsx":
    case "xls":
    case "csv":
      return <FileSpreadsheet className={`${className} text-emerald-500`} />;
    case "zip":
    case "rar":
    case "7z":
      return <FileArchive className={`${className} text-amber-500`} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return <FileImage className={`${className} text-blue-500`} />;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
      return <FileVideo className={`${className} text-purple-500`} />;
    case "mp3":
    case "wav":
    case "ogg":
    case "aac":
      return <FileAudio className={`${className} text-teal-500`} />;
    default:
      return <File className={`${className} text-muted-foreground`} />;
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

function statusOf(t: TransferItem): TransferStatus {
  if (t.isDeleted) return "revoked";
  if (t.isExpired) return "expired";
  return "active";
}

// ---- Presentational pieces ------------------------------------------------

/**
 * The page uses exactly two interactive shapes, defined once here and reused
 * everywhere. Earlier revisions grew a separate look for the expiry presets, the
 * status filter and the mode toggles, which made a fairly simple page read as
 * three unrelated designs stacked together.
 */

/** Mode toggle: a track of options where exactly one is on. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  size = "sm",
  "aria-label": ariaLabel,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  "aria-label": string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-xl bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          aria-pressed={value === opt.value}
          className={`whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
            size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs"
          } ${
            value === opt.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
          {opt.badge !== undefined && (
            <span className="ml-1.5 tabular-nums opacity-60">{opt.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * The upload indicator: a stroked ring that fills with progress, swapping to a
 * drawn-on checkmark when the server confirms. The ring is a single SVG circle
 * animated through `stroke-dashoffset` so the browser never reflows mid-upload.
 */
function UploadRing({
  percent,
  state,
}: {
  percent: number;
  state: "uploading" | "finalizing" | "done";
}) {
  const reduceMotion = useReducedMotion();
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={state === "done" ? 0 : dashOffset}
          className={`transition-[stroke-dashoffset] duration-300 ease-out ${
            state === "done" ? "stroke-emerald-500" : "stroke-primary"
          }`}
        />
      </svg>

      {/* Centre readout swaps between percentage, a settling spinner, and the tick. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {state === "done" ? (
            <motion.svg
              key="done"
              viewBox="0 0 26 26"
              className="h-10 w-10 text-emerald-500"
              initial={{ scale: reduceMotion ? 1 : 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <motion.path
                d="M6 13.5 L11 18.5 L20.5 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: reduceMotion ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
              />
            </motion.svg>
          ) : state === "finalizing" ? (
            <motion.div
              key="finalizing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </motion.div>
          ) : (
            <motion.div
              key="pct"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline"
            >
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {Math.round(percent)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: TransferStatus }) {
  const styles: Record<TransferStatus, string> = {
    active:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-400/20",
    expired:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-400/20",
    revoked:
      "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-400/20",
  };
  const labels: Record<TransferStatus, string> = {
    active: "Active",
    expired: "Expired",
    revoked: "Revoked",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "active" ? "bg-emerald-500" : status === "expired" ? "bg-amber-500" : "bg-rose-500"
        }`}
      />
      {labels[status]}
    </span>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="hidden h-6 w-20 rounded-md sm:block" />
      <Skeleton className="hidden h-4 w-24 md:block" />
      <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
    </div>
  );
}

export default function FileTransfer() {
  const queryClient = useQueryClient();
  const { clients, fetchClients } = useAgencyStore();
  const reduceMotion = useReducedMotion();

  // Expiry states
  const [expiryType, setExpiryType] = useState<"preset" | "custom">("preset");
  const [expiryPreset, setExpiryPreset] = useState<number>(7);
  const [customExpiryValue, setCustomExpiryValue] = useState<number>(1);
  const [customExpiryUnit, setCustomExpiryUnit] = useState<"minutes" | "hours" | "days">("days");

  const [message, setMessage] = useState("");

  // Real-time uploader metrics
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMeta, setUploadMeta] = useState<UploadMeta | null>(null);
  // The body is fully sent but the API is still zipping/committing the record.
  // Without this the ring would sit at a silent 100% for the whole tail.
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // List controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

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

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Post-upload share popup state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successShareUrl, setSuccessShareUrl] = useState("");
  const [successFileName, setSuccessFileName] = useState("");
  const [successTransferId, setSuccessTransferId] = useState<string | null>(null);
  const [successClientName, setSuccessClientName] = useState<string | null>(null);
  const [successClientEmail, setSuccessClientEmail] = useState<string | null>(null);
  const [successUploadMessage, setSuccessUploadMessage] = useState<string | null>(null);

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

  // Revoke confirmation — replaces the native confirm() this page used to call.
  const [revokeTarget, setRevokeTarget] = useState<TransferItem | null>(null);

  const [activeTransfer, setActiveTransfer] = useState<{ id: string; shareId: string; shareUrl: string; fileName: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wantsToSend, setWantsToSend] = useState(false);

  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  const stateRef = useRef({
    selectedClientId,
    message,
    expiryType,
    expiryPreset,
    customExpiryValue,
    customExpiryUnit,
    clients,
    wantsToSend
  });

  useEffect(() => {
    stateRef.current = {
      selectedClientId,
      message,
      expiryType,
      expiryPreset,
      customExpiryValue,
      customExpiryUnit,
      clients,
      wantsToSend
    };
  }, [selectedClientId, message, expiryType, expiryPreset, customExpiryValue, customExpiryUnit, clients, wantsToSend]);

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
      toast.success("Email sent.");
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
      toast.success("Link revoked and file deleted.");
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
      toast.success("Link renewed.");
      setRenewDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to renew transfer link.");
    },
  });

  const submitTransfer = useCallback(
    async (
      transferId: string,
      shareId: string,
      shareUrl: string,
      fileName: string
    ) => {
      setIsSubmitting(true);
      const {
        selectedClientId: currentClientId,
        message: currentMessage,
        expiryType: currentExpiryType,
        expiryPreset: currentExpiryPreset,
        customExpiryValue: currentCustomExpiryValue,
        customExpiryUnit: currentCustomExpiryUnit,
        clients: currentClients
      } = stateRef.current;

      try {
        const selectedClient = currentClients.find((c) => c.id === currentClientId);

        // Update transfer metadata on the server using PATCH
        await apiFetch(`/transfer/${transferId}`, {
          method: "PATCH",
          body: JSON.stringify({
            clientId: currentClientId,
            message: currentMessage,
            expiryValue: currentExpiryType === "preset" ? currentExpiryPreset : currentCustomExpiryValue,
            expiryUnit: currentExpiryType === "preset" ? "days" : currentCustomExpiryUnit,
          }),
        });

        // Set success states
        setSuccessShareUrl(shareUrl);
        setSuccessFileName(fileName);
        setSuccessTransferId(transferId);
        setSuccessUploadMessage(currentMessage || null);

        if (selectedClient?.email) {
          setSuccessClientName(selectedClient.name);
          setSuccessClientEmail(selectedClient.email);
        } else {
          setSuccessClientName(null);
          setSuccessClientEmail(null);
        }

        // Auto copy generated link to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Upload complete. Link copied to your clipboard.");
        setSuccessDialogOpen(true);

        queryClient.invalidateQueries({ queryKey: ["transfers"] });

        // Reset form. `justCompleted` and `wantsToSend` have to clear too, or the
        // composer keeps showing the finished ring and the next upload submits
        // itself the moment its bytes land.
        setSelectedFiles([]);
        setActiveTransfer(null);
        setMessage("");
        if (noteRichTextRef.current) noteRichTextRef.current.innerHTML = "";
        setSelectedClientId("none");
        setJustCompleted(false);
        setWantsToSend(false);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to submit transfer. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient]
  );

  const uploadFile = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      // Abort any active upload request before starting a new one
      if (activeXhrRef.current) {
        activeXhrRef.current.abort();
        activeXhrRef.current = null;
      }

      const startTime = Date.now();
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
      setUploadProgress(0);
      setUploadMeta({ loaded: 0, total: totalBytes, bytesPerSecond: 0, secondsRemaining: 0 });
      setIsFinalizing(false);
      setJustCompleted(false);

      try {
        const formData = new FormData();
        for (const f of files) {
          formData.append("file", f);
        }

        const {
          expiryType: currentExpiryType,
          expiryPreset: currentExpiryPreset,
          customExpiryValue: currentCustomExpiryValue,
          customExpiryUnit: currentCustomExpiryUnit,
          selectedClientId: currentClientId,
          message: currentMessage
        } = stateRef.current;

        if (currentExpiryType === "preset") {
          formData.append("expiryValue", String(currentExpiryPreset));
          formData.append("expiryUnit", "days");
        } else {
          formData.append("expiryValue", String(currentCustomExpiryValue));
          formData.append("expiryUnit", currentCustomExpiryUnit);
        }

        if (currentMessage) formData.append("message", currentMessage);
        if (currentClientId && currentClientId !== "none") {
          formData.append("clientId", currentClientId);
        }

        const token = useAuthStore.getState().token;

        const data = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeXhrRef.current = xhr;
          xhr.open("POST", `${API_BASE}/transfer/upload`);

          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const loaded = event.loaded;
              const total = event.total;
              const elapsed = (Date.now() - startTime) / 1000; // seconds
              const speed = elapsed > 0 ? loaded / elapsed : 0; // bytes/sec
              const remainingBytes = total - loaded;

              setUploadProgress(Math.round((loaded / total) * 100));
              setUploadMeta({
                loaded,
                total,
                bytesPerSecond: speed,
                secondsRemaining: speed > 0 ? remainingBytes / speed : 0,
              });
            }
          };

          // Body fully flushed to the server — the wait is now server-side.
          xhr.upload.onload = () => setIsFinalizing(true);

          xhr.onload = () => {
            activeXhrRef.current = null;
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

          xhr.onerror = () => {
            activeXhrRef.current = null;
            reject(new Error("Network error during upload"));
          };
          xhr.onabort = () => {
            activeXhrRef.current = null;
            reject(new Error("Upload aborted"));
          };

          xhr.withCredentials = true;
          xhr.send(formData);
        });

        setIsFinalizing(false);
        setJustCompleted(true);

        // Store active transfer
        const shareUrl = getShortShareUrl(data.shareId);
        const activeItem = {
          id: data.id,
          shareId: data.shareId,
          shareUrl,
          fileName: data.fileName || (files.length === 1 ? files[0].name : `${files.length} files`)
        };
        setActiveTransfer(activeItem);

        // Automatically trigger the submission only if wantsToSend is true
        if (stateRef.current.wantsToSend) {
          await submitTransfer(activeItem.id, activeItem.shareId, activeItem.shareUrl, activeItem.fileName);
        }
      } catch (err: any) {
        setIsFinalizing(false);
        if (err.message !== "Upload aborted") {
          console.error(err);
          toast.error(err.message || "Upload failed. Please try again.");
        }
      } finally {
        if (!activeXhrRef.current) {
          setUploadProgress(null);
          setUploadMeta(null);
        }
      }
    },
    [submitTransfer]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setSelectedFiles(prev => {
          const combined = [...prev, ...acceptedFiles].slice(0, MAX_FILES);
          uploadFile(combined);
          return combined;
        });
      }
    },
    [uploadFile]
  );

  const handleSendClick = () => {
    if (selectedFiles.length === 0) return;

    if (uploadProgress !== null) {
      setWantsToSend(true);
    } else if (activeTransfer) {
      submitTransfer(activeTransfer.id, activeTransfer.shareId, activeTransfer.shareUrl, activeTransfer.fileName);
    }
  };

  const handleClearAll = () => {
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setSelectedFiles([]);
    setActiveTransfer(null);
    setUploadProgress(null);
    setUploadMeta(null);
    setIsFinalizing(false);
    setJustCompleted(false);
    setWantsToSend(false);
  };

  const handleRemoveFile = useCallback((idx: number) => {
    setSelectedFiles(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      if (updated.length > 0) {
        uploadFile(updated);
      } else {
        handleClearAll();
      }
      return updated;
    });
  }, [uploadFile]);

  // Without this, anything the dropzone turns away (over MAX_FILE_SIZE, past
  // MAX_FILES) is dropped silently and the file just never appears in the list.
  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const reasons = new Set(
      rejections.flatMap(r =>
        r.errors.map(e => {
          if (e.code === "file-too-large") return `is larger than ${formatBytes(MAX_FILE_SIZE)}`;
          if (e.code === "too-many-files") return `exceeds the ${MAX_FILES}-file limit`;
          return e.message;
        })
      )
    );
    const names = rejections.map(r => r.file.name);
    const label = names.length === 1 ? `"${names[0]}"` : `${names.length} files`;
    toast.error(`${label} couldn't be added — ${[...reasons].join("; ")}.`);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject, open: openFilePicker } = useDropzone({
    onDrop,
    onDropRejected,
    multiple: true,
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE,
    noClick: true,   // the panel holds its own controls; the button opens the picker
    noKeyboard: true,
  });

  const handleCopyLink = (shareId: string) => {
    const shareUrl = getShortShareUrl(shareId);
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(shareId);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleEmailActionClick = (transfer: TransferItem) => {
    setEmailDialogTransfer(transfer);
    setRecipientEmail(transfer.client?.email || "");
    setRecipientName(transfer.client?.name || "");
    setCustomMessage(transfer.message || "");
    setTimeout(() => {
      if (richTextRef.current) {
        richTextRef.current.innerHTML = transfer.message || "";
      }
    }, 100);
    setEmailDialogOpen(true);
  };

  const handleEmailFromSuccessWindow = () => {
    if (!successTransferId) return;

    // Close success dialog
    setSuccessDialogOpen(false);

    // Open email dialog pre-filled with the upload details
    setEmailDialogTransfer({
      id: successTransferId,
      fileName: successFileName,
      expiresAt: new Date().toISOString(),
      shareId: "",
      fileSize: 0,
      mimeType: "",
      downloads: 0,
      client: successClientEmail ? {
        id: "",
        name: successClientName || "",
        email: successClientEmail,
      } : null,
      message: successUploadMessage,
    } as any);

    setRecipientEmail(successClientEmail || "");
    setRecipientName(successClientName || "");
    setCustomMessage(successUploadMessage || "");

    // Prefill the rich text editor with the upload message
    setTimeout(() => {
      if (richTextRef.current) {
        richTextRef.current.innerHTML = successUploadMessage || "";
      }
    }, 100);

    setEmailDialogOpen(true);
  };

  const handleEmailSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailDialogTransfer) return;
    if (!recipientEmail.trim()) {
      toast.error("Enter a valid email address.");
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

  const isUploading = uploadProgress !== null;
  const stagedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const counts = useMemo(() => {
    const base = { all: transfers?.length ?? 0, active: 0, expired: 0, revoked: 0 };
    for (const t of transfers ?? []) base[statusOf(t)]++;
    return base;
  }, [transfers]);

  const summary = useMemo(() => {
    const live = (transfers ?? []).filter((t) => statusOf(t) === "active");
    return {
      activeCount: live.length,
      storedBytes: live.reduce((acc, t) => acc + t.fileSize, 0),
      downloads: (transfers ?? []).reduce((acc, t) => acc + (t.downloadCount || 0), 0),
    };
  }, [transfers]);

  const visibleTransfers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (transfers ?? []).filter((t) => {
      if (statusFilter !== "all" && statusOf(t) !== statusFilter) return false;
      if (!term) return true;
      return (
        t.fileName.toLowerCase().includes(term) ||
        (t.client?.name ?? "").toLowerCase().includes(term) ||
        (t.emailSentTo ?? "").toLowerCase().includes(term)
      );
    });
  }, [transfers, search, statusFilter]);

  // Accounts accumulate a long tail of revoked transfers; unpaginated, the list
  // ran for thousands of pixels below the fold.
  const pageCount = Math.max(1, Math.ceil(visibleTransfers.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * ROWS_PER_PAGE;
  const shownTransfers = visibleTransfers.slice(firstRow, firstRow + ROWS_PER_PAGE);

  // A filter change can strand the viewer on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "expired", label: "Expired" },
    { key: "revoked", label: "Revoked" },
  ];

  /** Action buttons shared by the desktop row and the mobile card. */
  const rowActions = (t: TransferItem) => {
    const isImage = isImageFile(t.fileName) && !t.isDeleted;
    const isVideo = isVideoFile(t.fileName) && !t.isDeleted;
    return (
      <>
        {t.isExpired && !t.isDeleted && (
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-lg text-primary transition-transform hover:bg-primary/10 active:scale-95"
            onClick={() => handleRenewClick(t)}
            title="Renew this expired link"
            aria-label={`Renew link for ${t.fileName}`}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        {(isImage || isVideo) && (
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-lg transition-transform hover:bg-muted active:scale-95"
            onClick={() => handlePreviewClick(t)}
            title="Preview file"
            aria-label={`Preview ${t.fileName}`}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-lg transition-transform hover:bg-muted active:scale-95"
          disabled={t.isExpired || t.isDeleted}
          onClick={() => handleCopyLink(t.shareId)}
          title="Copy share link"
          aria-label={`Copy share link for ${t.fileName}`}
        >
          {copiedId === t.shareId ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-lg transition-transform hover:bg-muted active:scale-95"
          disabled={t.isExpired || t.isDeleted || sendEmailMutation.isPending}
          onClick={() => handleEmailActionClick(t)}
          title={t.emailSentTo ? `Resend — last sent to ${t.emailSentTo}` : "Email this link"}
          aria-label={`Email link for ${t.fileName}`}
        >
          <Mail className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-lg text-muted-foreground transition-transform hover:bg-destructive/10 hover:text-destructive active:scale-95"
          disabled={t.isDeleted}
          onClick={() => setRevokeTarget(t)}
          title="Revoke link and delete the file"
          aria-label={`Revoke link for ${t.fileName}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </>
    );
  };

  const fileThumb = (t: TransferItem, size: string) => {
    const fileUrl = `${API_BASE}/transfer/${t.shareId}/download?preview=true&t=${new Date(t.expiresAt).getTime()}`;
    const isImage = isImageFile(t.fileName) && !t.isDeleted;
    const isVideo = isVideoFile(t.fileName) && !t.isDeleted;

    if (isImage) {
      return (
        <button
          type="button"
          onClick={() => handlePreviewClick(t)}
          className={`${size} shrink-0 overflow-hidden rounded-xl border border-border bg-muted transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          aria-label={`Preview ${t.fileName}`}
        >
          <img src={fileUrl} className="h-full w-full object-cover" alt={`Preview of ${t.fileName}`} />
        </button>
      );
    }
    if (isVideo) {
      return (
        <button
          type="button"
          onClick={() => handlePreviewClick(t)}
          className={`${size} relative shrink-0 overflow-hidden rounded-xl border border-border bg-black transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          aria-label={`Preview ${t.fileName}`}
        >
          <video src={fileUrl} className="h-full w-full object-cover" preload="metadata" muted />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <FileVideo className="h-4 w-4 text-white" />
          </span>
        </button>
      );
    }
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-muted`}>
        {getFileIcon(t.fileName, "h-5 w-5")}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8">
      {/* ---- Header ------------------------------------------------------ */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          File transfer
        </h1>
        <p className="mt-1.5 max-w-[65ch] text-sm text-muted-foreground">
          Upload a file, get a link that expires on its own, and send it to a client.
        </p>
        {/* Inline rather than tiled: three numbers this small don't earn three cards. */}
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            <span className="font-medium tabular-nums text-foreground">{summary.activeCount}</span> active
            {summary.activeCount === 1 ? " link" : " links"}
          </span>
          <span aria-hidden className="text-border">·</span>
          <span>
            <span className="font-medium tabular-nums text-foreground">
              {formatBytes(summary.storedBytes)}
            </span>{" "}
            stored
          </span>
          <span aria-hidden className="text-border">·</span>
          <span>
            <span className="font-medium tabular-nums text-foreground">{summary.downloads}</span>{" "}
            {summary.downloads === 1 ? "download" : "downloads"}
          </span>
        </p>
      </header>

      {/* ---- Composer ---------------------------------------------------- */}
      <section aria-labelledby="new-transfer-heading">
        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-card">
          <CardContent className="p-5 md:p-6">
            <h2 id="new-transfer-heading" className="mb-5 flex items-center gap-2 text-base font-semibold text-foreground">
              <UploadCloud className="h-5 w-5 text-primary" />
              New transfer
            </h2>

            <div className="grid items-stretch gap-6 lg:grid-cols-5">
              {/* --- Dropzone + staged files --- */}
              <div className="flex flex-col gap-4 lg:col-span-3">
                <div
                  {...getRootProps()}
                  className={`relative flex flex-1 overflow-hidden rounded-2xl border-2 border-dashed transition-colors duration-200 ${
                    isDragReject
                      ? "border-destructive bg-destructive/5"
                      : isDragActive
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/20 hover:border-primary/40"
                  }`}
                >
                  <input {...getInputProps()} />

                  {/* A light sweep travels across the panel only while bytes move. */}
                  {isUploading && !reduceMotion && (
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "400%" }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    />
                  )}

                  <div className="relative flex min-h-[260px] w-full flex-col items-center justify-center gap-4 px-6 py-8 text-center">
                    <AnimatePresence mode="wait" initial={false}>
                      {isUploading || justCompleted ? (
                        <motion.div
                          key="uploading"
                          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                          transition={{ duration: 0.2 }}
                          className="flex w-full max-w-sm flex-col items-center gap-4"
                        >
                          <UploadRing
                            percent={uploadProgress ?? 100}
                            state={justCompleted ? "done" : isFinalizing ? "finalizing" : "uploading"}
                          />

                          <div className="w-full space-y-2">
                            <p className="text-sm font-medium text-foreground">
                              {justCompleted
                                ? "Ready to send"
                                : isFinalizing
                                  ? "Finishing on the server"
                                  : `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""}`}
                            </p>
                            {uploadMeta && !justCompleted && (
                              <>
                                <p className="text-xs tabular-nums text-muted-foreground">
                                  {formatBytes(uploadMeta.loaded)} of {formatBytes(uploadMeta.total)}
                                </p>
                                <dl className="mx-auto flex max-w-[260px] items-center justify-center gap-5 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <dt className="sr-only">Transfer speed</dt>
                                    <Activity className="h-3.5 w-3.5" aria-hidden />
                                    <dd className="tabular-nums">{formatBytes(uploadMeta.bytesPerSecond)}/s</dd>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <dt className="sr-only">Time remaining</dt>
                                    <Clock className="h-3.5 w-3.5" aria-hidden />
                                    <dd className="tabular-nums">
                                      {isFinalizing ? "almost done" : formatDuration(uploadMeta.secondsRemaining)}
                                    </dd>
                                  </div>
                                </dl>
                              </>
                            )}
                            {justCompleted && (
                              <p className="text-xs text-muted-foreground">
                                Set the options on the right, then send.
                              </p>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearAll}
                            className="h-8 rounded-lg text-xs text-muted-foreground hover:text-destructive"
                          >
                            {justCompleted ? "Discard and start over" : "Cancel upload"}
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="idle"
                          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-col items-center gap-4"
                        >
                          <motion.div
                            animate={
                              isDragActive && !reduceMotion
                                ? { scale: 1.08, y: -4 }
                                : { scale: 1, y: 0 }
                            }
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                              isDragActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <UploadCloud className="h-7 w-7" />
                          </motion.div>

                          <div className="space-y-1.5">
                            <p className="text-base font-medium text-foreground">
                              {isDragActive ? "Drop them here" : "Drag files here"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Up to {MAX_FILES} files, {formatBytes(MAX_FILE_SIZE)} each. Several files
                              are zipped into one download.
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={openFilePicker}
                            className="h-10 rounded-xl px-5 text-sm font-medium transition-transform active:scale-[0.98]"
                          >
                            Browse files
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Staged files live outside the dropzone so the drop target
                    never disappears once the first file lands. */}
                <AnimatePresence initial={false}>
                  {selectedFiles.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-border bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between px-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            <span className="tabular-nums text-foreground">{selectedFiles.length}</span>{" "}
                            {selectedFiles.length === 1 ? "file" : "files"} ·{" "}
                            <span className="tabular-nums">{formatBytes(stagedBytes)}</span>
                          </p>
                          <button
                            type="button"
                            onClick={handleClearAll}
                            className="rounded text-xs font-medium text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Clear all
                          </button>
                        </div>

                        <ul className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
                          <AnimatePresence initial={false}>
                            {selectedFiles.map((f, idx) => (
                              <motion.li
                                key={`${f.name}-${f.size}-${idx}`}
                                layout={!reduceMotion}
                                initial={{ opacity: 0, x: reduceMotion ? 0 : -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: reduceMotion ? 0 : 8 }}
                                transition={{ duration: 0.18, delay: reduceMotion ? 0 : Math.min(idx * 0.02, 0.2) }}
                                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
                              >
                                {getFileIcon(f.name, "h-5 w-5")}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-foreground" title={f.name}>
                                    {f.name}
                                  </p>
                                  <p className="text-xs tabular-nums text-muted-foreground">
                                    {formatBytes(f.size)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(idx)}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label={`Remove ${f.name}`}
                                  title={`Remove ${f.name}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>

                        <p className="px-1 pt-2 text-xs text-muted-foreground">
                          Removing a file restarts the upload with the files that are left.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* --- Settings --- */}
              <div className="space-y-5 lg:col-span-2">
                {/* Expiry */}
                <fieldset className="space-y-2.5" disabled={isUploading}>
                  <div className="flex items-center justify-between gap-2">
                    <legend className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Link expires after
                    </legend>
                    <Segmented<"preset" | "custom">
                      aria-label="Expiry mode"
                      value={expiryType}
                      onChange={setExpiryType}
                      disabled={isUploading}
                      options={[
                        { value: "preset", label: "Presets" },
                        { value: "custom", label: "Custom" },
                      ]}
                    />
                  </div>

                  {expiryType === "preset" ? (
                    <Segmented
                      aria-label="Expiry duration"
                      size="md"
                      value={String(expiryPreset)}
                      onChange={(v) => setExpiryPreset(Number(v))}
                      disabled={isUploading}
                      options={[
                        { value: "3", label: "3 days" },
                        { value: "7", label: "7 days" },
                        { value: "10", label: "10 days" },
                      ]}
                    />
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        aria-label="Expiry amount"
                        value={customExpiryValue}
                        onChange={(e) => setCustomExpiryValue(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={isUploading}
                        className="h-11 w-24 rounded-xl text-sm tabular-nums"
                      />
                      <Select
                        value={customExpiryUnit}
                        onValueChange={(val: any) => setCustomExpiryUnit(val)}
                        disabled={isUploading}
                      >
                        <SelectTrigger className="h-11 flex-1 rounded-xl text-sm" aria-label="Expiry unit">
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
                </fieldset>

                {/* Client */}
                <div className="space-y-2">
                  <Label htmlFor="client-select" className="text-sm font-medium text-foreground">
                    Client <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                    disabled={isUploading}
                  >
                    <SelectTrigger id="client-select" className="h-11 w-full rounded-xl text-sm">
                      <SelectValue placeholder="No client — just copy the link" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">No client — just copy the link</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company || client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClientId !== "none" && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Mail className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                      You'll get a send-by-email button once the upload finishes.
                    </p>
                  )}
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">
                    Note for the recipient <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <RichTextEditor
                    editorRef={noteRichTextRef}
                    onChange={(html) => setMessage(html)}
                    disabled={isUploading}
                    minHeight="90px"
                    maxHeight="160px"
                    placeholder="Tell them what this file is..."
                  />
                </div>

                <Button
                  onClick={handleSendClick}
                  disabled={selectedFiles.length === 0 || isSubmitting || wantsToSend}
                  className="h-12 w-full rounded-xl text-sm font-semibold transition-transform active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating link
                    </>
                  ) : wantsToSend ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="tabular-nums">Sending at {uploadProgress}%</span>
                    </>
                  ) : selectedClientId !== "none" ? (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Create link for this client
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Create share link
                    </>
                  )}
                </Button>
                {selectedFiles.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Add at least one file to continue.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---- Transfers list ---------------------------------------------- */}
      <section aria-labelledby="transfers-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="transfers-heading" className="text-base font-semibold text-foreground">
            Your transfers
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files or clients"
                aria-label="Search transfers"
                className="h-10 w-full rounded-xl pl-9 text-sm sm:w-60"
              />
            </div>

            <div className="overflow-x-auto">
              <Segmented<StatusFilter>
                aria-label="Filter by status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={filterTabs.map((tab) => ({
                  value: tab.key,
                  label: tab.label,
                  badge: counts[tab.key],
                }))}
              />
            </div>
          </div>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-card">
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : !transfers?.length ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No transfers yet</p>
                <p className="mx-auto max-w-[42ch] text-sm text-muted-foreground">
                  Drop a file in the panel above to create your first self-expiring
                  download link.
                </p>
              </div>
            </div>
          ) : !visibleTransfers.length ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Nothing matches that</p>
                <p className="text-sm text-muted-foreground">
                  Try a different search term or status.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">File</th>
                      <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Recipient</th>
                      <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Activity</th>
                      <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shownTransfers.map((t) => (
                      <tr key={t.id} className="group transition-colors hover:bg-muted/40">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {fileThumb(t, "h-11 w-11")}
                            <div className="min-w-0 max-w-[260px]">
                              <p className="truncate text-sm font-medium text-foreground" title={t.fileName}>
                                {t.fileName}
                              </p>
                              <p className="text-xs tabular-nums text-muted-foreground">
                                {formatBytes(t.fileSize)} · {formatRelative(t.createdAt)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm text-foreground">
                            {t.client?.name ?? <span className="text-muted-foreground">No client</span>}
                          </p>
                          {t.emailSentTo && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="max-w-[180px] truncate">Sent to {t.emailSentTo}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={statusOf(t)} />
                          {!t.isDeleted && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t.isExpired ? "Expired" : "Expires"} {formatRelative(t.expiresAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleLogsClick(t)}
                            className="flex items-center gap-3 rounded-lg text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="View access log"
                          >
                            <span className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              <span className="tabular-nums">{t.viewCount || 0}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="h-3.5 w-3.5" />
                              <span className="tabular-nums">{t.downloadCount || 0}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-0.5">{rowActions(t)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards — the old table forced a horizontal scroll here. */}
              <ul className="divide-y divide-border lg:hidden">
                {shownTransfers.map((t) => (
                  <li key={t.id} className="space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      {fileThumb(t, "h-11 w-11")}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground" title={t.fileName}>
                          {t.fileName}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatBytes(t.fileSize)} · {formatRelative(t.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={statusOf(t)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t.client?.name ?? "No client"}</span>
                      {!t.isDeleted && (
                        <span>
                          {t.isExpired ? "Expired" : "Expires"} {formatRelative(t.expiresAt)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleLogsClick(t)}
                        className="flex items-center gap-3 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{t.viewCount || 0}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{t.downloadCount || 0}</span>
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5">{rowActions(t)}</div>
                  </li>
                ))}
              </ul>

              {/* Pager */}
              <nav
                aria-label="Transfer list pages"
                className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row sm:px-5"
              >
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {firstRow + 1}–{firstRow + shownTransfers.length}
                  </span>{" "}
                  of <span className="font-medium tabular-nums text-foreground">{visibleTransfers.length}</span>
                </p>

                {pageCount > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {pageWindow(currentPage, pageCount).map((p, i) =>
                      p === "gap" ? (
                        <span
                          key={`gap-${i}`}
                          aria-hidden
                          className="px-1 text-xs text-muted-foreground"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          aria-label={`Page ${p}`}
                          aria-current={p === currentPage ? "page" : undefined}
                          className={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            p === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setPage(currentPage + 1)}
                      disabled={currentPage === pageCount}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </nav>
            </>
          )}
        </Card>
      </section>

      {/* ---- Revoke confirmation ----------------------------------------- */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{revokeTarget?.fileName}</span> is
              deleted from the server straight away and the link stops working. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeTarget) deleteMutation.mutate(revokeTarget.id);
                setRevokeTarget(null);
              }}
            >
              Revoke and delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Email dialog ------------------------------------------------ */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        setEmailDialogOpen(open);
        if (!open) {
          setCustomMessage("");
          if (richTextRef.current) richTextRef.current.innerHTML = "";
        }
      }}>
        <DialogContent className="max-w-[520px] rounded-2xl">
          <form onSubmit={handleEmailSendSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email this link
              </DialogTitle>
              <DialogDescription>
                The recipient gets the download link and your note. The link still expires on
                schedule.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="dialog-email" className="text-sm font-medium">
                  Recipient email
                </Label>
                <Input
                  id="dialog-email"
                  type="email"
                  placeholder="name@company.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialog-name" className="text-sm font-medium">
                  Recipient name <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="dialog-name"
                  type="text"
                  placeholder="Amina Yusuf"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Message <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <RichTextEditor
                  editorRef={richTextRef}
                  onChange={(html) => setCustomMessage(html)}
                  minHeight="110px"
                  maxHeight="220px"
                  placeholder="Appears at the top of the email..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEmailDialogOpen(false);
                  setCustomMessage("");
                  if (richTextRef.current) richTextRef.current.innerHTML = "";
                }}
                className="h-10 rounded-xl text-sm font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sendEmailMutation.isPending}
                className="h-10 rounded-xl text-sm font-semibold"
              >
                {sendEmailMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send email
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Success dialog ---------------------------------------------- */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="max-w-[440px] rounded-2xl">
          <DialogHeader className="items-center text-center">
            <motion.div
              initial={{ scale: reduceMotion ? 1 : 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 340, damping: 20 }}
              className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50"
            >
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <DialogTitle>Your link is ready</DialogTitle>
            <DialogDescription className="max-w-[340px] truncate" title={successFileName}>
              {successFileName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="share-url" className="text-sm font-medium">
                Share link <span className="font-normal text-muted-foreground">— already copied</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="share-url"
                  value={successShareUrl}
                  readOnly
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="h-11 rounded-xl font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(successShareUrl).then(() => {
                      toast.success("Link copied to clipboard.");
                    });
                  }}
                  className="h-11 shrink-0 rounded-xl px-4 transition-transform active:scale-95"
                  aria-label="Copy share link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="rounded-xl bg-white p-2">
                <QRCodeSVG value={successShareUrl} size={84} />
              </div>
              <p className="text-sm text-muted-foreground">
                Scan to open the download on a phone.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {successClientEmail && (
              <Button
                onClick={handleEmailFromSuccessWindow}
                className="h-11 w-full rounded-xl text-sm font-semibold"
              >
                <Send className="mr-2 h-4 w-4" />
                Email {successClientName || "the client"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setSuccessDialogOpen(false)}
              className="h-11 w-full rounded-xl text-sm font-medium"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Renew dialog ------------------------------------------------ */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-[440px] rounded-2xl">
          <form onSubmit={handleRenewSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Renew this link
              </DialogTitle>
              <DialogDescription>
                Give the file a new expiry so it can be downloaded again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Available for</Label>
                <Segmented<"preset" | "custom">
                  aria-label="Renewal mode"
                  value={renewType}
                  onChange={setRenewType}
                  options={[
                    { value: "preset", label: "Presets" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </div>

              {renewType === "preset" ? (
                <Segmented
                  aria-label="Renewal duration"
                  size="md"
                  value={String(renewPreset)}
                  onChange={(v) => setRenewPreset(Number(v))}
                  options={[
                    { value: "3", label: "3 days" },
                    { value: "7", label: "7 days" },
                    { value: "10", label: "10 days" },
                  ]}
                />
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    aria-label="Renewal amount"
                    value={customRenewValue}
                    onChange={(e) => setCustomRenewValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-11 w-24 rounded-xl text-sm tabular-nums"
                  />
                  <Select
                    value={customRenewUnit}
                    onValueChange={(val: any) => setCustomRenewUnit(val)}
                  >
                    <SelectTrigger className="h-11 flex-1 rounded-xl text-sm" aria-label="Renewal unit">
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

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenewDialogOpen(false)}
                className="h-10 rounded-xl text-sm font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renewMutation.isPending}
                className="h-10 rounded-xl text-sm font-semibold"
              >
                {renewMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Renewing
                  </>
                ) : (
                  "Renew link"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Access log dialog ------------------------------------------- */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Access log
            </DialogTitle>
            <DialogDescription className="max-w-[420px] truncate" title={logsDialogTransfer?.fileName}>
              Every view and download of {logsDialogTransfer?.fileName}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {loadingEvents ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))
            ) : !transferEvents.length ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Activity className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nobody has opened this link yet.
                </p>
              </div>
            ) : (
              transferEvents.map((evt: any) => (
                <div
                  key={evt.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          evt.eventType === "DOWNLOAD"
                            ? "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-400/20"
                            : "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-400/20"
                        }`}
                      >
                        {evt.eventType === "DOWNLOAD" ? "Download" : "View"}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {evt.ipAddress || "Unknown IP"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground" title={evt.userAgent}>
                      {evt.userAgent || "Unknown browser"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatRelative(evt.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogsDialogOpen(false)}
              className="h-10 w-full rounded-xl text-sm font-medium"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- File preview ------------------------------------------------ */}
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
