import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, User as UserIcon, Mail, Shield, Lock, Link as LinkIcon, AlertCircle, ExternalLink } from "lucide-react";
import { useAgencyStore, User } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ROLES = ["ADMIN", "MANAGER", "STAFF", "CLIENT"];

export default function AddUserPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { users, team, clients, addUser, updateUser, fetchUsers, fetchTeam, fetchClients } = useAgencyStore();
  const { toast } = useToast();

  const isEdit = !!id;
  const existingUser = users.find(u => u.id === id);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF" as User["role"],
    teamMemberId: "" as string | null,
    clientId: "" as string | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflictUser, setConflictUser] = useState<User | null>(null);

  useEffect(() => {
    fetchTeam();
    fetchClients();
    fetchUsers();
  }, [fetchTeam, fetchClients, fetchUsers]);

  useEffect(() => {
    if (isEdit && existingUser) {
      setForm({
        name: existingUser.name,
        email: existingUser.email,
        password: "", // Don't show password hash
        role: existingUser.role,
        teamMemberId: existingUser.teamMember?.id || "",
        clientId: existingUser.client?.id || "",
      });
    }
  }, [isEdit, existingUser]);

  // Check for email conflicts in the frontend
  useEffect(() => {
    if (!isEdit && form.email) {
      const conflict = users.find(u => (u.email || "").toLowerCase() === form.email.toLowerCase());
      setConflictUser(conflict || null);
    } else {
      setConflictUser(null);
    }
  }, [form.email, users, isEdit]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email address";
    if (!isEdit && !form.password) e.password = "Password is required";
    else if (form.password && form.password.length < 6) e.password = "Password must be at least 6 characters";
    
    if (conflictUser) {
      e.email = "A user with this email already exists";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleTeamMemberSelect = (memberId: string) => {
    if (memberId === "none") {
      setForm(f => ({ ...f, teamMemberId: null }));
      return;
    }

    const member = team.find(m => m.id === memberId);
    if (member) {
      setForm(f => ({
        ...f,
        teamMemberId: memberId,
        name: member.name,
        email: member.email,
      }));
      
      // If the member is already linked to a user, inform the user
      if (member.userId) {
        const linkedUser = users.find(u => u.id === member.userId);
        if (linkedUser && !isEdit) {
           toast({
             title: "Team Member Already Linked",
             description: `${member.name} already has a user account. You might want to edit the existing account instead.`,
           });
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
        teamMemberId: form.teamMemberId || null,
      };

      if (isEdit) {
        await updateUser(id!, payload);
        toast({ title: "User Updated", description: `${form.name} has been updated.` });
      } else {
        await addUser(payload as any);
        toast({ title: "User Added", description: `${form.name} has been added to the system.` });
      }
      navigate("/dashboard/users");
    } catch (e: any) {
      toast({ 
        title: "Error", 
        description: e.message || `Failed to ${isEdit ? "update" : "add"} user.`, 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted font-heading">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-foreground tracking-tight">
            {isEdit ? "Edit User Access" : "Create User Access"}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {isEdit ? "Update account details and permissions" : "Grant system access to a team member or employee"}
          </p>
        </div>
      </div>

      {!isEdit && (
        <Alert className="bg-primary/5 border-primary/20">
          <LinkIcon className="h-4 w-4 text-primary" />
          <AlertTitle className="text-sm font-semibold">Pro Tip</AlertTitle>
          <AlertDescription className="text-xs">
            Select a team member first to automatically fill their name and email.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Step 1: Link Profile */}
        <Card className="shadow-premium border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 font-heading">
              <LinkIcon className="h-4 w-4 text-primary" /> Profile Linking
            </CardTitle>
            <CardDescription className="text-xs">
              Link this system user to an existing profile in the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Team Profile (Optional)</Label>
                <Select value={form.teamMemberId || "none"} onValueChange={handleTeamMemberSelect}>
                  <SelectTrigger className="bg-muted/30 border-muted-foreground/20">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Create as standalone user</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.userId && <Badge variant="secondary" className="text-[9px] h-3.5 px-1">Has Account</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 opacity-60">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
                  Client Profile <Badge variant="outline" className="text-[9px] h-3.5 px-1">Coming Soon</Badge>
                </Label>
                <Select disabled value="none">
                  <SelectTrigger className="bg-muted/10">
                    <SelectValue placeholder="Managed via Portal Access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not available here</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Account Info */}
        <Card className="shadow-premium border-border/50 overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2 font-heading">
              <UserIcon className="h-4 w-4 text-primary" /> Login Credentials
            </CardTitle>
            <CardDescription className="text-xs">
              The credentials the user will use to log into the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {conflictUser && !isEdit && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Account Already Exists</AlertTitle>
                <AlertDescription className="text-xs flex flex-col gap-2">
                  <p>A user with <strong>{form.email}</strong> already has access to the system.</p>
                  <Link to={`/dashboard/users/edit/${conflictUser.id}`} className="text-primary hover:underline flex items-center gap-1 font-semibold">
                    <ExternalLink className="h-3 w-3" /> Edit this user instead
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="user-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Display Name <span className="text-destructive">*</span></Label>
              <Input
                id="user-name"
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className={`bg-muted/30 ${errors.name ? "border-destructive placeholder:text-destructive/50" : "border-muted-foreground/20"}`}
              />
              {errors.name && <p className="text-[10px] font-medium text-destructive mt-1 uppercase tracking-tight">{errors.name}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="user-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Email <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="user-email"
                    type="email"
                    placeholder="email@company.com"
                    className={`pl-9 bg-muted/30 ${errors.email ? "border-destructive placeholder:text-destructive/50" : "border-muted-foreground/20"}`}
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                {errors.email && <p className="text-[10px] font-medium text-destructive mt-1 uppercase tracking-tight">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="user-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {isEdit ? "Update Password" : "Password"} {!isEdit && <span className="text-destructive">*</span>}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="user-password"
                    type="password"
                    placeholder={isEdit ? "Leave blank to keep current" : "Min 6 characters"}
                    className={`pl-9 bg-muted/30 ${errors.password ? "border-destructive placeholder:text-destructive/50" : "border-muted-foreground/20"}`}
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
                {errors.password && <p className="text-[10px] font-medium text-destructive mt-1 uppercase tracking-tight">{errors.password}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">System Role <span className="text-destructive">*</span></Label>
              <Select value={form.role} onValueChange={(v: any) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-muted/30 border-muted-foreground/20">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="font-heading">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="bg-muted/50 p-3 rounded-lg mt-2 hidden sm:block">
                 <p className="text-[11px] text-muted-foreground leading-relaxed">
                   <strong>Admin:</strong> Full system control. <strong>Manager:</strong> Client & Project oversight. <strong>Staff:</strong> View & update assigned tasks.
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final Actions */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
           <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl px-6 border-muted-foreground/20 font-heading">
             Back to Users
           </Button>
           <Button 
             onClick={handleSubmit} 
             disabled={!!conflictUser && !isEdit}
             className="rounded-xl px-8 gap-2 shadow-hero transition-all hover:scale-[1.02] active:scale-[0.98] font-heading" 
             variant="hero"
           >
             <Save className="h-4 w-4" /> {isEdit ? "Update Account" : "Grant Access"}
           </Button>
        </div>
      </div>
    </div>
  );
}
