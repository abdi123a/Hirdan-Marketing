import React from "react";

/** Thin animated shimmer bar */
const Shimmer: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-muted/70 rounded-lg ${className}`} />
);

/** Skeleton for list/table pages (Clients, Projects, Invoices, etc.) */
export const TablePageSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>
      <Shimmer className="h-10 w-32 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-xl p-4 space-y-2 bg-card">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-7 w-12" />
        </div>
      ))}
    </div>
    <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <Shimmer className="h-5 w-36" />
        <Shimmer className="h-9 w-48 rounded-lg" />
      </div>
      <div className="divide-y divide-border/40">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Shimmer className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Shimmer className={`h-4 ${i % 3 === 0 ? 'w-40' : i % 3 === 1 ? 'w-32' : 'w-52'}`} />
              <Shimmer className={`h-3 ${i % 2 === 0 ? 'w-28' : 'w-36'}`} />
            </div>
            <Shimmer className="h-5 w-16 rounded-full hidden sm:block" />
            <Shimmer className="h-4 w-20 hidden md:block" />
            <Shimmer className="h-8 w-8 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Skeleton for detail/view pages (InvoiceDetails, ProjectDetails, etc.) */
export const DetailPageSkeleton: React.FC = () => (
  <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-300">
    <div className="flex items-center gap-4">
      <Shimmer className="h-10 w-10 rounded-full shrink-0" />
      <div className="space-y-2">
        <Shimmer className="h-8 w-64" />
        <Shimmer className="h-4 w-40" />
      </div>
      <div className="ml-auto flex gap-2">
        <Shimmer className="h-9 w-24 rounded-xl" />
        <Shimmer className="h-9 w-24 rounded-xl" />
      </div>
    </div>
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary/30 to-transparent" />
          <div className="p-6 space-y-4">
            <Shimmer className="h-5 w-36" />
            <div className="grid sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Shimmer className="h-3 w-20" />
                  <Shimmer className="h-5 w-32" />
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-border/40 space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-5/6" />
              <Shimmer className="h-4 w-4/6" />
            </div>
          </div>
        </div>
        <div className="border border-border/50 rounded-xl bg-card p-6 space-y-4">
          <Shimmer className="h-5 w-44" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30">
                <Shimmer className="h-4 w-24" />
                <Shimmer className="h-4 flex-1" />
                <Shimmer className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="border border-border/50 rounded-xl bg-card p-5 space-y-4">
          <Shimmer className="h-5 w-28" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="border border-border/50 rounded-xl bg-card p-5 space-y-3">
          <Shimmer className="h-5 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/** Skeleton for dashboard/overview pages with stat cards + charts */
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 pb-10 animate-in fade-in duration-300">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-52" />
        <Shimmer className="h-4 w-72" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-10 w-32 rounded-xl" />
        <Shimmer className="h-10 w-32 rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-xl bg-card p-5 space-y-3">
          <div className="flex justify-between">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-8 rounded-lg" />
          </div>
          <Shimmer className="h-8 w-20" />
          <Shimmer className="h-3 w-28" />
        </div>
      ))}
    </div>
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 border border-border/50 rounded-xl bg-card p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-8 w-32 rounded-lg" />
        </div>
        <Shimmer className="h-[220px] w-full rounded-xl" />
      </div>
      <div className="border border-border/50 rounded-xl bg-card p-6 space-y-4">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-[180px] w-full rounded-xl" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Shimmer className="h-3 w-3 rounded-sm" />
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-3 w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      {[...Array(2)].map((_, j) => (
        <div key={j} className="border border-border/50 rounded-xl bg-card overflow-hidden">
          <div className="p-4 border-b border-border/40">
            <Shimmer className="h-5 w-36" />
          </div>
          <div className="divide-y divide-border/30">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Shimmer className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Shimmer className="h-4 w-32" />
                  <Shimmer className="h-3 w-20" />
                </div>
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Skeleton for kanban/task board pages */
export const KanbanSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-56" />
        <Shimmer className="h-4 w-72" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-9 w-36 rounded-xl" />
        <Shimmer className="h-9 w-36 rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-xl bg-card p-4 space-y-2">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-7 w-10" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[...Array(3)].map((_, col) => (
        <div key={col} className="border border-border/50 rounded-xl bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Shimmer className="h-4 w-4 rounded-full" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-5 w-7 rounded-full ml-auto" />
          </div>
          {[...Array(col + 2)].map((_, i) => (
            <div key={i} className="border border-border/50 rounded-xl bg-card p-4 space-y-3">
              <div className="flex justify-between">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
              <Shimmer className="h-3 w-full" />
              <Shimmer className="h-3 w-4/5" />
              <div className="flex items-center gap-2 pt-1">
                <Shimmer className="h-6 w-6 rounded-full" />
                <Shimmer className="h-3 w-20" />
                <Shimmer className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Skeleton for social media/cards grid pages */
export const CardGridSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-52" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-9 w-32 rounded-xl" />
        <Shimmer className="h-9 w-32 rounded-xl" />
      </div>
    </div>
    <div className="flex gap-2 flex-wrap">
      {[...Array(5)].map((_, i) => (
        <Shimmer key={i} className="h-8 w-24 rounded-full" />
      ))}
    </div>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-2xl bg-card overflow-hidden">
          <Shimmer className="aspect-video w-full rounded-none" />
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              {[...Array(3)].map((_, j) => (
                <Shimmer key={j} className="h-5 w-5 rounded-full" />
              ))}
              <Shimmer className="h-5 w-16 rounded-full ml-auto" />
            </div>
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-4/5" />
            <div className="flex gap-2 pt-1">
              <Shimmer className="h-8 flex-1 rounded-lg" />
              <Shimmer className="h-8 flex-1 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Skeleton for financial/report pages */
export const ReportSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-52" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-10 w-40 rounded-xl" />
        <Shimmer className="h-10 w-32 rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-xl bg-card p-5 space-y-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-7 w-28" />
          <Shimmer className="h-3 w-16" />
        </div>
      ))}
    </div>
    <div className="border border-border/50 rounded-xl bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Shimmer className="h-5 w-40" />
        <div className="flex gap-2">
          <Shimmer className="h-8 w-24 rounded-lg" />
          <Shimmer className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <Shimmer className="h-[280px] w-full rounded-xl" />
    </div>
    <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
      <div className="p-4 border-b border-border/40">
        <Shimmer className="h-5 w-40" />
      </div>
      <div className="divide-y divide-border/30">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 flex-1" />
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Skeleton for social accounts page */
export const AccountsSkeleton: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-52" />
        <Shimmer className="h-4 w-64" />
      </div>
      <Shimmer className="h-10 w-40 rounded-xl" />
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-xl bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Shimmer className="h-12 w-12 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-24" />
            </div>
            <Shimmer className="h-8 w-8 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="space-y-1">
                <Shimmer className="h-5 w-12" />
                <Shimmer className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Shimmer className="h-8 flex-1 rounded-lg" />
            <Shimmer className="h-8 flex-1 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/** Skeleton for edit/form pages */
export const FormPageSkeleton: React.FC = () => (
  <div className="space-y-6 max-w-[900px] animate-in fade-in duration-300">
    <div className="flex items-center gap-4">
      <Shimmer className="h-10 w-10 rounded-full shrink-0" />
      <div className="space-y-2">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>
    </div>
    <div className="border border-border/50 rounded-xl bg-card p-6 space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-24 w-full rounded-lg" />
      </div>
    </div>
    <div className="flex justify-end gap-3">
      <Shimmer className="h-10 w-24 rounded-xl" />
      <Shimmer className="h-10 w-32 rounded-xl" />
    </div>
  </div>
);

/** Generic inline table skeleton (for use inside cards) */
export const InlineTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="animate-pulse">
    <div className="flex gap-4 px-4 py-3 border-b border-border/40">
      {[...Array(4)].map((_, i) => (
        <Shimmer key={i} className={`h-3 ${i === 0 ? 'w-28' : i === 1 ? 'flex-1' : 'w-20'}`} />
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/20">
        <Shimmer className="h-4 w-28" />
        <Shimmer className="h-4 flex-1" />
        <Shimmer className="h-5 w-16 rounded-full" />
        <Shimmer className="h-4 w-16" />
      </div>
    ))}
  </div>
);

/** The main Suspense fallback used in DashboardLayout */
export const SuspenseFallback: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-52" />
        <Shimmer className="h-4 w-72" />
      </div>
      <Shimmer className="h-10 w-36 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border/50 rounded-xl bg-card p-5 space-y-3">
          <div className="flex justify-between items-start">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-8 rounded-lg" />
          </div>
          <Shimmer className="h-7 w-16" />
          <Shimmer className="h-3 w-28" />
        </div>
      ))}
    </div>
    <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <Shimmer className="h-5 w-36" />
        <Shimmer className="h-9 w-52 rounded-lg" />
      </div>
      <div className="divide-y divide-border/30">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Shimmer className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Shimmer className={`h-4 ${i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-36' : 'w-56'}`} />
              <Shimmer className={`h-3 ${i % 2 === 0 ? 'w-28' : 'w-36'}`} />
            </div>
            <Shimmer className="h-5 w-16 rounded-full hidden sm:block" />
            <Shimmer className="h-4 w-20 hidden md:block" />
            <Shimmer className="h-4 w-24 hidden lg:block" />
            <Shimmer className="h-8 w-8 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
