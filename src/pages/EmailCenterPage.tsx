import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Mail, Menu, PenSquare } from 'lucide-react';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { EmailSidebar } from '@/components/email/EmailSidebar';
import { ConversationList } from '@/components/email/ConversationList';
import { ConversationView } from '@/components/email/ConversationView';
import { ComposeModal, type ComposeInitial } from '@/components/email/ComposeModal';
import { useMailboxes } from '@/lib/email/hooks';
import { useEmailStream } from '@/lib/email/useEmailStream';
import { useIsMobile } from '@/hooks/use-mobile';
import { apiFetch } from '@/lib/api-client';
import type { Draft, EmailFolder, EmailMessage } from '@/lib/email/types';

function forwardHtml(email: EmailMessage): string {
  return `<br/><br/><div style="border-left:3px solid #e2e8f0;padding-left:12px;color:#475569">
    ---------- Forwarded message ----------<br/>
    From: ${email.fromName || ''} &lt;${email.fromEmail}&gt;<br/>
    Subject: ${email.subject || ''}<br/>
    To: ${(email.toEmails ?? []).join(', ')}<br/><br/>
    ${email.html || (email.text || '')}
  </div>`;
}

function draftToInitial(d: Draft): ComposeInitial {
  return {
    mailboxId: d.mailboxId ?? undefined,
    to: d.toEmails ?? [],
    cc: d.ccEmails ?? [],
    subject: d.subject ?? '',
    html: d.html ?? '',
    draftId: d.id,
  };
}

export default function EmailCenterPage() {
  const [folder, setFolder] = useState<EmailFolder>('inbox');
  const [mailboxId, setMailboxId] = useState<string | undefined>();
  const [labelId, setLabelId] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mailConfigIssue, setMailConfigIssue] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const { data: mailboxes = [] } = useMailboxes();
  useEmailStream();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ canSend?: boolean; canReceive?: boolean }>('/settings/email');
        if (cancelled) return;
        if (!res.canSend && !res.canReceive) {
          setMailConfigIssue(
            'Email is not configured — sending and receiving are both blocked until Resend credentials are saved.'
          );
        } else if (!res.canReceive) {
          setMailConfigIssue(
            'Inbound email is blocked — add the Resend webhook signing secret in Settings → Email so Email Center can receive mail.'
          );
        } else if (!res.canSend) {
          setMailConfigIssue(
            'Outbound email is not configured — add a Resend API key and From address in Settings → Email.'
          );
        } else {
          setMailConfigIssue(null);
        }
      } catch {
        // Non-admin users may not access /settings/email; ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCompose = (initial?: ComposeInitial) => {
    setComposeInitial(initial);
    setComposeOpen(true);
  };

  const handleFolder = (f: EmailFolder) => {
    setFolder(f);
    setSelectedId(null);
    setLabelId(undefined);
    setMobileDrawerOpen(false);
  };

  const handleMailbox = (id?: string) => {
    setMailboxId(id);
    setMobileDrawerOpen(false);
  };

  const handleLabel = (id?: string) => {
    setLabelId(id);
    setSelectedId(null);
    setMobileDrawerOpen(false);
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-8rem)] min-h-[500px] flex-col gap-3">
      {mailConfigIssue && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm shrink-0">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground/90">{mailConfigIssue}</p>
            <Link
              to="/dashboard/settings?tab=email"
              className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline"
            >
              Open Email Settings →
            </Link>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">
      {isMobile ? (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
          {/* Mobile Header */}
          <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Email Navigation</SheetTitle>
                  </SheetHeader>
                  <EmailSidebar
                    folder={folder}
                    onFolder={handleFolder}
                    mailboxId={mailboxId}
                    onMailbox={handleMailbox}
                    mailboxes={mailboxes}
                    onCompose={() => {
                      setMobileDrawerOpen(false);
                      openCompose();
                    }}
                    labelId={labelId}
                    onLabel={handleLabel}
                  />
                </SheetContent>
              </Sheet>
              <span className="text-sm font-semibold capitalize">{folder}</span>
            </div>
            <Button
              size="sm"
              onClick={() => openCompose()}
              className="gap-1.5 rounded-lg h-8 px-2.5 text-xs shadow-sm"
            >
              <PenSquare className="h-3.5 w-3.5" />
              Compose
            </Button>
          </div>

          {/* Mobile Main Content: View Stack */}
          <div className="flex-1 overflow-hidden">
            {selectedId ? (
              <ConversationView
                conversationId={selectedId}
                mailboxes={mailboxes}
                onBack={() => setSelectedId(null)}
                onForward={(e) =>
                  openCompose({ mailboxId: e.mailboxId, subject: `Fwd: ${e.subject || ''}`, html: forwardHtml(e) })
                }
              />
            ) : (
              <ConversationList
                folder={folder}
                mailboxId={mailboxId}
                labelId={labelId}
                onClearLabel={() => setLabelId(undefined)}
                selectedId={selectedId}
                onSelectConversation={setSelectedId}
                onOpenDraft={(d) => openCompose(draftToInitial(d))}
              />
            )}
          </div>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="h-full overflow-hidden rounded-xl border bg-background shadow-sm">
          <ResizablePanel defaultSize={18} minSize={13} maxSize={26}>
            <EmailSidebar
              folder={folder}
              onFolder={handleFolder}
              mailboxId={mailboxId}
              onMailbox={setMailboxId}
              mailboxes={mailboxes}
              onCompose={() => openCompose()}
              labelId={labelId}
              onLabel={handleLabel}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={32} minSize={24}>
            <ConversationList
              folder={folder}
              mailboxId={mailboxId}
              labelId={labelId}
              onClearLabel={() => setLabelId(undefined)}
              selectedId={selectedId}
              onSelectConversation={setSelectedId}
              onOpenDraft={(d) => openCompose(draftToInitial(d))}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            {selectedId ? (
              <ConversationView
                conversationId={selectedId}
                mailboxes={mailboxes}
                onBack={() => setSelectedId(null)}
                onForward={(e) =>
                  openCompose({ mailboxId: e.mailboxId, subject: `Fwd: ${e.subject || ''}`, html: forwardHtml(e) })
                }
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Mail className="h-12 w-12 opacity-25" />
                <div className="text-center">
                  <p className="text-sm font-medium">Your Email Center</p>
                  <p className="text-xs">Select a conversation, or compose a new message.</p>
                </div>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        mailboxes={mailboxes}
        initial={composeInitial}
        onSent={() => setComposeInitial(undefined)}
      />
    </div>
  );
}
