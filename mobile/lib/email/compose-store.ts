import { create } from 'zustand';

export interface ComposeInitial {
  mailboxId?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  html?: string;
  draftId?: string;
}

interface ComposeState {
  initial: ComposeInitial | null;
  /** Stash the seed for the compose screen, which reads it on mount. */
  setInitial: (initial: ComposeInitial | null) => void;
  take: () => ComposeInitial | null;
}

/**
 * Compose seeds can carry a full quoted HTML body, which is far too large for
 * router params, so the compose screen picks it up from here instead.
 */
export const useComposeStore = create<ComposeState>((set, get) => ({
  initial: null,
  setInitial: (initial) => set({ initial }),
  take: () => {
    const { initial } = get();
    set({ initial: null });
    return initial;
  },
}));
