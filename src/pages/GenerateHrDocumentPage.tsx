import { useState, useEffect, useRef } from "react";
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
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Download, Mail, Check, AlertCircle, Loader2, Landmark, 
  UserCircle, FileText, ArrowRight, ShieldAlert, CheckCircle2, XCircle, Search
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PremiumHrDocument } from "@/components/PremiumHrDocument";
import { apiFetchBlob } from "@/lib/api-client";
import { triggerBlobDownload } from "@/lib/document-pdf";

type DocType = 'WORK_CERTIFICATE' | 'SALARY_CERTIFICATE' | 'PAYSLIP' | 'WARNING_CERTIFICATE' | 'INTERNSHIP_ACCEPTED_CERTIFICATE' | 'INTERNSHIP_LETTER';

export default function GenerateHrDocumentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const viewId = searchParams.get('viewId');
  const initialType = searchParams.get('type') as DocType || 'WORK_CERTIFICATE';
  const initialEmployeeId = searchParams.get('employeeId');

  const { user } = useAuthStore();
  const { 
    team, fetchTeam, fetchHrDocumentById, createHrDocument, uploadHrDocumentPdf,
    approveHrDocument, rejectHrDocument, sendHrDocumentEmail, getVerificationToken, settings: rawSettings 
  } = useAgencyStore();
  const settings = rawSettings || { agencyName: "", currency: "USD" };

  const printRef = useRef<HTMLDivElement>(null);

  // Flow State
  const [step, setStep] = useState<number>(1);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [docType, setDocType] = useState<DocType>(initialType);
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState<string>("");
  const [verificationToken, setVerificationToken] = useState<string>("");

  // Document Fields State
  const [docFields, setDocFields] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    docNumber: "",
    employeeName: "",
    employeeId: "",
    employeeTitle: "",
    employeeDepartment: "",
    employeeHireDate: "",
    employeeContractType: "Full-Time",
    employeeStatus: "ACTIVE",
    employeeEndDate: "",
    
    // Salary breakdown
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    otherAllowances: [],
    grossTotal: 0,
    currency: "USD",
    bankName: "",
    accountNumber: "",
    paymentMethod: "Bank Transfer",

    // Warning details
    incidentDate: new Date().toISOString().split('T')[0],
    warningLevel: "1st Warning",
    reason: "",
    issuedBy: user?.name || "HR Manager",
    hrSignatory: settings.agencyName + " HR",

    // Salary cert details
    purpose: "",

    // Internship details
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
    
    status: "DRAFT"
  });

  // Original System Values (to detect overrides)
  const [originalFields, setOriginalFields] = useState<any>({});

  // Loading States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [loadingDoc, setLoadingDoc] = useState<boolean>(false);
  
  // Approval states for viewId
  const [approvalComment, setApprovalComment] = useState<string>("");
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);

  // Load team list
  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Pre-select employee from query params
  useEffect(() => {
    if (initialEmployeeId && team.length > 0 && !editId && !viewId) {
      const emp = team.find(t => t.id === initialEmployeeId);
      if (emp) {
        handleSelectEmployee(emp);
      }
    }
  }, [initialEmployeeId, team, editId, viewId]);

  // Load document if viewing or editing
  useEffect(() => {
    const loadDocument = async () => {
      const activeId = editId || viewId;
      if (!activeId) return;

      setLoadingDoc(true);
      try {
        const doc = await fetchHrDocumentById(activeId);
        setDocType(doc.docType);
        setSelectedEmployee(doc.employee);
        
        // Restore document values
        setDocFields({
          ...doc.content,
          id: doc.id,
          docNumber: doc.docNumber,
          status: doc.status,
          version: doc.version,
          pdfUrl: doc.pdfUrl
        });

        // Set original fields based on the employee profile at that time
        // (If editing, we want to know what is in the employee profile today)
        const currentEmp = team.find(t => t.id === doc.employeeId);
        if (currentEmp) {
          fillOriginals(currentEmp);
        }

        try {
          const token = await getVerificationToken("hr_document", activeId);
          setVerificationToken(token);
        } catch (tokenErr) {
          console.error("Failed to load verification token on mount:", tokenErr);
        }

        setStep(2); // Jump straight to preview
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load HR document details.",
          variant: "destructive",
        });
        navigate("/dashboard/hr");
      } finally {
        setLoadingDoc(false);
      }
    };

    if (team.length > 0) {
      loadDocument();
    }
  }, [editId, viewId, team]);

  // Helper to record system defaults for override tracking
  const fillOriginals = (emp: any) => {
    let allowances: any[] = [];
    try {
      allowances = JSON.parse(emp.otherAllowances || "[]");
    } catch {}

    const basic = emp.basicSalary || 0;
    const housing = emp.housingAllowance || 0;
    const transport = emp.transportAllowance || 0;
    const totalAllowances = allowances.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const gross = basic + housing + transport + totalAllowances;

    const orgs = {
      employeeName: emp.name || "",
      employeeId: emp.id || "",
      employeeTitle: emp.role || "",
      employeeDepartment: emp.department || "",
      employeeHireDate: emp.startDate ? new Date(emp.startDate).toISOString().split('T')[0] : "",
      employeeContractType: emp.employmentType || "Full-Time",
      employeeStatus: emp.status || "ACTIVE",
      employeeEndDate: emp.archivedAt ? new Date(emp.archivedAt).toISOString().split('T')[0] : "",
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

    // Find manager's name from team list
    const manager = team.find(t => t.id === emp.managerId);
    const managerName = manager ? manager.name : (user?.name || "HR Manager");
    const managerRole = manager ? manager.role : "HR Manager";

    // Initial fill fields
    setDocFields(prev => ({
      ...prev,
      ...orgs,
      reason: "",
      purpose: "",
      supervisorName: managerName,
      supervisorTitle: managerRole,
      issuedBy: user?.name || "HR Manager",
      hrSignatory: settings.agencyName + " HR Signatory"
    }));

    setStep(2);
  };

  const handleFieldChange = (key: string, value: any) => {
    setDocFields(prev => {
      const updated = { ...prev, [key]: value };
      
      // Auto-recalculate gross salary if components changed
      if (['basicSalary', 'housingAllowance', 'transportAllowance'].includes(key)) {
        const basic = Number(updated.basicSalary || 0);
        const housing = Number(updated.housingAllowance || 0);
        const transport = Number(updated.transportAllowance || 0);
        
        let allowancesSum = 0;
        if (Array.isArray(updated.otherAllowances)) {
          allowancesSum = updated.otherAllowances.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);
        }
        
        updated.grossTotal = basic + housing + transport + allowancesSum;
      }
      
      return updated;
    });
  };

  const handleAllowanceChange = (idx: number, field: 'label' | 'amount', value: any) => {
    const updatedAllowances = [...docFields.otherAllowances];
    updatedAllowances[idx] = { ...updatedAllowances[idx], [field]: value };
    
    setDocFields(prev => {
      const basic = Number(prev.basicSalary || 0);
      const housing = Number(prev.housingAllowance || 0);
      const transport = Number(prev.transportAllowance || 0);
      
      const allowancesSum = updatedAllowances.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      
      return {
        ...prev,
        otherAllowances: updatedAllowances,
        grossTotal: basic + housing + transport + allowancesSum
      };
    });
  };

  const addAllowanceRow = () => {
    setDocFields(prev => ({
      ...prev,
      otherAllowances: [...prev.otherAllowances, { label: "Allowance", amount: 0 }]
    }));
  };

  const removeAllowanceRow = (idx: number) => {
    const updated = docFields.otherAllowances.filter((_: any, i: number) => i !== idx);
    setDocFields(prev => {
      const basic = Number(prev.basicSalary || 0);
      const housing = Number(prev.housingAllowance || 0);
      const transport = Number(prev.transportAllowance || 0);
      const allowancesSum = updated.reduce((sum: number, item: any) => sum + parseFloat(item.amount || 0), 0);
      
      return {
        ...prev,
        otherAllowances: updated,
        grossTotal: basic + housing + transport + allowancesSum
      };
    });
  };

  // Check if a field is overridden from original employee profile
  const isOverridden = (key: string) => {
    if (originalFields[key] === undefined) return false;
    
    if (key === 'otherAllowances') {
      return JSON.stringify(docFields.otherAllowances) !== JSON.stringify(originalFields.otherAllowances);
    }
    
    return String(docFields[key]) !== String(originalFields[key]);
  };

  // Search filter for employee list
  const filteredEmployees = team.filter((emp) => {
    const query = searchEmployeeQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(query) ||
      emp.id.toLowerCase().includes(query) ||
      (emp.department && emp.department.toLowerCase().includes(query))
    );
  });

  // Render editable visual preview fields inline with visual feedback
  const renderEditableInput = (key: string, type: string = "text", placeholder: string = "") => {
    const val = docFields[key] || "";
    const overridden = isOverridden(key);
    
    return (
      <div className="relative inline-block group">
        <input
          type={type}
          value={val}
          onChange={(e) => handleFieldChange(key, type === "number" ? Number(e.target.value) : e.target.value)}
          placeholder={placeholder}
          disabled={!!viewId}
          className={`bg-amber-50/20 hover:bg-amber-100/30 focus:bg-white border-b border-dashed border-muted-foreground/30 focus:border-solid focus:border-primary outline-none px-1 rounded transition-all font-semibold ${
            overridden ? 'border-amber-500 text-amber-700 bg-amber-50/50' : ''
          }`}
          style={{ width: `${Math.max(50, val.toString().length * 9)}px` }}
        />
        {overridden && !viewId && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50">
            Overrode original data
          </span>
        )}
      </div>
    );
  };

  // PDF render and backend push flow
  const generateAndSaveDocument = async (isDraft: boolean): Promise<any> => {
    setIsSubmitting(true);
    try {
      // 1. Submit meta record to DB
      const submitStatus = isDraft ? 'DRAFT' : (docType === 'WARNING_CERTIFICATE' ? 'PENDING_APPROVAL' : 'FINAL');
      
      const payload: any = {
        employeeId: selectedEmployee.id,
        docType,
        content: docFields,
        status: submitStatus
      };

      if (editId) {
        payload.docNumber = docFields.docNumber; // creates new version
      }

      const docRes = await createHrDocument(payload);
      const generatedDocId = docRes.id;
      const docNumber = docRes.docNumber;

      // Fetch verification token for the newly created document (for on-screen preview)
      try {
        const token = await getVerificationToken("hr_document", generatedDocId);
        setVerificationToken(token);
      } catch (tokenErr) {
        console.error("Failed to fetch token for new document:", tokenErr);
      }

      // Server-render PDF via Puppeteer and cache on disk
      const uploadedDoc = await uploadHrDocumentPdf(generatedDocId);

      toast({
        title: "Success",
        description: `Document ${docNumber} v${uploadedDoc.version} generated and saved successfully.`,
      });

      return { doc: uploadedDoc };
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: err.message || "Failed to generate or save PDF document.",
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
    } catch (e) {}
  };

  const handleSaveDraft = async () => {
    try {
      await generateAndSaveDocument(true);
      navigate("/dashboard/hr");
    } catch (e) {}
  };

  // Manager Approval Queue Handlers
  const handleApproveWarning = async () => {
    if (!viewId) return;
    setIsSubmitting(true);
    try {
      await approveHrDocument(viewId, approvalComment);
      
      toast({
        title: "Generating Final PDF",
        description: "Rendering document with digital signatures...",
      });

      await uploadHrDocumentPdf(viewId);

      toast({
        title: "Warning Approved",
        description: "Warning notice approved and finalized.",
      });
      setIsApproveOpen(false);
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
        description: "Please specify why you are rejecting this draft warning.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await rejectHrDocument(viewId, approvalComment);
      toast({
        title: "Warning Rejected",
        description: "Warning notice rejected.",
      });
      setIsRejectOpen(false);
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

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => navigate("/dashboard/hr")}
          className="h-9 w-9 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {viewId ? "Review Document" : editId ? "Edit HR Document (New Version)" : "Generate HR Document"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedEmployee ? `${selectedEmployee.name} • ${docType.replace('_', ' ')}` : "Select an employee to proceed."}
          </p>
        </div>
      </div>

      {loadingDoc ? (
        <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading document details...
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-8">
          
          {/* Main Workspace (Preview + Left-hand config sidebar) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Step 1: Select Employee */}
            {step === 1 && (
              <Card className="border-border/50 shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Select Employee</CardTitle>
                  <CardDescription className="text-xs">Search and select an active or former team member to generate their document.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name, ID, or department..."
                      value={searchEmployeeQuery}
                      onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                      className="pl-9 h-11 rounded-xl"
                    />
                  </div>

                  <div className="border border-border/40 rounded-xl overflow-hidden divide-y divide-border/40 max-h-96 overflow-y-auto">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground italic">No employees found.</div>
                    ) : (
                      filteredEmployees.map(emp => (
                        <div 
                          key={emp.id} 
                          onClick={() => handleSelectEmployee(emp)}
                          className="p-3.5 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition duration-150"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-foreground/80">{emp.name}</p>
                              <span className="text-[10px] text-muted-foreground">ID: {emp.id} • {emp.role} ({emp.department})</span>
                            </div>
                          </div>
                          
                          <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                            emp.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border-0' : 'bg-muted text-muted-foreground border-0'
                          }`}>
                            {emp.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Editable Preview (WYSIWYG layout) */}
            {step === 2 && selectedEmployee && (
              <div className="space-y-6">
                
                {/* Visual indicator of override mode */}
                {!viewId && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-800 leading-relaxed flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Interactive WYSIWYG Mode</span>
                      You can modify any field in the document preview below. Fields pulled from the database are flagged in amber. Edits only apply to this certificate and will not affect the employee's profile.
                    </div>
                  </div>
                )}

                {/* The actual A4 document element */}
                <div ref={printRef} className="bg-muted/10 p-2 border border-dashed border-border rounded-2xl flex justify-center overflow-x-auto">
                  <PremiumHrDocument
                    docType={docType}
                    data={docFields}
                    settings={settings}
                    verificationToken={verificationToken}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action sidebar */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Form settings configuration sidebar */}
            {step === 2 && !viewId && (
              <Card className="border-border/50 shadow-sm bg-card">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Configure Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Common fields */}
                  <div className="space-y-1.5">
                    <Label htmlFor="issue-date" className="text-xs font-semibold">Issue Date</Label>
                    <Input 
                      id="issue-date"
                      type="date"
                      value={docFields.date}
                      onChange={(e) => handleFieldChange("date", e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>

                  {/* Document Specific forms */}
                  {docType === 'SALARY_CERTIFICATE' && (
                    <div className="space-y-1.5 pt-2 border-t border-border/40">
                      <Label htmlFor="purpose" className="text-xs font-semibold">Purpose of Issue</Label>
                      <Input
                        id="purpose"
                        placeholder="e.g. Visa application, Bank loan"
                        value={docFields.purpose}
                        onChange={(e) => handleFieldChange("purpose", e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  )}

                  {docType === 'WARNING_CERTIFICATE' && (
                    <div className="space-y-3 pt-2 border-t border-border/40">
                      <div className="space-y-1.5">
                        <Label htmlFor="warning-level" className="text-xs font-semibold">Warning Level</Label>
                        <Select value={docFields.warningLevel} onValueChange={v => handleFieldChange("warningLevel", v)}>
                          <SelectTrigger size="sm" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1st Warning">1st Warning</SelectItem>
                            <SelectItem value="2nd Warning">2nd Warning</SelectItem>
                            <SelectItem value="Final Warning">Final Warning</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="incident-date" className="text-xs font-semibold">Incident Date</Label>
                        <Input 
                          id="incident-date"
                          type="date"
                          value={docFields.incidentDate}
                          onChange={(e) => handleFieldChange("incidentDate", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="warning-reason" className="text-xs font-semibold">Infraction Description (Reason)</Label>
                        <Textarea 
                          id="warning-reason"
                          placeholder="Provide description of infraction..."
                          value={docFields.reason}
                          onChange={(e) => handleFieldChange("reason", e.target.value)}
                          className="min-h-[120px] text-xs leading-normal"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="issued-by" className="text-xs font-semibold">Issued By (Manager Name)</Label>
                        <Input 
                          id="issued-by"
                          value={docFields.issuedBy}
                          onChange={(e) => handleFieldChange("issuedBy", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {docType === 'INTERNSHIP_ACCEPTED_CERTIFICATE' && (
                    <div className="space-y-3 pt-2 border-t border-border/40">
                      <div className="space-y-1.5">
                        <Label htmlFor="coordinator-name" className="text-xs font-semibold">Coordinator / Committee Name</Label>
                        <Input
                          id="coordinator-name"
                          value={docFields.coordinatorName}
                          onChange={(e) => handleFieldChange("coordinatorName", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="degree-major" className="text-xs font-semibold">Degree / Major</Label>
                        <Input
                          id="degree-major"
                          value={docFields.degreeMajor}
                          onChange={(e) => handleFieldChange("degreeMajor", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="intern-duration" className="text-xs font-semibold">Internship Duration</Label>
                        <Input
                          id="intern-duration"
                          value={docFields.internshipDuration}
                          onChange={(e) => handleFieldChange("internshipDuration", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="intern-start" className="text-xs font-semibold">Start Date</Label>
                        <Input
                          id="intern-start"
                          type="date"
                          value={docFields.employeeHireDate}
                          onChange={(e) => handleFieldChange("employeeHireDate", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="intern-end" className="text-xs font-semibold">End Date</Label>
                        <Input
                          id="intern-end"
                          type="date"
                          value={docFields.employeeEndDate}
                          onChange={(e) => handleFieldChange("employeeEndDate", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="work-schedule" className="text-xs font-semibold">Work Schedule</Label>
                        <Input
                          id="work-schedule"
                          value={docFields.workSchedule}
                          onChange={(e) => handleFieldChange("workSchedule", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nature-internship" className="text-xs font-semibold">Nature of Internship</Label>
                        <Input
                          id="nature-internship"
                          value={docFields.natureOfInternship}
                          onChange={(e) => handleFieldChange("natureOfInternship", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="supervisor-name" className="text-xs font-semibold">Supervisor Name</Label>
                        <Input
                          id="supervisor-name"
                          value={docFields.supervisorName}
                          onChange={(e) => handleFieldChange("supervisorName", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="supervisor-title" className="text-xs font-semibold">Supervisor Title</Label>
                        <Input
                          id="supervisor-title"
                          value={docFields.supervisorTitle}
                          onChange={(e) => handleFieldChange("supervisorTitle", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task1" className="text-xs font-semibold">Responsibility / Task 1</Label>
                        <Input
                          id="task1"
                          value={docFields.task1}
                          onChange={(e) => handleFieldChange("task1", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task2" className="text-xs font-semibold">Responsibility / Task 2</Label>
                        <Input
                          id="task2"
                          value={docFields.task2}
                          onChange={(e) => handleFieldChange("task2", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task3" className="text-xs font-semibold">Responsibility / Task 3</Label>
                        <Input
                          id="task3"
                          value={docFields.task3}
                          onChange={(e) => handleFieldChange("task3", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {docType === 'INTERNSHIP_LETTER' && (
                    <div className="space-y-3 pt-2 border-t border-border/40">
                      <div className="space-y-1.5">
                        <Label htmlFor="institution-name" className="text-xs font-semibold">Institution Name</Label>
                        <Input
                          id="institution-name"
                          value={docFields.institutionName}
                          onChange={(e) => handleFieldChange("institutionName", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="degree-major" className="text-xs font-semibold">Degree / Major</Label>
                        <Input
                          id="degree-major"
                          value={docFields.degreeMajor}
                          onChange={(e) => handleFieldChange("degreeMajor", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="intern-duration" className="text-xs font-semibold">Internship Duration</Label>
                        <Input
                          id="intern-duration"
                          value={docFields.internshipDuration}
                          onChange={(e) => handleFieldChange("internshipDuration", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="intern-start" className="text-xs font-semibold">Start Date</Label>
                        <Input
                          id="intern-start"
                          type="date"
                          value={docFields.employeeHireDate}
                          onChange={(e) => handleFieldChange("employeeHireDate", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="intern-end" className="text-xs font-semibold">End Date</Label>
                        <Input
                          id="intern-end"
                          type="date"
                          value={docFields.employeeEndDate}
                          onChange={(e) => handleFieldChange("employeeEndDate", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task1" className="text-xs font-semibold">Responsibility / Task 1</Label>
                        <Input
                          id="task1"
                          value={docFields.task1}
                          onChange={(e) => handleFieldChange("task1", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task2" className="text-xs font-semibold">Responsibility / Task 2</Label>
                        <Input
                          id="task2"
                          value={docFields.task2}
                          onChange={(e) => handleFieldChange("task2", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="task3" className="text-xs font-semibold">Responsibility / Task 3</Label>
                        <Input
                          id="task3"
                          value={docFields.task3}
                          onChange={(e) => handleFieldChange("task3", e.target.value)}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Allowances Editor for Salary Cert */}
                  {docType === 'SALARY_CERTIFICATE' && (
                    <div className="space-y-3 pt-4 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Allowances</Label>
                        <Button variant="ghost" size="sm" onClick={addAllowanceRow} className="h-6 text-[10px] font-bold text-primary">
                          + Add Line
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {docFields.otherAllowances?.map((allowance: any, idx: number) => (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <Input
                              placeholder="Label"
                              value={allowance.label}
                              onChange={(e) => handleAllowanceChange(idx, 'label', e.target.value)}
                              className="h-8 text-xs rounded-lg flex-1"
                            />
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={allowance.amount}
                              onChange={(e) => handleAllowanceChange(idx, 'amount', e.target.value)}
                              className="h-8 text-xs rounded-lg w-20"
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeAllowanceRow(idx)} className="h-8 w-8 text-red-500 rounded-lg hover:bg-red-500/10">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Core Action Buttons */}
                  <div className="pt-4 border-t border-border/40 space-y-3">
                    <Button 
                      onClick={handleDownload} 
                      disabled={isSubmitting}
                      className="w-full h-10 gap-1.5 font-semibold text-xs rounded-xl shadow-premium"
                      variant="hero"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Save & Download PDF
                    </Button>
                    <Button 
                      onClick={handleSaveDraft} 
                      disabled={isSubmitting}
                      className="w-full h-10 gap-1.5 font-semibold text-xs rounded-xl"
                      variant="outline"
                    >
                      Save Draft
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approvals Review Sidebar (If viewing a pending document) */}
            {viewId && docFields.status === 'PENDING_APPROVAL' && (
              <Card className="border-border/50 shadow-sm bg-card border-amber-500/20">
                <CardHeader className="pb-3 border-b border-border/40 bg-amber-500/5">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-amber-800">
                    <ShieldAlert className="h-4 w-4 text-amber-600" /> Pending Approval Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="approval-comment" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Approval / Rejection Comment
                    </Label>
                    <Textarea 
                      id="approval-comment"
                      placeholder="Specify approval conditions or rejection reasons here..."
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      className="min-h-[100px] text-xs leading-normal"
                    />
                  </div>

                  <div className="space-y-2">
                    <Button 
                      onClick={handleApproveWarning}
                      disabled={isSubmitting}
                      className="w-full h-10 gap-1.5 text-xs font-bold rounded-xl shadow-premium"
                      variant="hero"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve & Sign Document
                    </Button>
                    <Button 
                      onClick={handleRejectWarning}
                      disabled={isSubmitting}
                      className="w-full h-10 gap-1.5 text-xs font-bold rounded-xl"
                      variant="destructive"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Reject Document
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document metadata info card */}
            {step === 2 && (
              <Card className="border-border/50 shadow-sm bg-card text-xs text-muted-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Reference No.</span>
                    <span className="font-bold text-foreground font-mono">{docFields.docNumber || 'Auto-generated'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Employee Name</span>
                    <span className="font-bold text-foreground">{docFields.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contract Type</span>
                    <span className="font-bold text-foreground">{docFields.employeeContractType}</span>
                  </div>
                  {docFields.status && (
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="font-mono uppercase font-black text-primary">{docFields.status}</span>
                    </div>
                  )}
                  {docFields.version && (
                    <div className="flex justify-between">
                      <span>Version</span>
                      <span className="font-bold text-foreground font-mono">v{docFields.version}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
