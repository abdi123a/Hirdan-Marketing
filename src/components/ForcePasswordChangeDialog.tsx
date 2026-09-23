import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Blocking dialog shown to staff whose account was provisioned with a
 * temporary password. The API refuses everything except auth endpoints until
 * the password is changed.
 */
export function ForcePasswordChangeDialog({ onLogout }: { onLogout: () => void }) {
  const { setToken, setPasswordChangeRequired } = useAuthStore();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ accessToken?: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (res.accessToken) setToken(res.accessToken);
      setPasswordChangeRequired(false);
      // Data requests made while the change was pending were refused; start fresh.
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Unable to change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            Your account uses a temporary password. Choose a new one to continue. It must be at least
            8 characters and include upper- and lowercase letters, a number and a special character.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fpc-current">Current (temporary) password</Label>
            <Input
              id="fpc-current"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fpc-new">New password</Label>
            <Input
              id="fpc-new"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fpc-confirm">Confirm new password</Label>
            <Input
              id="fpc-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onLogout}>
              Log out
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.currentPassword || !form.newPassword || !form.confirmPassword}
            >
              {saving ? "Saving..." : "Change password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
