import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Check, Loader2, ShieldAlert, CheckCircle2, XCircle, Search,
  RotateCcw, Download, User, Briefcase, Wallet, FileEdit, PenLine, Plus, Type
} from "lucide-react";
import { PremiumHrDocument } from "@/components/PremiumHrDocument";
import { apiFetchBlob } from "@/lib/api-client";
import { triggerBlobDownload } from "@/lib/document-pdf";
import { cn } from "@/lib/utils";
import { buildDefaultLetterContent, ensureLetterContent, sanitizeHrLetterHtml } from "@/lib/hr-letter-text";
import { HrLetterRichEditor } from "@/components/HrLetterRichEditor";

type DocType =
  | "WORK_CERTIFICATE"
  | "SALARY_CERTIFICATE"
  | "PAYSLIP"
  | "WARNING_CERTIFICATE"
  | "INTERNSHIP_ACCEPTED_CERTIFICATE"
  | "INTERNSHIP_LETTER";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  WORK_CERTIFICATE: "Work Certificate",
  SALARY_CERTIFICATE: "Salary Certificate",
  PAYSLIP: "Payslip",
  WARNING_CERTIFICATE: "Warning Notice",
  INTERNSHIP_ACCEPTED_CERTIFICATE: "Internship Confirmation",
  INTERNSHIP_LETTER: "Internship Completion",
};

function Field({
  id, label, children, hint,
}: { id?: string; label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

const inputClass = "h-9 text-xs rounded-lg";

export default function GenerateHrDocumentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("editId");
  const viewId = searchParams.get("viewId");
  const initialType = (searchParams.get("type") as DocType) || "WORK_CERTIFICATE";
  const initialEmployeeId = searchParams.get("employeeId");
  const isReadOnly = !!viewId;

  const { user } = useAuthStore();
  const {
    team, fetchTeam, fetchHrDocumentById, createHrDocument, uploadHrDocumentPdf,
    approveHrDocument, rejectHrDocument, getVerificationToken, settings: rawSettings
  } = useAgencyStore();
  const settings = rawSettings || { agencyName: "", currency: "USD" };

  const printRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<number>(1);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [docType, setDocType] = useState<DocType>(initialType);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  const [docFields, setDocFields] = useState<any>({
    date: new Date().toISOString().split("T")[0],
    docNumber: "",
    employeeName: "",
    employeeId: "",
    employeeTitle: "",
    employeeDepartment: "",
    employeeHireDate: "",
    employeeContractType: "Full-Time",
    employeeStatus: "ACTIVE",
    employeeEndDate: "",
    gender: "",
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    otherAllowances: [],
    grossTotal: 0,
    currency: "USD",
    bankName: "",
    accountNumber: "",
    paymentMethod: "Bank Transfer",
    incidentDate: new Date().toISOString().split("T")[0],
    warningLevel: "1st Warning",
    reason: "",
    issuedBy: user?.name || "HR Manager",
    hrSignatory: (rawSettings?.agencyName || "") + " HR",
    purpose: "",
    coordinatorName: "Internship Committee",
    degreeMajor: "Bachelor of Science in IT",
    internshipDuration: "3 Months",
    workSchedule: "Full-time, 40 hours per week",
    natureOfInternship: "Paid",
    supervisorName: "HR Manager",
    supervisorTitle: "HR Manager",
    institutionName: "University of Technology",
    task1: "Assisting in the development of client software applications",
    task2: "Analyzing weekly website traffic data and creating reports",
    task3: "Participating in team strategy and brainstorming meetings",
    sectionTitle: "",
    letterText: "",
    closingText: "",
    status: "DRAFT",
  });

  const [originalFields, setOriginalFields] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    if (initialEmployeeId && team.length > 0 && !editId && !viewId) {
      const emp = team.find((t) => t.id === initialEmployeeId);
      if (emp) handleSelectEmployee(emp);
    }
  }, [initialEmployeeId, team, editId, viewId]);

  useEffect(() => {
    const loadDocument = async () => {
      const activeId = editId || viewId;
      if (!activeId) return;

      setLoadingDoc(true);
      try {
        const doc = await fetchHrDocumentById(activeId);
        setDocType(doc.docType);
        setSelectedEmployee(doc.employee);
        const merged = {
          ...doc.content,
          id: doc.id,
          docNumber: doc.docNumber,
          status: doc.status,
          version: doc.version,
          pdfUrl: doc.pdfUrl,
        };
        const letter = ensureLetterContent(doc.docType, merged, settings.agencyName || "");
        setDocFields({ ...merged, ...letter });

        const currentEmp = team.find((t) => t.id === doc.employeeId);
        if (currentEmp) fillOriginals(currentEmp);

        try {
          const token = await getVerificationToken("hr_document", activeId);
          setVerificationToken(token);
        } catch (tokenErr) {
          console.error("Failed to load verification token:", tokenErr);
        }

        setStep(2);
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load HR document.",
          variant: "destructive",
        });
        navigate("/dashboard/hr");
      } finally {
        setLoadingDoc(false);
      }
    };

    if (team.length > 0) loadDocument();
  }, [editId, viewId, team]);

  const fillOriginals = (emp: any) => {
    let allowances: any[] = [];
    try {
      allowances = JSON.parse(emp.otherAllowances || "[]");
    } catch { }

    const basic = emp.basicSalary || 0;
    const housing = emp.housingAllowance || 0;
    const transport = emp.transportAllowance || 0;
    const totalAllowances = allowances.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);
    const gross = basic + housing + transport + totalAllowances;

    const statusMap: Record<string, string> = {
      Active: "ACTIVE",
      Terminated: "TERMINATED",
      "On Leave": "ON_LEAVE",
      Draft: "ACTIVE",
      "Pending Documents": "ACTIVE",
    };

    const orgs = {
      employeeName: emp.name || "",
      employeeId: emp.id || "",
      employeeTitle: emp.role || "",
      employeeDepartment: emp.department || "",
      employeeHireDate: emp.startDate ? new Date(emp.startDate).toISOString().split("T")[0] : "",
      employeeContractType: emp.employmentType || "Full-Time",
      employeeStatus: statusMap[emp.status] || emp.status || "ACTIVE",
      employeeEndDate: emp.archivedAt ? new Date(emp.archivedAt).toISOString().split("T")[0] : "",
      gender: emp.gender || "",
      basicSalary: basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowances: allowances,
      grossTotal: gross,
      currency: emp.currency || "USD",
      bankName: emp.bankName || "",
      accountNumber: emp.accountNumber || "",
      paymentMethod: emp.paymentMethod || "Bank Transfer",
    };

    setOriginalFields(orgs);
    return orgs;
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    const orgs = fillOriginals(emp);
    const manager = team.find((t) => t.id === emp.managerId);
    const managerName = manager ? manager.name : (user?.name || "HR Manager");
    const managerRole = manager ? manager.role : "HR Manager";

    const next = {
      ...docFields,
      ...orgs,
      reason: "",
      purpose: "",
      supervisorName: managerName,
      supervisorTitle: managerRole,
      issuedBy: user?.name || "HR Manager",
      hrSignatory: `${settings.agencyName} HR Signatory`,
    };
    const letter = buildDefaultLetterContent(docType, next, settings.agencyName || "");
    setDocFields({ ...next, ...letter });
    setStep(2);
  };

  const rebuildLetterText = () => {
    const letter = buildDefaultLetterContent(docType, docFields, settings.agencyName || "");
    setDocFields((prev: any) => ({ ...prev, ...letter }));
    toast({ title: "Text rebuilt", description: "Document wording was regenerated from the current fields." });
  };

  const handleDocTypeChange = (nextType: DocType) => {
    setDocType(nextType);
    const letter = buildDefaultLetterContent(nextType, docFields, settings.agencyName || "");
    setDocFields((prev: any) => ({ ...prev, ...letter }));
  };

  const recalculateGross = (fields: any) => {
    const basic = Number(fields.basicSalary || 0);
    const housing = Number(fields.housingAllowance || 0);
    const transport = Number(fields.transportAllowance || 0);
    const allowancesSum = Array.isArray(fields.otherAllowances)
      ? fields.otherAllowances.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0)
      : 0;
    return basic + housing + transport + allowancesSum;
  };

  const handleFieldChange = (key: string, value: any) => {
    setDocFields((prev: any) => {
      const updated = { ...prev, [key]: value };
      if (["basicSalary", "housingAllowance", "transportAllowance"].includes(key)) {
        updated.grossTotal = recalculateGross(updated);
      }
      return updated;
    });
  };

  const handleAllowanceChange = (idx: number, field: "label" | "amount", value: any) => {
    const updatedAllowances = [...(docFields.otherAllowances || [])];
    updatedAllowances[idx] = { ...updatedAllowances[idx], [field]: value };
    setDocFields((prev: any) => {
      const next = { ...prev, otherAllowances: updatedAllowances };
      next.grossTotal = recalculateGross(next);
      return next;
    });
  };

  const addAllowanceRow = () => {
    setDocFields((prev: any) => ({
      ...prev,
      otherAllowances: [...(prev.otherAllowances || []), { label: "Allowance", amount: 0 }],
    }));
  };

  const removeAllowanceRow = (idx: number) => {
    const updated = (docFields.otherAllowances || []).filter((_: any, i: number) => i !== idx);
    setDocFields((prev: any) => {
      const next = { ...prev, otherAllowances: updated };
      next.grossTotal = recalculateGross(next);
      return next;
    });
  };

  const resetFromProfile = () => {
    if (!Object.keys(originalFields).length) return;
    setDocFields((prev: any) => ({
      ...prev,
      ...originalFields,
      otherAllowances: Array.isArray(originalFields.otherAllowances)
        ? originalFields.otherAllowances.map((a: any) => ({ ...a }))
        : [],
    }));
    toast({ title: "Reset", description: "Employee fields restored from their profile." });
  };

  const isOverridden = (key: string) => {
    if (originalFields[key] === undefined) return false;
    if (key === "otherAllowances") {
      return JSON.stringify(docFields.otherAllowances) !== JSON.stringify(originalFields.otherAllowances);
    }
    return String(docFields[key]) !== String(originalFields[key]);
  };

  const filteredEmployees = team.filter((emp) => {
    const query = searchEmployeeQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(query) ||
      (emp.role && emp.role.toLowerCase().includes(query)) ||
      (emp.department && emp.department.toLowerCase().includes(query)) ||
      (emp.email && emp.email.toLowerCase().includes(query))
    );
  });

  const generateAndSaveDocument = async (isDraft: boolean): Promise<any> => {
    setIsSubmitting(true);
    try {
      const submitStatus = isDraft
        ? "DRAFT"
        : docType === "WARNING_CERTIFICATE"
          ? "PENDING_APPROVAL"
          : "FINAL";

      const payload: any = {
        employeeId: selectedEmployee.id,
        docType,
        content: docFields,
        status: submitStatus,
      };

      if (editId) payload.docNumber = docFields.docNumber;

      const docRes = await createHrDocument(payload);
      const generatedDocId = docRes.id;
      const docNumber = docRes.docNumber;

      try {
        const token = await getVerificationToken("hr_document", generatedDocId);
        setVerificationToken(token);
      } catch (tokenErr) {
        console.error("Failed to fetch token:", tokenErr);
      }

      const uploadedDoc = await uploadHrDocumentPdf(generatedDocId);

      toast({
        title: "Saved",
        description: `${docNumber} v${uploadedDoc.version} generated successfully.`,
      });

      return { doc: uploadedDoc };
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: err.message || "Failed to generate or save PDF.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { doc } = await generateAndSaveDocument(false);
      const blob = await apiFetchBlob(`/hr/documents/${encodeURIComponent(doc.id)}/export-pdf`);
      triggerBlobDownload(blob, `${doc.docNumber}.pdf`);
      navigate("/dashboard/hr");
    } catch (e) { }
  };

  const handleSaveDraft = async () => {
    try {
      await generateAndSaveDocument(true);
      navigate("/dashboard/hr");
    } catch (e) { }
  };

  const handleApproveWarning = async () => {
    if (!viewId) return;
    setIsSubmitting(true);
    try {
      await approveHrDocument(viewId, approvalComment);
      await uploadHrDocumentPdf(viewId);
      toast({ title: "Approved", description: "Warning notice approved and finalized." });
      navigate("/dashboard/hr");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to approve.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectWarning = async () => {
    if (!viewId) return;
    if (!approvalComment.trim()) {
      toast({
        title: "Comment Required",
        description: "Please specify why you are rejecting this warning.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await rejectHrDocument(viewId, approvalComment);
      toast({ title: "Rejected", description: "Warning notice rejected." });
      navigate("/dashboard/hr");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to reject.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCompensation =
    docType === "SALARY_CERTIFICATE" || docType === "PAYSLIP";
  const showInternship =
    docType === "INTERNSHIP_ACCEPTED_CERTIFICATE" || docType === "INTERNSHIP_LETTER";

  const overriddenCount = [
    "employeeName", "employeeTitle", "employeeDepartment", "employeeHireDate",
    "employeeContractType", "basicSalary", "housingAllowance", "transportAllowance",
    "bankName", "accountNumber", "currency",
  ].filter(isOverridden).length;

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => (step === 2 && !editId && !viewId ? setStep(1) : navigate("/dashboard/hr"))}
          className="h-9 w-9 rounded-xl shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
            {viewId ? "Review document" : editId ? "Edit document" : "Generate document"}
          </h1>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {selectedEmployee
              ? `${selectedEmployee.name} · ${DOC_TYPE_LABELS[docType]}`
              : "Select an employee to continue"}
          </p>
        </div>
        {step === 2 && !isReadOnly && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs"
            >
              Save draft
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={handleDownload}
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs gap-1.5"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Save & download
            </Button>
          </div>
        )}
      </div>

      {loadingDoc ? (
        <div className="py-20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading document…
        </div>
      ) : step === 1 ? (
        /* ── Step 1: Pick employee ── */
        <div className="max-w-2xl">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base font-bold">Who is this for?</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Creating a {DOC_TYPE_LABELS[docType].toLowerCase()}
                  </CardDescription>
                </div>
                <Select value={docType} onValueChange={(v) => handleDocTypeChange(v as DocType)}>
                  <SelectTrigger className="w-[200px] h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                      <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, role, department, or email…"
                  value={searchEmployeeQuery}
                  onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl"
                  autoFocus
                />
              </div>

              <div className="border border-border/40 rounded-xl overflow-hidden divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No employees found.</div>
                ) : (
                  filteredEmployees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{emp.name}</p>
                          <span className="text-[11px] text-muted-foreground truncate block">
                            {[emp.role, emp.department].filter(Boolean).join(" · ") || "Team member"}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold uppercase border-0 shrink-0",
                          emp.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {emp.status}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── Step 2: Edit + preview ── */
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] gap-4 md:gap-5 items-start">
          {/* Editor panel */}
          <Card className="border-border/50 shadow-sm w-full min-w-0 xl:sticky xl:top-4 overflow-hidden order-1">
            <CardHeader className="pb-3 border-b border-border/40 flex-row items-center justify-between gap-2 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold">Edit content</CardTitle>
                {overriddenCount > 0 && !isReadOnly && (
                  <p className="text-[10px] text-amber-600 mt-0.5">{overriddenCount} field{overriddenCount === 1 ? "" : "s"} differ from profile</p>
                )}
              </div>
              {!isReadOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFromProfile}
                  className="h-8 text-[11px] gap-1 rounded-lg shrink-0"
                  title="Restore employee fields from their profile"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-none sm:max-h-[min(75vh,800px)] overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-1">
                {isReadOnly ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs space-y-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Reference</span>
                        <span className="font-mono font-semibold">{docFields.docNumber}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Employee</span>
                        <span className="font-semibold">{docFields.employeeName}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-semibold uppercase">{docFields.status?.replace(/_/g, " ")}</span>
                      </div>
                      {docFields.version && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Version</span>
                          <span className="font-mono">v{docFields.version}</span>
                        </div>
                      )}
                    </div>

                    {docFields.status === "PENDING_APPROVAL" && (
                      <div className="rounded-xl border border-amber-500/20 overflow-hidden">
                        <div className="px-3 py-2.5 bg-amber-500/5 border-b border-amber-500/10">
                          <p className="text-sm font-bold flex items-center gap-1.5 text-amber-800">
                            <ShieldAlert className="h-4 w-4" /> Pending approval
                          </p>
                        </div>
                        <div className="p-3 space-y-3">
                          <Field label="Comment">
                            <Textarea
                              placeholder="Approval note or rejection reason…"
                              value={approvalComment}
                              onChange={(e) => setApprovalComment(e.target.value)}
                              className="min-h-[90px] text-xs"
                            />
                          </Field>
                          <Button
                            onClick={handleApproveWarning}
                            disabled={isSubmitting}
                            className="w-full h-9 gap-1.5 text-xs rounded-xl"
                            variant="hero"
                          >
                            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve & sign
                          </Button>
                          <Button
                            onClick={handleRejectWarning}
                            disabled={isSubmitting}
                            className="w-full h-9 gap-1.5 text-xs rounded-xl"
                            variant="destructive"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Accordion
                    type="multiple"
                    defaultValue={["letter", "document", "employee", showCompensation ? "compensation" : "specific", "specific", "signatory"]}
                    className="space-y-1"
                  >
                    {/* Full letter text — open first so users can rewrite wording */}
                    {docType !== "PAYSLIP" && (
                      <AccordionItem value="letter" className="border rounded-xl px-3 mb-2 border-border/50 border-primary/20 bg-primary/[0.02]">
                        <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                          <span className="flex items-center gap-2">
                            <Type className="h-3.5 w-3.5 text-primary" /> Document text
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Rewrite any wording below. Blank lines create new paragraphs. Preview updates live.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={rebuildLetterText}
                              className="h-7 text-[10px] gap-1 rounded-lg shrink-0"
                            >
                              <RotateCcw className="h-3 w-3" /> Rebuild from fields
                            </Button>
                          </div>
                          <Field id="section-title" label="Section title">
                            <Input
                              id="section-title"
                              value={docFields.sectionTitle || ""}
                              onChange={(e) => handleFieldChange("sectionTitle", e.target.value)}
                              className={inputClass}
                              placeholder="e.g. Certificate of Employment"
                            />
                          </Field>
                          <Field
                            id="letter-text"
                            label={docType === "SALARY_CERTIFICATE" || docType === "WARNING_CERTIFICATE" ? "Opening text" : "Full letter text"}
                            hint="Select text and use Bold / Italic / Underline. Preview updates live."
                          >
                            <HrLetterRichEditor
                              value={docFields.letterText || ""}
                              onChange={(html) => handleFieldChange("letterText", sanitizeHrLetterHtml(html))}
                              placeholder="Write the full document text here…"
                              minHeight="200px"
                            />
                          </Field>
                          {(docType === "SALARY_CERTIFICATE" || docType === "WARNING_CERTIFICATE") && (
                            <Field
                              id="closing-text"
                              label={docType === "SALARY_CERTIFICATE" ? "Text after salary table" : "Closing text"}
                              hint={docType === "WARNING_CERTIFICATE" ? "Shown below the infraction box" : undefined}
                            >
                              <HrLetterRichEditor
                                value={docFields.closingText || ""}
                                onChange={(html) => handleFieldChange("closingText", sanitizeHrLetterHtml(html))}
                                placeholder="Closing paragraph…"
                                minHeight="110px"
                              />
                            </Field>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Document */}
                    <AccordionItem value="document" className="border rounded-xl px-3 mb-2 border-border/50">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <FileEdit className="h-3.5 w-3.5 text-primary" /> Document
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        <Field id="doc-type" label="Document type">
                          <Select value={docType} onValueChange={(v) => handleDocTypeChange(v as DocType)}>
                            <SelectTrigger id="doc-type" className={cn(inputClass, "w-full")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                                <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field id="issue-date" label="Issue date">
                          <Input
                            id="issue-date"
                            type="date"
                            value={docFields.date || ""}
                            onChange={(e) => handleFieldChange("date", e.target.value)}
                            className={inputClass}
                          />
                        </Field>
                        {docFields.docNumber && (
                          <Field label="Reference number" hint="Auto-assigned — kept when creating a new version">
                            <Input value={docFields.docNumber} disabled className={inputClass} />
                          </Field>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Employee */}
                    <AccordionItem value="employee" className="border rounded-xl px-3 mb-2 border-border/50">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-primary" /> Employee details
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        <Field id="emp-name" label="Full name">
                          <Input
                            id="emp-name"
                            value={docFields.employeeName || ""}
                            onChange={(e) => handleFieldChange("employeeName", e.target.value)}
                            className={cn(inputClass, isOverridden("employeeName") && "border-amber-400 bg-amber-50/40")}
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field id="emp-title" label="Job title">
                            <Input
                              id="emp-title"
                              value={docFields.employeeTitle || ""}
                              onChange={(e) => handleFieldChange("employeeTitle", e.target.value)}
                              className={cn(inputClass, isOverridden("employeeTitle") && "border-amber-400 bg-amber-50/40")}
                            />
                          </Field>
                          <Field id="emp-dept" label="Department">
                            <Input
                              id="emp-dept"
                              value={docFields.employeeDepartment || ""}
                              onChange={(e) => handleFieldChange("employeeDepartment", e.target.value)}
                              className={cn(inputClass, isOverridden("employeeDepartment") && "border-amber-400 bg-amber-50/40")}
                            />
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Field id="emp-hire" label="Hire / start date">
                            <Input
                              id="emp-hire"
                              type="date"
                              value={docFields.employeeHireDate || ""}
                              onChange={(e) => handleFieldChange("employeeHireDate", e.target.value)}
                              className={cn(inputClass, isOverridden("employeeHireDate") && "border-amber-400 bg-amber-50/40")}
                            />
                          </Field>
                          <Field id="emp-end" label="End date">
                            <Input
                              id="emp-end"
                              type="date"
                              value={docFields.employeeEndDate || ""}
                              onChange={(e) => handleFieldChange("employeeEndDate", e.target.value)}
                              className={inputClass}
                            />
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Field id="emp-contract" label="Contract type">
                            <Input
                              id="emp-contract"
                              value={docFields.employeeContractType || ""}
                              onChange={(e) => handleFieldChange("employeeContractType", e.target.value)}
                              className={cn(inputClass, isOverridden("employeeContractType") && "border-amber-400 bg-amber-50/40")}
                              placeholder="Full-Time"
                            />
                          </Field>
                          <Field id="emp-status" label="Employment status">
                            <Select
                              value={docFields.employeeStatus || "ACTIVE"}
                              onValueChange={(v) => handleFieldChange("employeeStatus", v)}
                            >
                              <SelectTrigger id="emp-status" className={inputClass}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="TERMINATED">Terminated</SelectItem>
                                <SelectItem value="ON_LEAVE">On leave</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        <Field id="emp-gender" label="Gender (for salutation)">
                          <Select
                            value={docFields.gender || "male"}
                            onValueChange={(v) => handleFieldChange("gender", v)}
                          >
                            <SelectTrigger id="emp-gender" className={inputClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male (Mr.)</SelectItem>
                              <SelectItem value="female">Female (Ms.)</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Compensation */}
                    {showCompensation && (
                      <AccordionItem value="compensation" className="border rounded-xl px-3 mb-2 border-border/50">
                        <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                          <span className="flex items-center gap-2">
                            <Wallet className="h-3.5 w-3.5 text-primary" /> Compensation
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pb-4">
                          <div className="grid grid-cols-2 gap-2">
                            <Field id="basic" label="Basic salary">
                              <Input
                                id="basic"
                                type="number"
                                value={docFields.basicSalary ?? 0}
                                onChange={(e) => handleFieldChange("basicSalary", Number(e.target.value))}
                                className={cn(inputClass, isOverridden("basicSalary") && "border-amber-400 bg-amber-50/40")}
                              />
                            </Field>
                            <Field id="currency" label="Currency">
                              <Input
                                id="currency"
                                value={docFields.currency || ""}
                                onChange={(e) => handleFieldChange("currency", e.target.value)}
                                className={cn(inputClass, isOverridden("currency") && "border-amber-400 bg-amber-50/40")}
                              />
                            </Field>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Field id="housing" label="Housing allowance">
                              <Input
                                id="housing"
                                type="number"
                                value={docFields.housingAllowance ?? 0}
                                onChange={(e) => handleFieldChange("housingAllowance", Number(e.target.value))}
                                className={cn(inputClass, isOverridden("housingAllowance") && "border-amber-400 bg-amber-50/40")}
                              />
                            </Field>
                            <Field id="transport" label="Transport allowance">
                              <Input
                                id="transport"
                                type="number"
                                value={docFields.transportAllowance ?? 0}
                                onChange={(e) => handleFieldChange("transportAllowance", Number(e.target.value))}
                                className={cn(inputClass, isOverridden("transportAllowance") && "border-amber-400 bg-amber-50/40")}
                              />
                            </Field>
                          </div>

                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] font-semibold text-muted-foreground">Other allowances</Label>
                              <Button type="button" variant="ghost" size="sm" onClick={addAllowanceRow} className="h-6 text-[10px] gap-1">
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            </div>
                            {(docFields.otherAllowances || []).map((allowance: any, idx: number) => (
                              <div key={idx} className="flex gap-1.5 items-center">
                                <Input
                                  placeholder="Label"
                                  value={allowance.label}
                                  onChange={(e) => handleAllowanceChange(idx, "label", e.target.value)}
                                  className="h-8 text-xs rounded-lg flex-1"
                                />
                                <Input
                                  type="number"
                                  placeholder="Amt"
                                  value={allowance.amount}
                                  onChange={(e) => handleAllowanceChange(idx, "amount", e.target.value)}
                                  className="h-8 text-xs rounded-lg w-20"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAllowanceRow(idx)}
                                  className="h-8 w-8 text-red-500 rounded-lg"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-lg bg-muted/40 px-3 py-2 flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Gross total</span>
                            <span className="font-bold">{Number(docFields.grossTotal || 0).toLocaleString()} {docFields.currency}</span>
                          </div>

                          <Field id="payment" label="Payment method">
                            <Input
                              id="payment"
                              value={docFields.paymentMethod || ""}
                              onChange={(e) => handleFieldChange("paymentMethod", e.target.value)}
                              className={inputClass}
                            />
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field id="bank" label="Bank name">
                              <Input
                                id="bank"
                                value={docFields.bankName || ""}
                                onChange={(e) => handleFieldChange("bankName", e.target.value)}
                                className={cn(inputClass, isOverridden("bankName") && "border-amber-400 bg-amber-50/40")}
                              />
                            </Field>
                            <Field id="account" label="Account number">
                              <Input
                                id="account"
                                value={docFields.accountNumber || ""}
                                onChange={(e) => handleFieldChange("accountNumber", e.target.value)}
                                className={cn(inputClass, isOverridden("accountNumber") && "border-amber-400 bg-amber-50/40")}
                              />
                            </Field>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Type-specific */}
                    <AccordionItem value="specific" className="border rounded-xl px-3 mb-2 border-border/50">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <Briefcase className="h-3.5 w-3.5 text-primary" />
                          {DOC_TYPE_LABELS[docType]} details
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        {docType === "WORK_CERTIFICATE" && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Work certificates use the employee details above. Adjust name, title, dates, and status there — the preview updates live.
                          </p>
                        )}

                        {docType === "SALARY_CERTIFICATE" && (
                          <Field id="purpose" label="Purpose of issue">
                            <Input
                              id="purpose"
                              placeholder="e.g. Visa application, bank loan"
                              value={docFields.purpose || ""}
                              onChange={(e) => handleFieldChange("purpose", e.target.value)}
                              className={inputClass}
                            />
                          </Field>
                        )}

                        {docType === "PAYSLIP" && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Payslips show the last three months relative to the issue date. Edit compensation above to change amounts.
                          </p>
                        )}

                        {docType === "WARNING_CERTIFICATE" && (
                          <>
                            <Field id="warning-level" label="Warning level">
                              <Select
                                value={docFields.warningLevel}
                                onValueChange={(v) => handleFieldChange("warningLevel", v)}
                              >
                                <SelectTrigger id="warning-level" className={inputClass}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1st Warning">1st Warning</SelectItem>
                                  <SelectItem value="2nd Warning">2nd Warning</SelectItem>
                                  <SelectItem value="Final Warning">Final Warning</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field id="incident-date" label="Incident date">
                              <Input
                                id="incident-date"
                                type="date"
                                value={docFields.incidentDate || ""}
                                onChange={(e) => handleFieldChange("incidentDate", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                            <Field id="warning-reason" label="Infraction description">
                              <Textarea
                                id="warning-reason"
                                placeholder="Describe the incident or concerns…"
                                value={docFields.reason || ""}
                                onChange={(e) => handleFieldChange("reason", e.target.value)}
                                className="min-h-[120px] text-xs"
                              />
                            </Field>
                            <Field id="issued-by" label="Issued by">
                              <Input
                                id="issued-by"
                                value={docFields.issuedBy || ""}
                                onChange={(e) => handleFieldChange("issuedBy", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                          </>
                        )}

                        {showInternship && (
                          <>
                            {docType === "INTERNSHIP_ACCEPTED_CERTIFICATE" && (
                              <Field id="coordinator" label="Coordinator / committee">
                                <Input
                                  id="coordinator"
                                  value={docFields.coordinatorName || ""}
                                  onChange={(e) => handleFieldChange("coordinatorName", e.target.value)}
                                  className={inputClass}
                                />
                              </Field>
                            )}
                            {docType === "INTERNSHIP_LETTER" && (
                              <Field id="institution" label="Institution name">
                                <Input
                                  id="institution"
                                  value={docFields.institutionName || ""}
                                  onChange={(e) => handleFieldChange("institutionName", e.target.value)}
                                  className={inputClass}
                                />
                              </Field>
                            )}
                            <Field id="degree" label="Degree / major">
                              <Input
                                id="degree"
                                value={docFields.degreeMajor || ""}
                                onChange={(e) => handleFieldChange("degreeMajor", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                            <Field id="duration" label="Internship duration">
                              <Input
                                id="duration"
                                value={docFields.internshipDuration || ""}
                                onChange={(e) => handleFieldChange("internshipDuration", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                            {docType === "INTERNSHIP_ACCEPTED_CERTIFICATE" && (
                              <>
                                <Field id="schedule" label="Work schedule">
                                  <Input
                                    id="schedule"
                                    value={docFields.workSchedule || ""}
                                    onChange={(e) => handleFieldChange("workSchedule", e.target.value)}
                                    className={inputClass}
                                  />
                                </Field>
                                <Field id="nature" label="Nature of internship">
                                  <Input
                                    id="nature"
                                    value={docFields.natureOfInternship || ""}
                                    onChange={(e) => handleFieldChange("natureOfInternship", e.target.value)}
                                    className={inputClass}
                                  />
                                </Field>
                                <div className="grid grid-cols-2 gap-2">
                                  <Field id="sup-name" label="Supervisor name">
                                    <Input
                                      id="sup-name"
                                      value={docFields.supervisorName || ""}
                                      onChange={(e) => handleFieldChange("supervisorName", e.target.value)}
                                      className={inputClass}
                                    />
                                  </Field>
                                  <Field id="sup-title" label="Supervisor title">
                                    <Input
                                      id="sup-title"
                                      value={docFields.supervisorTitle || ""}
                                      onChange={(e) => handleFieldChange("supervisorTitle", e.target.value)}
                                      className={inputClass}
                                    />
                                  </Field>
                                </div>
                              </>
                            )}
                            <Field id="task1" label="Responsibility 1">
                              <Input
                                id="task1"
                                value={docFields.task1 || ""}
                                onChange={(e) => handleFieldChange("task1", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                            <Field id="task2" label="Responsibility 2">
                              <Input
                                id="task2"
                                value={docFields.task2 || ""}
                                onChange={(e) => handleFieldChange("task2", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                            <Field id="task3" label="Responsibility 3">
                              <Input
                                id="task3"
                                value={docFields.task3 || ""}
                                onChange={(e) => handleFieldChange("task3", e.target.value)}
                                className={inputClass}
                              />
                            </Field>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Signatory */}
                    <AccordionItem value="signatory" className="border rounded-xl px-3 mb-2 border-border/50">
                      <AccordionTrigger className="text-xs font-bold hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          <PenLine className="h-3.5 w-3.5 text-primary" /> Signatory
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        <Field id="hr-signatory" label="HR signatory label">
                          <Input
                            id="hr-signatory"
                            value={docFields.hrSignatory || ""}
                            onChange={(e) => handleFieldChange("hrSignatory", e.target.value)}
                            className={inputClass}
                            placeholder="Authorized HR Signatory"
                          />
                        </Field>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>

              {!isReadOnly && (
                <div className="sm:hidden border-t border-border/60 p-3 flex gap-2 bg-background">
                  <Button variant="outline" onClick={handleSaveDraft} disabled={isSubmitting} className="flex-1 rounded-xl h-10 text-xs">
                    Save draft
                  </Button>
                  <Button variant="hero" onClick={handleDownload} disabled={isSubmitting} className="flex-1 rounded-xl h-10 text-xs gap-1.5">
                    {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live preview */}
          <div className="w-full min-w-0 order-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live preview
              </p>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Edits apply to this document only</p>
            </div>
            <div
              ref={printRef}
              className="hr-preview-shell rounded-2xl border border-dashed border-border/60 bg-muted/20 p-2 sm:p-4 md:p-5 overflow-x-auto"
            >
              <style>{`
                .hr-preview-shell { --hr-preview-scale: 0.42; }
                @media (min-width: 640px) { .hr-preview-shell { --hr-preview-scale: 0.55; } }
                @media (min-width: 1024px) { .hr-preview-shell { --hr-preview-scale: 0.62; } }
                @media (min-width: 1280px) { .hr-preview-shell { --hr-preview-scale: 0.78; } }
              `}</style>
              <div
                className="mx-auto"
                style={{
                  width: "210mm",
                  transform: "scale(var(--hr-preview-scale))",
                  transformOrigin: "top center",
                  marginBottom: "calc((1 - var(--hr-preview-scale)) * -297mm)",
                }}
              >
                <PremiumHrDocument
                  docType={docType}
                  data={docFields}
                  settings={settings}
                  verificationToken={verificationToken}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
