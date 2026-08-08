import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Building2, Mail, Phone, MapPin, ExternalLink, Link2, Link2Off, Search, Loader2, FileText, Sparkles,
} from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCustomer, useLinkClient } from '@/lib/email/hooks';
import { emailApi } from '@/lib/email/api';
import { initials, avatarColor, listTime } from '@/lib/email/format';
import type { ClientLite } from '@/lib/email/types';

export function CustomerPanel({ conversationId, open, onClose }: { conversationId: string; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data, isLoading } = useCustomer(open ? conversationId : null);
  const link = useLinkClient(conversationId);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ClientLite[]>([]);
  const [searching, setSearching] = useState(false);

  const customer = data?.customer ?? null;
  const suggested = data?.suggested ?? false;

  const search = async (value: string) => {
    setQ(value);
    if (value.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await emailApi.searchClients(value.trim());
      setResults(res.clients);
    } finally {
      setSearching(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:w-[360px] sm:max-w-none">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">Customer</SheetTitle>
        </SheetHeader>

        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : customer ? (
            <div className="space-y-4">
              {suggested && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1">Suggested match by email.</span>
                  <Button size="sm" className="h-7 text-xs" onClick={() => link.mutate(customer.id)} disabled={link.isPending}>
                    Link
                  </Button>
                </div>
              )}

              {/* Identity */}
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(customer.email || customer.name)}`}>
                  {initials(customer.name, customer.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{customer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{customer.company}</p>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-1.5 text-sm">
                {customer.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> <span className="truncate">{customer.email}</span></div>}
                {customer.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {customer.phone}</div>}
                {(customer.city || customer.country) && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {[customer.city, customer.country].filter(Boolean).join(', ')}</div>}
                <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> <Badge variant="secondary" className="text-[10px]">{customer.status}</Badge></div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Invoices" value={customer._count.invoices} />
                <Stat label="Projects" value={customer._count.projects} />
                <Stat label="Emails" value={customer._count.emailConversations} />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => navigate(`/dashboard/clients/view/${customer.id}`)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open customer
                </Button>
                {!suggested && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => link.mutate(null)} disabled={link.isPending}>
                    <Link2Off className="h-3.5 w-3.5" /> Unlink
                  </Button>
                )}
              </div>

              {/* Recent invoices */}
              {customer.invoices.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Recent invoices</p>
                  <div className="space-y-1">
                    {customer.invoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => navigate(`/dashboard/invoices/view/${inv.id}`)}
                        className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{inv.invoiceNumber}</span>
                        <span className="text-muted-foreground">{Number(inv.amount).toLocaleString()}</span>
                        <Badge variant="outline" className="text-[9px]">{inv.status}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent conversations */}
              {customer.emailConversations.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Other conversations</p>
                  <div className="space-y-1">
                    {customer.emailConversations.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                        <span className="flex-1 truncate">{c.subject || '(no subject)'}</span>
                        {c.unreadCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        <span className="text-muted-foreground">{listTime(c.lastMessageAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Not linked — search to link
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
                <User className="h-8 w-8 opacity-40" />
                <p className="text-sm">No customer linked to this conversation.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => search(e.target.value)} placeholder="Search clients to link…" className="h-9 pl-8 text-sm" />
              </div>
              {searching && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
              <div className="space-y-1">
                {results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => link.mutate(c.id)}
                    className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.company}{c.email ? ` · ${c.email}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
