// Post status presentation. Deliberately social-post specific: the identically
// named status maps on the invoice and HR pages cover different vocabularies and
// must not be merged with this one.

export const getStatusStyle = (status: string) => {
  switch (status) {
    case "DRAFT":
      return { text: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800", dot: "bg-slate-400" };
    case "AWAITING_APPROVAL":
      return { text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/20", border: "border-sky-200 dark:border-sky-900/50", dot: "bg-sky-500" };
    case "SCHEDULED":
      return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/50", dot: "bg-amber-500" };
    case "PUBLISHED":
      return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/50", dot: "bg-emerald-500" };
    case "PARTIAL":
      return { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-900/50", dot: "bg-amber-500" };
    case "FAILED":
      return { text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-900/50", dot: "bg-rose-500" };
    default:
      return { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400" };
  }
};

export function formatPostStatus(status: string): string {
  if (status === "PARTIAL") return "PARTIAL SUCCESS";
  return status.replace(/_/g, " ");
}
