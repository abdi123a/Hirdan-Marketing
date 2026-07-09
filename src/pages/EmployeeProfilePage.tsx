import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore, EmployeeFile, EmployeeActivity } from "@/lib/store";
import { viewProtectedFile } from "@/lib/api-client";
import FilePreviewModal from "@/components/FilePreviewModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Mail, Phone, Calendar, Briefcase, 
  Settings, User, Clock, MapPin, Trash2,
  Building2, ChevronRight, FileText, DollarSign,
  ShieldAlert, Landmark, File, Eye, Plus, ArrowUpRight, CheckCircle2, RotateCcw, Shield, Lock,
  Download, RefreshCw
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    team, 
    projects, 
    updateTeamMember,
    fetchEmployeeFiles,
    uploadEmployeeFile,
    deleteEmployeeFile,
    fetchEmployeeActivity,
    provisionEmployeeAccess,
    fetchHrDocumentsForEmployee
  } = useAgencyStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "payroll" | "timeline">("overview");
  
  // Loaded async data
  const [files, setFiles] = useState<EmployeeFile[]>([]);
  const [hrDocs, setHrDocs] = useState<any[]>([]);
  const [activity, setActivity] = useState<EmployeeActivity[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingHrDocs, setIsLoadingHrDocs] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileLabel, setPreviewFileLabel] = useState<string>("");
  const [systemAccessPassword, setSystemAccessPassword] = useState("");
  const [systemAccessRole, setSystemAccessRole] = useState("STAFF");
  const [isProvisioningAccess, setIsProvisioningAccess] = useState(false);

  const member = useMemo(() => team.find((m) => m.id === id), [team, id]);
  
  const memberProjects = useMemo(() => 
    projects.filter((p) => p.team.includes(member?.id || '') || p.team.includes(member?.name || '')), 
    [projects, member]
  );

  const allDocuments = useMemo(() => {
    const list = [
      ...files.map(f => ({
        id: f.id,
        name: f.label || 'Unnamed Upload',
        type: `Upload (${f.category})`,
        date: new Date(f.uploadedAt),
        by: f.uploadedBy || 'System',
        url: f.fileUrl,
        isUpload: true,
        status: 'FINAL',
        rawDoc: f
      })),
      ...hrDocs.map(d => ({
        id: d.id,
        name: d.docNumber,
        type: `Generated (${d.docType.replace('_', ' ')})`,
        date: new Date(d.generatedAt),
        by: d.generatedBy?.name || 'HR',
        url: d.pdfUrl,
        isUpload: false,
        status: d.status,
        rawDoc: d
      }))
    ];
    
    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [files, hrDocs]);

  // Load files, HR docs and activities
  useEffect(() => {
    if (id) {
      setIsLoadingFiles(true);
      fetchEmployeeFiles(id).then((res) => {
        setFiles(res);
        setIsLoadingFiles(false);
      });

      setIsLoadingHrDocs(true);
      fetchHrDocumentsForEmployee(id).then((res) => {
        setHrDocs(res);
        setIsLoadingHrDocs(false);
      });

      setIsLoadingActivity(true);
      fetchEmployeeActivity(id).then((res) => {
        setActivity(res);
        setIsLoadingActivity(false);
      });
    }
  }, [id, fetchEmployeeFiles, fetchHrDocumentsForEmployee, fetchEmployeeActivity]);

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Employee not found</h2>
        <Button onClick={() => navigate("/dashboard/team")}>Back to Team</Button>
      </div>
    );
  }

  const isArchived = member.status === "Terminated";

  const statusColor = (s: string) => {
    switch (s) {
      case "Active": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "Pending Documents": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "Draft": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "On Leave": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "Terminated": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Archive (Soft-delete) Handler
  const handleArchive = async () => {
    try {
      await updateTeamMember(member.id, { status: "Terminated" });
      toast({ 
        title: "Employee Terminated / Archived", 
        description: `${member.name} has been moved to the archive and login access disabled.` 
      });
    } catch (err) {
      toast({ title: "Failed to archive employee", variant: "destructive" });
    }
  };

  // Reactivate Handler
  const handleReactivate = async () => {
    try {
      await updateTeamMember(member.id, { status: "Active" });
      toast({ 
        title: "Employee Reactivated", 
        description: `${member.name} is now back in active list and account access restored.` 
      });
    } catch (err) {
      toast({ title: "Failed to reactivate employee", variant: "destructive" });
    }
  };

  // Inline Document Upload
  const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const label = prompt("Enter a label for this document (e.g. Health Insurance, ID Scan):");
    if (!label) return;

    try {
      toast({ title: "Uploading document..." });
      const uploaded = await uploadEmployeeFile(member.id, file, "OTHER", label);
      setFiles(prev => [uploaded, ...prev]);
      
      // Reload activity
      const updatedActivity = await fetchEmployeeActivity(member.id);
      setActivity(updatedActivity);

      toast({ title: "Document uploaded successfully!" });
    } catch (err: any) {
      toast({ title: "Failed to upload document", description: err.message, variant: "destructive" });
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteEmployeeFile(member.id, fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      
      // Reload activity
      const updatedActivity = await fetchEmployeeActivity(member.id);
      setActivity(updatedActivity);
      
      toast({ title: "File deleted successfully" });
    } catch (err) {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  };

  // Gross Salary calculation for view
  const getGrossTotal = () => {
    const basic = parseFloat(String(member.basicSalary || "").replace(/[^0-9.]/g, "")) || 0;
    const housing = parseFloat(String(member.housingAllowance || "").replace(/[^0-9.]/g, "")) || 0;
    const transport = parseFloat(String(member.transportAllowance || "").replace(/[^0-9.]/g, "")) || 0;
    let allowancesSum = 0;
    try {
      const parsed = JSON.parse(member.otherAllowances || "[]");
      if (Array.isArray(parsed)) {
        allowancesSum = parsed.reduce((sum, item) => {
          const amt = parseFloat(String(item.amount).replace(/[^0-9.]/g, "")) || 0;
          return sum + amt;
        }, 0);
      }
    } catch {}
    return basic + housing + transport + allowancesSum;
  };

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-500">
      {/* Top Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/team")} className="rounded-xl h-10 w-10 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <span>Team</span>
          <span>/</span>
          <span className="text-foreground font-bold">{member.name}</span>
        </div>
      </div>

      {/* Main Banner Card */}
      <Card className={`border-border/50 shadow-premium overflow-hidden border-t-4 ${isArchived ? "border-t-red-500" : "border-t-primary"}`}>
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-primary/10 ring-4 ring-primary/5 shadow-md">
              <AvatarImage src={member.photoUrl || member.avatar} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{member.name}</h1>
                <Badge className={`${statusColor(member.status)} border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider h-5`} variant="outline">
                  {isArchived ? `Archived — ${member.archivedAt || 'Terminated'}` : member.status}
                </Badge>
              </div>
              <p className="text-muted-foreground font-medium flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm">
                <span className="font-semibold text-foreground">{member.role}</span>
                <span>·</span>
                <span className="opacity-80">{member.department || "General"}</span>
                <span>·</span>
                <span className="opacity-85 text-xs">Joined {member.startDate || "N/A"}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/team/edit/${member.id}`)} className="h-9 gap-2 text-xs font-semibold">
              <Settings className="h-3.5 w-3.5" /> Edit Profile
            </Button>
            {isArchived ? (
              <Button onClick={handleReactivate} variant="hero" size="sm" className="h-9 gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-premium">
                <RotateCcw className="h-3.5 w-3.5" /> Reactivate Employee
              </Button>
            ) : (
              <Button onClick={handleArchive} variant="destructive" size="sm" className="h-9 gap-2 text-xs font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" /> Terminate / Archive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation Menu */}
      <div className="flex border-b border-border gap-6">
        {[
          { key: "overview", label: "Overview", icon: User },
          { key: "documents", label: "Documents & Files", icon: FileText },
          { key: "payroll", label: "Payroll & Banking", icon: DollarSign },
          { key: "timeline", label: "Timeline / Activity", icon: Clock },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all relative border-b-2 -mb-[2px] ${
              activeTab === tab.key
                ? "border-secondary text-foreground font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Cards */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {isArchived && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-500/10 flex gap-3 text-red-800 dark:text-red-300 items-center">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-semibold text-sm block">Terminated Record</span>
                    <span>This team member was terminated on <strong>{member.archivedAt || "N/A"}</strong>. Disbursal paused and login access disabled.</span>
                  </div>
                </div>
              )}

              {/* Professional bio */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Professional Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="prose prose-sm max-w-none text-muted-foreground italic bg-muted/10 p-4 rounded-xl border-l-4 border-primary/40">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {member.bio || "No professional bio has been added for this team member."}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-4">
                      {[
                        { icon: Mail, label: "Email Address", value: member.email },
                        { icon: Phone, label: "Phone Number", value: member.phone || "Not provided" },
                        { icon: MapPin, label: "Work Location", value: member.workLocation || "Office" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border/40">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      {[
                        { icon: Building2, label: "Department", value: member.department || "General" },
                        { icon: Briefcase, label: "Employment Type", value: member.employmentType || "Full-time" },
                        { icon: Calendar, label: "Date of Birth", value: member.dateOfBirth || "Not provided" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border/40">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Personal details */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Personal & Emergency Details</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Gender</span>
                      <span className="font-semibold text-foreground">{member.gender || "Not provided"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">National ID / Passport Number</span>
                      <span className="font-semibold text-foreground">{member.nationalId || "Not provided"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Nationality</span>
                      <span className="font-semibold text-foreground">{member.nationality || "Not provided"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Home Address</span>
                      <span className="font-semibold text-foreground leading-relaxed block max-w-xs">{member.homeAddress || "Not provided"}</span>
                    </div>
                  </div>

                   <div className="p-4 rounded-xl border bg-muted/20 space-y-3.5 h-fit">
                    <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Emergency Contacts</h4>
                    {(() => {
                      try {
                        if (member.emergencyContactName?.startsWith("[")) {
                          const parsed = JSON.parse(member.emergencyContactName);
                          if (Array.isArray(parsed) && parsed.length > 0) {
                            return parsed.map((c, i) => (
                              <div key={i} className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                <span className="font-semibold text-foreground block text-sm">{c.name || "N/A"}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold block uppercase tracking-wider">{c.relation || "N/A"}</span>
                                <span className="text-xs text-foreground block mt-0.5">{c.phone || "N/A"}</span>
                              </div>
                            ));
                          }
                        }
                      } catch (e) {}

                      return (
                        <div className="space-y-1">
                          <span className="font-semibold text-foreground block text-sm">{member.emergencyContactName || "Not provided"}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold block uppercase tracking-wider">{member.emergencyContactRelation || "N/A"}</span>
                          <span className="text-xs text-foreground block mt-0.5">{member.emergencyContactPhone || "N/A"}</span>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* SYSTEM ACCESS SECTION */}
              <Card className="border-border/50 shadow-sm overflow-hidden bg-primary/5">
                <CardHeader className="pb-4 border-b border-border/10">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-base font-semibold text-primary flex items-center gap-1.5">
                        <Shield className="h-4.5 w-4.5" /> Dashboard Credentials & Access
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {member.userId 
                          ? "Configure or update login credentials for this employee."
                          : "Grant system dashboard login credentials to this employee."}
                      </CardDescription>
                    </div>
                    <Badge variant={member.userId ? "default" : "secondary"} className="text-[10px] font-bold tracking-tight uppercase bg-primary/20 text-primary border-primary/30">
                      {member.userId ? "Access Granted" : "No Access"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-sm">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Login Username / Email</Label>
                      <Input disabled value={member.email || ""} className="bg-muted/50 border-muted-foreground/10 text-muted-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">System Role</Label>
                      <Select value={systemAccessRole} onValueChange={setSystemAccessRole}>
                        <SelectTrigger className="bg-background border-muted-foreground/20">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STAFF">STAFF (Tasks & Dashboard)</SelectItem>
                          <SelectItem value="MANAGER">MANAGER (Clients & Projects)</SelectItem>
                          <SelectItem value="ADMIN">ADMIN (Full Access)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border/40 pt-4">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {member.userId ? "Set New Password" : "Create Password"}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                        <Input 
                          type="text" 
                          placeholder={member.userId ? "Enter new password to reset" : "Enter minimum 6 characters"} 
                          value={systemAccessPassword} 
                          onChange={(e) => setSystemAccessPassword(e.target.value)}
                          className="pl-9 bg-background border-muted-foreground/20"
                        />
                      </div>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
                          let pass = "Hirdan-";
                          for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
                          setSystemAccessPassword(pass);
                          navigator.clipboard.writeText(pass);
                          toast({
                            title: "Password Generated",
                            description: "Strong password copied to clipboard!",
                          });
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider h-9"
                      >
                        Generate
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      disabled={isProvisioningAccess || !systemAccessPassword || systemAccessPassword.length < 6}
                      onClick={async () => {
                        setIsProvisioningAccess(true);
                        try {
                          await provisionEmployeeAccess(member.id, {
                            password: systemAccessPassword,
                            role: systemAccessRole,
                          });
                          setSystemAccessPassword("");
                          toast({
                            title: "System Access Ready",
                            description: `Successfully configured login credentials for ${member.name}.`,
                          });
                        } catch (err: any) {
                          toast({
                            title: "Failed to provision access",
                            description: err?.message || "An unexpected error occurred.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsProvisioningAccess(false);
                        }
                      }}
                      className="font-bold uppercase text-[10px] tracking-wider"
                    >
                      {isProvisioningAccess ? "Processing..." : member.userId ? "Update Login Account" : "Grant Login Account"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: DOCUMENTS */}
          {activeTab === "documents" && (
            <div className="space-y-6">
              {/* Unified Employee Documents List */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Employee Documents & Issued Certificates</CardTitle>
                    <CardDescription>Legal uploads, employment contracts, and auto-generated HR certificates.</CardDescription>
                  </div>
                  {!isArchived && (
                    <label className="h-9 px-3 border border-border bg-card hover:bg-muted text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
                      <Plus className="h-3.5 w-3.5" /> Upload File
                      <input type="file" className="hidden" onChange={handleInlineUpload} />
                    </label>
                  )}
                </CardHeader>
                <CardContent className="p-0 border-t border-border/40">
                  {isLoadingFiles || isLoadingHrDocs ? (
                    <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">Loading documents...</div>
                  ) : allDocuments.length === 0 ? (
                    <div className="p-12 text-center text-xs text-muted-foreground italic">No files or generated certificates found.</div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead className="font-bold text-xs">Document Name</TableHead>
                          <TableHead className="font-bold text-xs">Source / Type</TableHead>
                          <TableHead className="font-bold text-xs">By</TableHead>
                          <TableHead className="font-bold text-xs">Date</TableHead>
                          <TableHead className="font-bold text-xs">Status</TableHead>
                          <TableHead className="text-right font-bold text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-bold text-sm text-foreground/90 font-mono">
                              <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
                                <File className="h-4 w-4 text-primary shrink-0" />
                                <span className="truncate font-sans font-semibold">{doc.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tight bg-muted/40 border-0">
                                {doc.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{doc.by}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(doc.date.toISOString())}</TableCell>
                            <TableCell>
                              {!doc.isUpload && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-[8px] font-black uppercase border-0 px-2 py-0.5 rounded-full ${
                                    doc.status === 'APPROVED' || doc.status === 'FINAL' 
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : doc.status === 'PENDING_APPROVAL'
                                        ? 'bg-amber-500/10 text-amber-600'
                                        : doc.status === 'REJECTED'
                                          ? 'bg-red-500/10 text-red-600'
                                          : 'bg-muted/40 text-muted-foreground'
                                  }`}
                                >
                                  {doc.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {doc.isUpload ? (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => { setPreviewFileUrl(doc.url); setPreviewFileLabel(doc.name); }} className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary">
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    {!isArchived && (
                                      <Button variant="ghost" size="icon" onClick={() => handleFileDelete(doc.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* Download PDF */}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 text-emerald-600 disabled:opacity-35"
                                      title="Download PDF"
                                      disabled={!doc.url || (doc.status !== 'APPROVED' && doc.status !== 'FINAL')}
                                      onClick={() => doc.url && window.open(`${import.meta.env.VITE_API_URL || ''}${doc.url}`, '_blank')}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>

                                    {/* Re-edit / View Details */}
                                    {(user?.role === 'admin' || user?.role === 'manager') && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary"
                                        title="Generate New Version"
                                        onClick={() => navigate(`/dashboard/hr/generate?editId=${doc.id}`)}
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                      </Button>
                                    )}

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary"
                                      title="View Details"
                                      onClick={() => navigate(`/dashboard/hr/generate?viewId=${doc.id}`)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: PAYROLL */}
          {activeTab === "payroll" && (
            <div className="space-y-6">
              {/* Compensation Breakdown */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Compensation Structure</CardTitle>
                    <CardDescription>Salary breakdown and allowances (View-Only)</CardDescription>
                  </div>
                  {/* Generate Payslip */}
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
                      onClick={() => navigate(`/dashboard/hr/generate?type=PAYSLIP&employeeId=${member.id}`)}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" /> Generate Payslip
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {member.isHourlyMode ? (
                    <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Compensation Model</span>
                      <span className="font-bold text-lg text-foreground">Hourly Contractor Billing</span>
                      <p className="text-sm font-semibold text-primary mt-1">Rate: {member.hourlyRate || "N/A"}/hr ({member.currency})</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border border-border rounded-xl overflow-hidden bg-muted/10">
                        <Table>
                          <TableHeader className="bg-muted/20">
                            <TableRow>
                              <TableHead className="font-bold text-xs">Salary Line Item</TableHead>
                              <TableHead className="text-right font-bold text-xs uppercase">Amount ({member.currency})</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-semibold text-foreground/80">Basic Salary</TableCell>
                              <TableCell className="text-right font-semibold text-foreground">{member.basicSalary || "N/A"}</TableCell>
                            </TableRow>
                            {member.housingAllowance && (
                              <TableRow>
                                <TableCell className="text-foreground/75">Housing Allowance</TableCell>
                                <TableCell className="text-right text-foreground">{member.housingAllowance}</TableCell>
                              </TableRow>
                            )}
                            {member.transportAllowance && (
                              <TableRow>
                                <TableCell className="text-foreground/75">Transport Allowance</TableCell>
                                <TableCell className="text-right text-foreground">{member.transportAllowance}</TableCell>
                              </TableRow>
                            )}
                            
                            {/* Other Allowances JSON render */}
                            {(() => {
                              try {
                                const parsed = JSON.parse(member.otherAllowances || "[]");
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                  return parsed.map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-foreground/75">{item.label || "Allowance"}</TableCell>
                                      <TableCell className="text-right text-foreground">
                                        {parseFloat(item.amount || "0").toLocaleString("en-US", { style: "currency", currency: member.currency || "USD" })}
                                      </TableCell>
                                    </TableRow>
                                  ));
                                }
                              } catch {}
                              return null;
                            })()}

                            <TableRow className="bg-primary/5 hover:bg-primary/5 font-bold">
                              <TableCell className="text-primary text-sm font-bold">Total Gross Monthly</TableCell>
                              <TableCell className="text-right text-primary text-sm font-bold">
                                {member.currency} {getGrossTotal().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Bank Details */}
                  <div className="border-t border-border/40 pt-4 space-y-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                      <Landmark className="h-4 w-4 text-primary" /> Banking & Disbursal Parameters
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm bg-muted/10 p-4 rounded-xl border border-border/40">
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Disbursal Method</span>
                          <span className="font-semibold text-foreground">{member.paymentMethod || "Bank Transfer"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Bank Name</span>
                          <span className="font-semibold text-foreground">{member.bankName || "Not provided"}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Account / IBAN Number</span>
                          <span className="font-semibold text-foreground font-mono">{member.accountNumber || "Not provided"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Tax Identification Number</span>
                          <span className="font-semibold text-foreground font-mono">{member.taxId || "Not provided"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: TIMELINE */}
          {activeTab === "timeline" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Employee Life Cycle log</CardTitle>
                <CardDescription>Chronological audit log of records, edits, and file uploads</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                {isLoadingActivity ? (
                  <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">Loading timeline events...</div>
                ) : activity.length === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground italic">No lifecycle events recorded.</div>
                ) : (
                  <div className="space-y-6 pl-4 border-l border-border/80 relative ml-2 py-2">
                    {activity.map((event) => {
                      const getIconColor = (type: string) => {
                        if (type === 'CREATED') return 'bg-emerald-500';
                        if (type === 'ARCHIVED') return 'bg-red-500';
                        if (type === 'REACTIVATED') return 'bg-indigo-500';
                        if (type === 'FILE_UPLOADED') return 'bg-blue-500';
                        if (type === 'FILE_DELETED') return 'bg-amber-500';
                        return 'bg-muted-foreground/60';
                      };

                      return (
                        <div key={event.id} className="relative group animate-in slide-in-from-left-2 duration-300">
                          {/* Circle node marker */}
                          <div className={`absolute -left-[25px] top-1 h-3.5 w-3.5 rounded-full border-2 border-card ${getIconColor(event.actionType)} ring-2 ring-muted/50`} />
                          
                          <div className="space-y-1 pl-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{event.actionType.replace('_', ' ')}</span>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {new Date(event.timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed">{event.notes}</p>
                            <p className="text-[10px] font-semibold text-foreground/70 flex items-center gap-1">
                              <span>Action by:</span>
                              <span className="underline underline-offset-2">{event.performedBy || 'System'}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar Perform Metrics & quick details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Stats summary */}
          <Card className="border-border/50 shadow-premium border-t-2 border-t-secondary/20">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-xs font-display flex items-center gap-1.5 text-muted-foreground uppercase tracking-widest">
                <CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Active Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assignments</p>
                  <p className="text-xl font-bold text-foreground font-display">{memberProjects.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Status</p>
                  <Badge variant="outline" className={`text-[9px] font-bold uppercase ${statusColor(member.status)} border-0 h-5`}>
                    {member.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick list of assignments */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assigned Projects</CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/40">
              {memberProjects.length === 0 ? (
                <p className="p-6 text-xs text-muted-foreground italic text-center">No active project assignments.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {memberProjects.map((proj) => (
                    <div 
                      key={proj.id} 
                      onClick={() => navigate(`/dashboard/projects/view/${proj.id}`)}
                      className="p-3.5 hover:bg-muted/40 transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors block truncate">{proj.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">{proj.status}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* File Preview Dialog */}
      <FilePreviewModal
        isOpen={!!previewFileUrl}
        onClose={() => setPreviewFileUrl(null)}
        fileUrl={previewFileUrl}
        fileLabel={previewFileLabel}
      />
    </div>
  );
}
