import { useState } from 'react';
import { Mail } from 'lucide-react';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import { EmailSidebar } from '@/components/email/EmailSidebar';
import { ConversationList } from '@/components/email/ConversationList';
import { ConversationView } from '@/components/email/ConversationView';
import { ComposeModal, type ComposeInitial } from '@/components/email/ComposeModal';
import { useMailboxes } from '@/lib/email/hooks';
import { useEmailStream } from '@/lib/email/useEmailStream';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>();

  const { data: mailboxes = [] } = useMailboxes();
  useEmailStream();

  const openCompose = (initial?: ComposeInitial) => {
    setComposeInitial(initial);
    setComposeOpen(true);
  };

  const handleFolder = (f: EmailFolder) => {
    setFolder(f);
    setSelectedId(null);
  };

  return (
    <div className="h-[calc(100dvh-8rem)] min-h-[520px]">
      <ResizablePanelGroup direction="horizontal" className="h-full overflow-hidden rounded-xl border bg-background shadow-sm">
        <ResizablePanel defaultSize={18} minSize={13} maxSize={26}>
          <EmailSidebar
            folder={folder}
            onFolder={handleFolder}
            mailboxId={mailboxId}
            onMailbox={setMailboxId}
            mailboxes={mailboxes}
            onCompose={() => openCompose()}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={32} minSize={24}>
          <ConversationList
            folder={folder}
            mailboxId={mailboxId}
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
