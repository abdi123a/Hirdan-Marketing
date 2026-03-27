import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgencyStore, Client } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Building2, User, Mail, Plus } from "lucide-react";

interface QuickAddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (client: Client) => void;
}

export function QuickAddClientModal({ open, onOpenChange, onSuccess }: QuickAddClientModalProps) {
  const { addClient } = useAgencyStore();
  const { toast } = useToast();
  
  const [type, setType] = useState<"Business" | "Individual">("Business");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (type === "Business" && !company.trim()) e.company = "Company is required";
    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
      const newClient = await addClient({
        name,
        company,
        email,
        type,
        initials,
        status: "Active",
        phone: "",
        website: "",
        address: "",
        city: "",
        country: "",
        industry: "",
        revenue: "$0",
        projects: 0,
        notes: "",
      });
      
      toast({ title: "Client added!", description: `${name} has been added.` });
      onSuccess(newClient as Client);
      onOpenChange(false);
      
      // Reset form
      setName("");
      setCompany("");
      setEmail("");
      setErrors({});
    } catch (err) {
      toast({ title: "Error", description: "Failed to add client.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Quick Add Client
          </DialogTitle>
          <DialogDescription>
            Basic details for the new client.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="flex bg-muted/50 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setType("Business")}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm transition-all ${
                type === "Business" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Building2 className="h-4 w-4" /> Business
            </button>
            <button
              type="button"
              onClick={() => setType("Individual")}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm transition-all ${
                type === "Individual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <User className="h-4 w-4" /> Individual
            </button>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {type === "Business" && (
              <div className="space-y-2">
                <Label htmlFor="quick-company">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quick-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Corp"
                  className={errors.company ? "border-destructive" : ""}
                />
                {errors.company && <p className="text-xs text-destructive">{errors.company}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quick-email">Email Address</Label>
              <Input
                id="quick-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={loading}>
              {loading ? "Adding..." : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
