import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ArrowLeft, ArrowRight, Save, User, Mail, Phone, Briefcase, DollarSign, 
  Calendar, FileText, Upload, Trash2, CheckCircle, AlertCircle, File, Eye, X, Plus, Shield, Lock
} from "lucide-react";
import { useAgencyStore, TeamMember, EmployeeFile } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { viewProtectedFile } from "@/lib/api-client";
import FilePreviewModal from "@/components/FilePreviewModal";
import { Badge } from "@/components/ui/badge";

const DEPARTMENTS = ["Leadership", "Creative", "Marketing", "Development", "Operations", "Sales", "Finance", "Support"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contractor", "Intern"];
const WORK_LOCATIONS = ["Office", "Remote", "Hybrid"];
const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Cheque"];
const CURRENCIES = ["USD", "EUR", "GBP", "AED", "DJF", "SAR"];

const COUNTRIES_WITH_FLAGS = [
  { flag: "🇺🇸", name: "United States", nationality: "American" },
  { flag: "🇬🇧", name: "United Kingdom", nationality: "British" },
  { flag: "🇨🇦", name: "Canada", nationality: "Canadian" },
  { flag: "🇦🇪", name: "United Arab Emirates", nationality: "Emirati" },
  { flag: "🇩🇯", name: "Djibouti", nationality: "Djiboutian" },
  { flag: "🇸🇦", name: "Saudi Arabia", nationality: "Saudi" },
  { flag: "🇰🇪", name: "Kenya", nationality: "Kenyan" },
  { flag: "🇸🇴", name: "Somalia", nationality: "Somali" },
  { flag: "🇫🇷", name: "France", nationality: "French" },
  { flag: "🇩🇪", name: "Germany", nationality: "German" },
  { flag: "🇮🇳", name: "India", nationality: "Indian" },
  { flag: "🇹🇷", name: "Turkey", nationality: "Turkish" },
  { flag: "🇦🇺", name: "Australia", nationality: "Australian" },
];

const COUNTRY_CODES = [
  { code: "+1", flag: "🇺🇸", label: "US/CA (+1)" },
  { code: "+44", flag: "🇬🇧", label: "UK (+44)" },
  { code: "+971", flag: "🇦🇪", label: "UAE (+971)" },
  { code: "+253", flag: "🇩🇯", label: "DJ (+253)" },
  { code: "+252", flag: "🇸🇴", label: "SO (+252)" },
  { code: "+254", flag: "🇰🇪", label: "KE (+254)" },
  { code: "+966", flag: "🇸🇦", label: "SA (+966)" },
  { code: "+33", flag: "🇫🇷", label: "FR (+33)" },
  { code: "+49", flag: "🇩🇪", label: "DE (+49)" },
  { code: "+91", flag: "🇮🇳", label: "IN (+91)" },
  { code: "+90", flag: "🇹🇷", label: "TR (+90)" },
  { code: "+61", flag: "🇦🇺", label: "AU (+61)" },
];

export default function AddEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    team, 
    addTeamMember, 
    updateTeamMember, 
    uploadFile, 
    fetchEmployeeFiles, 
    uploadEmployeeFile, 
    deleteEmployeeFile,
    provisionEmployeeAccess
  } = useAgencyStore();
  const { toast } = useToast();

  const isEditMode = !!id;

  // Form State
  const [form, setForm] = useState<Partial<TeamMember>>({
    name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    status: "Draft",
    bio: "",
    dateOfBirth: "",
    gender: "",
    nationalId: "",
    nationalIdType: "National ID Card",
    nationality: "",
    homeAddress: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    employmentType: "Full-time",
    managerId: "",
    workLocation: "Office",
    isHourlyMode: false,
    hourlyRate: "",
    basicSalary: "",
    housingAllowance: "",
    transportAllowance: "",
    otherAllowances: "[]",
    bankName: "",
    accountNumber: "",
    taxId: "",
    paymentMethod: "Bank Transfer",
    currency: "USD",
    photoUrl: "",
  });

  const [dbEmployeeId, setDbEmployeeId] = useState<string | null>(id || null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Phone number state
  const [phoneCode, setPhoneCode] = useState("+1");
  const [phoneLocal, setPhoneLocal] = useState("");

  // Multiple Emergency Contacts state
  const [emergencyContacts, setEmergencyContacts] = useState<{ name: string; relation: string; phoneCode: string; phoneLocal: string }[]>([
    { name: "", relation: "", phoneCode: "+1", phoneLocal: "" }
  ]);

  const hasInitializedPhoneRef = useRef(false);

  // Files uploaded in Step 3
  const [uploadedFiles, setUploadedFiles] = useState<EmployeeFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState<Record<string, boolean>>({});
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewFileLabel, setPreviewFileLabel] = useState<string>("");
  const [systemAccessPassword, setSystemAccessPassword] = useState("");
  const [systemAccessRole, setSystemAccessRole] = useState("STAFF");
  const [isProvisioningAccess, setIsProvisioningAccess] = useState(false);

  // Dynamic Allowances List
  const [allowanceList, setAllowanceList] = useState<{ label: string; amount: string }[]>([]);

  // Load existing employee data (Edit Mode / Local Storage Draft)
  useEffect(() => {
    if (isEditMode && id) {
      const member = team.find((m) => m.id === id);
      if (member) {
        setForm(member);
        setDbEmployeeId(member.id);
        
        // Parse allowances
        try {
          const parsed = JSON.parse(member.otherAllowances || "[]");
          setAllowanceList(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAllowanceList([]);
        }

        // Fetch files
        fetchEmployeeFiles(id).then((files) => {
          setUploadedFiles(files);
        });
      } else {
        toast({ title: "Employee not found", variant: "destructive" });
        navigate("/dashboard/team");
      }
    } else {
      // Check for Draft in localStorage
      const draft = localStorage.getItem("employee_wizard_draft");
      if (draft) {
        try {
          const { form: draftForm, employeeId: draftId, step } = JSON.parse(draft);
          if (draftForm && draftForm.name) {
            setForm(draftForm);
            setDbEmployeeId(draftId);
            setCurrentStep(step || 1);
            if (draftForm.otherAllowances) {
              try {
                setAllowanceList(JSON.parse(draftForm.otherAllowances));
              } catch {}
            }
            if (draftId) {
              fetchEmployeeFiles(draftId).then((files) => {
                setUploadedFiles(files);
              });
            }
            toast({
              title: "Draft Resumed",
              description: `Resumed draft onboarding for ${draftForm.name}`,
            });
          }
        } catch (e) {
          localStorage.removeItem("employee_wizard_draft");
        }
      }
    }
  }, [id, isEditMode, team, navigate, toast, fetchEmployeeFiles]);

  // Parse phone & emergency contacts from loaded form state
  useEffect(() => {
    if (form.name && !hasInitializedPhoneRef.current) {
      hasInitializedPhoneRef.current = true;

      // Parse Phone
      if (form.phone) {
        const parts = form.phone.split(" ");
        if (parts.length > 1 && parts[0].startsWith("+")) {
          setPhoneCode(parts[0]);
          setPhoneLocal(parts.slice(1).join(" "));
        } else {
          setPhoneCode("+1");
          setPhoneLocal(form.phone);
        }
      }

      // Parse Emergency Contacts
      if (form.emergencyContactName) {
        try {
          if (form.emergencyContactName.startsWith("[")) {
            const parsed = JSON.parse(form.emergencyContactName);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setEmergencyContacts(parsed.map(c => {
                const phoneParts = (c.phone || "").split(" ");
                const phoneCode = phoneParts.length > 1 && phoneParts[0].startsWith("+") ? phoneParts[0] : "+1";
                const phoneLocal = phoneParts.length > 1 ? phoneParts.slice(1).join(" ") : c.phone || "";
                return {
                  name: c.name || "",
                  relation: c.relation || "",
                  phoneCode,
                  phoneLocal
                };
              }));
              return;
            }
          }
        } catch (e) {}

        const phoneParts = (form.emergencyContactPhone || "").split(" ");
        const pCode = phoneParts.length > 1 && phoneParts[0].startsWith("+") ? phoneParts[0] : "+1";
        const pLocal = phoneParts.length > 1 ? phoneParts.slice(1).join(" ") : form.emergencyContactPhone || "";
        setEmergencyContacts([{
          name: form.emergencyContactName || "",
          relation: form.emergencyContactRelation || "",
          phoneCode: pCode,
          phoneLocal: pLocal
        }]);
      }
    }
  }, [form]);

  // Sync allowance list to form state
  useEffect(() => {
    setForm(prev => ({ ...prev, otherAllowances: JSON.stringify(allowanceList) }));
  }, [allowanceList]);

  // Auto-Save Draft every 30 seconds
  useEffect(() => {
    if (isEditMode) return; // Don't auto-save to localStorage in edit mode

    const interval = setInterval(() => {
      if (form.name || form.email) {
        localStorage.setItem(
          "employee_wizard_draft",
          JSON.stringify({ form, employeeId: dbEmployeeId, step: currentStep })
        );
        
        // If we already have a database ID, update the DB record silently
        if (dbEmployeeId) {
          updateTeamMember(dbEmployeeId, {
            ...form,
            status: "Draft",
          }).catch(console.error);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [form, dbEmployeeId, currentStep, isEditMode, updateTeamMember]);

  // Helper to compile phone number and emergency contacts JSON
  const getUpdatedFormWithContacts = (currentForm: Partial<TeamMember>) => {
    const formattedContacts = emergencyContacts.map(c => ({
      name: c.name,
      relation: c.relation,
      phone: `${c.phoneCode} ${c.phoneLocal}`.trim()
    }));

    return {
      ...currentForm,
      phone: `${phoneCode} ${phoneLocal}`.trim(),
      emergencyContactName: JSON.stringify(formattedContacts),
      // Fallback for flat database columns
      emergencyContactRelation: emergencyContacts[0]?.relation || "",
      emergencyContactPhone: `${emergencyContacts[0]?.phoneCode || "+1"} ${emergencyContacts[0]?.phoneLocal || ""}`.trim()
    };
  };

  // Save progress helper (Step advance/click)
  const saveProgress = async () => {
    const fullForm = getUpdatedFormWithContacts(form);
    localStorage.setItem(
      "employee_wizard_draft",
      JSON.stringify({ form: fullForm, employeeId: dbEmployeeId, step: currentStep })
    );

    if (dbEmployeeId) {
      try {
        await updateTeamMember(dbEmployeeId, fullForm);
      } catch (err) {
        console.error("Failed to update draft in database:", err);
      }
    } else if (fullForm.name && fullForm.email) {
      try {
        const created = await addTeamMember({
          ...fullForm,
          status: "Draft",
          role: fullForm.role || "Draft Member",
        } as Omit<TeamMember, "id">);
        if (created && created.id) {
          setDbEmployeeId(created.id);
          localStorage.setItem(
            "employee_wizard_draft",
            JSON.stringify({ form: fullForm, employeeId: created.id, step: currentStep })
          );
        }
      } catch (err) {
        console.error("Failed to create draft in database:", err);
      }
    }
  };

  const handlePhoneChange = (code: string, local: string) => {
    setPhoneCode(code);
    setPhoneLocal(local);
    setForm(prev => ({ ...prev, phone: `${code} ${local}`.trim() }));
  };

  const setField = (field: keyof TeamMember, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Financial Calculations
  const calculateGrossTotal = () => {
    const basic = parseFloat(String(form.basicSalary || "").replace(/[^0-9.]/g, "")) || 0;
    const housing = parseFloat(String(form.housingAllowance || "").replace(/[^0-9.]/g, "")) || 0;
    const transport = parseFloat(String(form.transportAllowance || "").replace(/[^0-9.]/g, "")) || 0;
    const allowancesSum = allowanceList.reduce((sum, item) => {
      const amt = parseFloat(item.amount.replace(/[^0-9.]/g, "")) || 0;
      return sum + amt;
    }, 0);
    return basic + housing + transport + allowancesSum;
  };

  // Validation
  const validateStep = (step: number) => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!form.name?.trim()) e.name = "Full name is required";
      if (!form.email?.trim()) e.email = "Email address is required";
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email address";
      if (!form.nationalId?.trim()) e.nationalId = "National ID / Passport Number is required";
    }
    if (step === 2) {
      if (!form.role?.trim()) e.role = "Job Title / Role is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Stepper Click handler
  const handleStepClick = async (step: number) => {
    // Only allow navigating to steps we've unlocked or backwards
    if (step < currentStep) {
      await saveProgress();
      setCurrentStep(step);
    } else {
      // Validate all previous steps
      let valid = true;
      for (let i = 1; i < step; i++) {
        if (!validateStep(i)) {
          setCurrentStep(i);
          valid = false;
          break;
        }
      }
      if (valid) {
        await saveProgress();
        setCurrentStep(step);
      }
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    await saveProgress();
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handlePrev = async () => {
    await saveProgress();
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Profile Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast({ title: "Uploading photo...", description: "Please wait..." });
      const url = await uploadFile(file);
      setField("photoUrl", url);
      toast({ title: "Photo uploaded successfully!" });
    } catch (err) {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    }
  };

  // Document Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fullForm = getUpdatedFormWithContacts(form);

    if (!dbEmployeeId) {
      // Create draft first
      try {
        const created = await addTeamMember({
          ...fullForm,
          status: "Draft",
          role: fullForm.role || "Draft Member",
        } as Omit<TeamMember, "id">);
        if (created && created.id) {
          setDbEmployeeId(created.id);
          await performUpload(created.id, file, category, label);
        }
      } catch (err) {
        toast({ title: "Failed to save draft before file upload", variant: "destructive" });
      }
    } else {
      await performUpload(dbEmployeeId, file, category, label);
    }
  };

  const performUpload = async (empId: string, file: File, category: string, label: string) => {
    const slotKey = `${category}-${label}`;
    setIsUploadingFile(prev => ({ ...prev, [slotKey]: true }));
    try {
      const uploaded = await uploadEmployeeFile(empId, file, category, label);
      setUploadedFiles(prev => [uploaded, ...prev]);
      toast({ title: "File uploaded successfully!" });
    } catch (err: any) {
      toast({ title: "Failed to upload file", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingFile(prev => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!dbEmployeeId) return;
    try {
      await deleteEmployeeFile(dbEmployeeId, fileId);
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      toast({ title: "File deleted successfully" });
    } catch (err) {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  };

  // Final Action: Complete / Save
  const handleFinalSubmit = async () => {
    const fullForm = getUpdatedFormWithContacts(form);
    
    // 1. Immediately save locally to prevent data loss on validation failure
    localStorage.setItem(
      "employee_wizard_draft",
      JSON.stringify({ form: fullForm, employeeId: dbEmployeeId, step: currentStep })
    );

    // Validate all steps
    for (let i = 1; i <= 4; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        toast({ title: "Validation Error", description: `Please correct errors in Step ${i}`, variant: "destructive" });
        return;
      }
    }

    // Check status gate requirements
    // Stars (*) requirements: Full Name, Email, Job Title, National ID, National ID scan, Signed Contract.
    const hasIdScan = uploadedFiles.some(f => f.category === 'ID_DOC');
    const hasContract = uploadedFiles.some(f => f.category === 'CONTRACT');
    const isMissingRequirements = 
      !fullForm.name?.trim() || 
      !fullForm.email?.trim() || 
      !fullForm.role?.trim() || 
      !fullForm.nationalId?.trim() || 
      !hasIdScan || 
      !hasContract;

    const targetStatus = form.status === "Terminated" 
      ? "Terminated" 
      : (isMissingRequirements ? "Pending Documents" : "Active");

    try {
      if (dbEmployeeId) {
        await updateTeamMember(dbEmployeeId, {
          ...fullForm,
          status: targetStatus,
        });
      } else {
        await addTeamMember({
          ...fullForm,
          status: targetStatus,
        } as Omit<TeamMember, "id">);
      }

      localStorage.removeItem("employee_wizard_draft");
      toast({
        title: isEditMode ? "Employee Profile Updated" : "Employee Onboarded!",
        description: isMissingRequirements 
          ? `${fullForm.name} saved as Pending Documents due to missing ID scan or Contract.` 
          : `${fullForm.name} has been successfully onboarded as ${targetStatus}.`,
      });
      navigate("/dashboard/team");
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Unknown error';
      console.error('[Save Employee] Error:', msg, err);
      toast({
        title: "Failed to save employee",
        description: msg,
        variant: "destructive",
      });
    }
  };

  // Save draft locally and optionally sync to backend
  const handleSaveDraft = async () => {
    const fullForm = getUpdatedFormWithContacts(form);

    // 1. Save to local storage first, so data is NEVER lost
    localStorage.setItem(
      "employee_wizard_draft",
      JSON.stringify({ form: fullForm, employeeId: dbEmployeeId, step: currentStep })
    );

    // 2. Try to sync with server, but don't block the user if it fails or fields are missing
    try {
      if (dbEmployeeId) {
        await updateTeamMember(dbEmployeeId, {
          ...fullForm,
          status: form.status === "Terminated" ? "Terminated" : "Draft",
        });
      } else if (fullForm.name?.trim() && fullForm.email?.trim()) {
        const created = await addTeamMember({
          ...fullForm,
          status: "Draft",
          role: fullForm.role || "Draft Member",
        } as Omit<TeamMember, "id">);
        if (created && created.id) {
          setDbEmployeeId(created.id);
        }
      }
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved successfully.",
      });
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Unknown error';
      console.warn('[Save Draft] Backend sync failed:', msg, err);
      toast({
        title: "Saved Locally (sync failed)",
        description: msg,
      });
    }
    navigate("/dashboard/team");
  };

  const handleCancel = () => {
    localStorage.removeItem("employee_wizard_draft");
    navigate("/dashboard/team");
  };

  // Get specific file upload slot state
  const getSlotFile = (category: string, label?: string) => {
    return uploadedFiles.find(
      f => f.category === category && (!label || f.label === label)
    );
  };

  const getSlotFiles = (category: string) => {
    // Return all files matching category that are not CV/ID/Contract specific (for multi-file slots)
    if (category === 'CERTIFICATE') return uploadedFiles.filter(f => f.category === 'CERTIFICATE');
    if (category === 'OTHER') return uploadedFiles.filter(f => f.category === 'OTHER');
    return [];
  };

  // Check required items checklist for Step 5
  const hasIdScan = uploadedFiles.some(f => f.category === 'ID_DOC');
  const hasContract = uploadedFiles.some(f => f.category === 'CONTRACT');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {isEditMode ? "Edit Employee Profile" : "Add Employee Wizard"}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {isEditMode ? `Update details for ${form.name}` : "Multi-step employee onboarding process"}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-card border border-border shadow-card rounded-2xl p-5 md:p-6 mb-2">
        <div className="flex items-center max-w-3xl mx-auto">
          {[
            { step: 1, label: "Personal" },
            { step: 2, label: "Employment" },
            { step: 3, label: "Documents" },
            { step: 4, label: "Payroll" },
            { step: 5, label: "Review" },
          ].map((s, index) => (
            <React.Fragment key={s.step}>
              {/* Step button */}
              <button
                onClick={() => handleStepClick(s.step)}
                className="flex flex-col items-center gap-2 z-10 focus:outline-none group shrink-0"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 shadow-sm ${
                    currentStep === s.step
                      ? "bg-secondary border-secondary text-secondary-foreground scale-110 shadow-md"
                      : currentStep > s.step
                      ? "bg-secondary/20 border-secondary text-secondary"
                      : "bg-card border-border text-muted-foreground group-hover:border-muted-foreground/50"
                  }`}
                >
                  {currentStep > s.step ? "✓" : s.step}
                </div>
                <span
                  className={`text-xs font-semibold hidden md:inline transition-colors ${
                    currentStep === s.step ? "text-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </button>

              {/* Connector — only render between steps, not after the last */}
              {index < 4 && (
                <div className="flex-1 h-0.5 mx-1 bg-border relative overflow-hidden -mt-5 md:-mt-6">
                  <div
                    className={`absolute inset-y-0 left-0 bg-secondary transition-all duration-500 ease-in-out ${
                      currentStep > s.step ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-5">
          {/* STEP 1: PERSONAL INFORMATION */}
          {currentStep === 1 && (
            <Card className="shadow-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </CardTitle>
                <CardDescription>Enter primary contact and identity details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Photo Upload Slot */}
                <div className="flex flex-col sm:flex-row items-center gap-5 pb-2 border-b border-border/50">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center shadow-inner">
                      {form.photoUrl ? (
                        <img src={form.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-10 w-10 text-muted-foreground/60" />
                      )}
                    </div>
                    <label className="absolute inset-0 w-full h-full rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold uppercase tracking-wider">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Profile Picture</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Circular preview. Recommended square image, max 2MB.</p>
                    {form.photoUrl && (
                      <Button variant="link" size="sm" onClick={() => setField("photoUrl", "")} className="text-destructive h-auto p-0 mt-1">
                        Remove photo
                      </Button>
                    )}
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-name">Full Name <span className="text-destructive">*</span></Label>
                    <Input id="emp-name" placeholder="John Doe" value={form.name} onChange={(e) => setField("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-email">Email Address <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="emp-email" type="email" placeholder="john@agencyflow.com" className={`pl-9 ${errors.email ? "border-destructive" : ""}`} value={form.email} onChange={(e) => setField("email", e.target.value)} />
                      </div>
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-phone">Phone Number</Label>
                      <div className="flex gap-2">
                        <Select value={phoneCode} onValueChange={(v) => handlePhoneChange(v, phoneLocal)}>
                          <SelectTrigger className="w-[110px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((cc) => (
                              <SelectItem key={cc.code} value={cc.code}>
                                <span className="mr-1.5">{cc.flag}</span>
                                {cc.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="emp-phone" type="tel" placeholder="555-0000" className="pl-9" value={phoneLocal} onChange={(e) => handlePhoneChange(phoneCode, e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-dob">Date of Birth</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="emp-dob" type="date" className="pl-9" value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-gender">Gender</Label>
                      <Select value={form.gender} onValueChange={(v) => setField("gender", v)}>
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-nationalIdType">ID Document Type <span className="text-destructive">*</span></Label>
                      <Select value={form.nationalIdType || "National ID Card"} onValueChange={(v) => setField("nationalIdType", v)}>
                        <SelectTrigger id="emp-nationalIdType">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="National ID Card">National ID Card</SelectItem>
                          <SelectItem value="Passport">Passport</SelectItem>
                          <SelectItem value="Driver's License">Driver's License</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-nationalId">ID / Document Number <span className="text-destructive">*</span></Label>
                      <Input id="emp-nationalId" placeholder="A12345678" value={form.nationalId} onChange={(e) => setField("nationalId", e.target.value)} className={errors.nationalId ? "border-destructive" : ""} />
                      {errors.nationalId && <p className="text-xs text-destructive">{errors.nationalId}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-nationality">Nationality</Label>
                      <Select value={form.nationality} onValueChange={(v) => setField("nationality", v)}>
                        <SelectTrigger id="emp-nationality"><SelectValue placeholder="Select nationality" /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES_WITH_FLAGS.map((c) => (
                            <SelectItem key={c.nationality} value={c.nationality}>
                              <span className="mr-2">{c.flag}</span>
                              {c.nationality} ({c.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="emp-address">Home Address</Label>
                    <Textarea id="emp-address" placeholder="123 Main St, Apartment 4B, New York, NY" className="min-h-[80px]" value={form.homeAddress} onChange={(e) => setField("homeAddress", e.target.value)} />
                  </div>

                  {/* Multiple Emergency Contacts */}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm flex items-center gap-1.5 text-foreground/80">
                        <User className="h-3.5 w-3.5 text-primary" /> Emergency Contact Info
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEmergencyContacts(prev => [...prev, { name: "", relation: "", phoneCode: "+1", phoneLocal: "" }])}
                        className="h-8 gap-1.5 text-xs text-primary font-semibold hover:bg-primary/5 rounded-lg"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Contact
                      </Button>
                    </div>

                    {emergencyContacts.map((contact, idx) => (
                      <div key={idx} className="p-3 bg-card border rounded-xl space-y-3 relative animate-in fade-in duration-200">
                        {emergencyContacts.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEmergencyContacts(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <div className="grid sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Contact Name</Label>
                            <Input
                              placeholder="Jane Doe"
                              value={contact.name}
                              onChange={(e) => {
                                const newC = [...emergencyContacts];
                                newC[idx].name = e.target.value;
                                setEmergencyContacts(newC);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Relationship</Label>
                            <Input
                              placeholder="Spouse"
                              value={contact.relation}
                              onChange={(e) => {
                                const newC = [...emergencyContacts];
                                newC[idx].relation = e.target.value;
                                setEmergencyContacts(newC);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Phone Number</Label>
                            <div className="flex gap-1.5">
                              <Select
                                value={contact.phoneCode}
                                onValueChange={(v) => {
                                  const newC = [...emergencyContacts];
                                  newC[idx].phoneCode = v;
                                  setEmergencyContacts(newC);
                                }}
                              >
                                <SelectTrigger className="w-[85px] shrink-0 h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_CODES.map((cc) => (
                                    <SelectItem key={cc.code} value={cc.code} className="text-xs">
                                      {cc.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="555-9999"
                                className="h-9"
                                value={contact.phoneLocal}
                                onChange={(e) => {
                                  const newC = [...emergencyContacts];
                                  newC[idx].phoneLocal = e.target.value;
                                  setEmergencyContacts(newC);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: EMPLOYMENT DETAILS */}
          {currentStep === 2 && (
            <Card className="shadow-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> Employment Details
                </CardTitle>
                <CardDescription>Specify role, structure, and hierarchy details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-role">Job Title / Role <span className="text-destructive">*</span></Label>
                    <Input id="emp-role" placeholder="Senior Product Designer" value={form.role} onChange={(e) => setField("role", e.target.value)} className={errors.role ? "border-destructive" : ""} />
                    {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Select value={form.department} onValueChange={(v) => setField("department", v)}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Employment Type</Label>
                    <Select value={form.employmentType} onValueChange={(v) => setField("employmentType", v)}>
                      <SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reports To / Manager</Label>
                    <Select value={form.managerId || "none"} onValueChange={(v) => setField("managerId", v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Manager (Self / Leadership)</SelectItem>
                        {team.filter(m => m.id !== dbEmployeeId).map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-startDate">Start Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="emp-startDate" type="date" className="pl-9" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Work Location</Label>
                    <Select value={form.workLocation} onValueChange={(v) => setField("workLocation", v)}>
                      <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                      <SelectContent>
                        {WORK_LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="emp-bio">Professional Bio / Notes</Label>
                  <Textarea id="emp-bio" placeholder="Brief professional description or additional notes about this team member..." className="min-h-[120px]" value={form.bio} onChange={(e) => setField("bio", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: DOCUMENTS & FILES */}
          {currentStep === 3 && (
            <Card className="shadow-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Documents & Files
                </CardTitle>
                <CardDescription>Upload identity and signed contracts (Max 15MB each)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Specific Slots */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Slot 1: National ID / Passport scan * */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      National ID / Passport Scan <span className="text-destructive">*</span>
                    </Label>
                    <UploadSlot 
                      category="ID_DOC" 
                      label="National ID scan"
                      isUploading={isUploadingFile["ID_DOC-National ID scan"]}
                      file={getSlotFile("ID_DOC", "National ID scan")}
                      onUpload={(e) => handleFileUpload(e, "ID_DOC", "National ID scan")}
                      onDelete={handleFileDelete}
                      onPreview={(url, label) => { setPreviewFileUrl(url); setPreviewFileLabel(label); }}
                    />
                  </div>

                  {/* Slot 2: Signed Employment Contract * */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Signed Employment Contract <span className="text-destructive">*</span>
                    </Label>
                    <UploadSlot 
                      category="CONTRACT" 
                      label="Signed Contract"
                      isUploading={isUploadingFile["CONTRACT-Signed Contract"]}
                      file={getSlotFile("CONTRACT", "Signed Contract")}
                      onUpload={(e) => handleFileUpload(e, "CONTRACT", "Signed Contract")}
                      onDelete={handleFileDelete}
                      onPreview={(url, label) => { setPreviewFileUrl(url); setPreviewFileLabel(label); }}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6 pt-2">
                  {/* Slot 3: CV / Resume */}
                  <div className="space-y-2">
                    <Label>CV / Resume</Label>
                    <UploadSlot 
                      category="CV" 
                      label="Resume"
                      isUploading={isUploadingFile["CV-Resume"]}
                      file={getSlotFile("CV", "Resume")}
                      onUpload={(e) => handleFileUpload(e, "CV", "Resume")}
                      onDelete={handleFileDelete}
                      onPreview={(url, label) => { setPreviewFileUrl(url); setPreviewFileLabel(label); }}
                    />
                  </div>
                </div>

                {/* Multi-file Slots */}
                <div className="border-t border-border/60 pt-4 space-y-6">
                  {/* Educational Certificates */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm">Educational Certificates</h4>
                      <p className="text-xs text-muted-foreground">Upload degrees, diplomas, or transcripts.</p>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      {getSlotFiles("CERTIFICATE").map((file) => (
                        <div key={file.id} className="p-3 rounded-xl border border-border flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <File className="h-4 w-4 shrink-0 text-primary" />
                            <span className="text-xs font-medium truncate">{file.label}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleFileDelete(file.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <div className="h-16">
                        <UploadSlotMini 
                          isUploading={isUploadingFile["CERTIFICATE-EduCert"]}
                          onUpload={(e) => handleFileUpload(e, "CERTIFICATE", `Degree Cert ${Date.now()}`)}
                          placeholder="Add Certificate"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Professional Certifications */}
                  <div className="space-y-3 border-t border-border/40 pt-4">
                    <div>
                      <h4 className="font-semibold text-sm">Professional Certifications</h4>
                      <p className="text-xs text-muted-foreground">Upload active licenses, AWS, Scrum, etc.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {uploadedFiles.filter(f => f.category === 'CERTIFICATE' && f.label.includes('License')).map((file) => (
                        <div key={file.id} className="p-3 rounded-xl border border-border flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <File className="h-4 w-4 shrink-0 text-primary" />
                            <span className="text-xs font-medium truncate">{file.label}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleFileDelete(file.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <div className="h-16">
                        <UploadSlotMini 
                          isUploading={isUploadingFile["CERTIFICATE-License"]}
                          onUpload={(e) => handleFileUpload(e, "CERTIFICATE", `License Cert ${Date.now()}`)}
                          placeholder="Add Certification"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Other / User Labeled */}
                  <div className="space-y-3 border-t border-border/40 pt-4">
                    <div>
                      <h4 className="font-semibold text-sm">Other Documents</h4>
                      <p className="text-xs text-muted-foreground">Any other paperwork or records.</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {getSlotFiles("OTHER").map((file) => (
                        <div key={file.id} className="p-3 rounded-xl border border-border flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <File className="h-4 w-4 shrink-0 text-primary" />
                            <span className="text-xs font-medium truncate">{file.label}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleFileDelete(file.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <div className="h-16 flex items-center gap-2">
                        <UploadSlotMini 
                          isUploading={isUploadingFile["OTHER-Doc"]}
                          onUpload={(e) => {
                            const name = prompt("Enter a custom label for this document:");
                            if (name) {
                              handleFileUpload(e, "OTHER", name);
                            }
                          }}
                          placeholder="Add Labeled Document"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* STEP 4: PAYROLL & BANKING */}
          {currentStep === 4 && (
            <Card className="shadow-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Payroll & Banking
                </CardTitle>
                <CardDescription>Configure salary breakdown, banking, and tax parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Mode Select / Currency */}
                <div className="grid sm:grid-cols-3 gap-4 pb-2 border-b border-border/50">
                  <div className="space-y-1.5">
                    <Label>Salary Model</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          checked={!form.isHourlyMode} 
                          onChange={() => setField("isHourlyMode", false)} 
                          className="text-primary accent-primary" 
                        />
                        Fixed Monthly Salary
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          checked={!!form.isHourlyMode} 
                          onChange={() => setField("isHourlyMode", true)} 
                          className="text-primary accent-primary" 
                        />
                        Hourly Rate
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="emp-currency">Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                      <SelectTrigger id="emp-currency"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Payroll Model Details */}
                {form.isHourlyMode ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="max-w-sm space-y-1.5">
                      <Label htmlFor="emp-hourly">Hourly Rate Amount <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="emp-hourly" 
                          placeholder="85.00" 
                          className="pl-9" 
                          value={form.hourlyRate} 
                          onChange={(e) => setField("hourlyRate", e.target.value)} 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Will be billed on worked hours calculated monthly.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="emp-basic">Basic Salary <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="emp-basic" 
                            placeholder="4500.00" 
                            className="pl-9" 
                            value={form.basicSalary} 
                            onChange={(e) => setField("basicSalary", e.target.value)} 
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="emp-housing">Housing Allowance</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="emp-housing" 
                            placeholder="1200.00" 
                            className="pl-9" 
                            value={form.housingAllowance} 
                            onChange={(e) => setField("housingAllowance", e.target.value)} 
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="emp-transport">Transport Allowance</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="emp-transport" 
                            placeholder="300.00" 
                            className="pl-9" 
                            value={form.transportAllowance} 
                            onChange={(e) => setField("transportAllowance", e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Custom allowances */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <Label>Other Allowances</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setAllowanceList(prev => [...prev, { label: "", amount: "" }])}
                          className="h-8 gap-1.5 text-xs text-primary font-semibold hover:bg-primary/5 rounded-lg"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Allowance
                        </Button>
                      </div>

                      {allowanceList.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 animate-in slide-in-from-top-1 duration-200">
                          <Input 
                            placeholder="Allowance Name (e.g. Health Insurance)" 
                            value={item.label} 
                            onChange={(e) => {
                              const newL = [...allowanceList];
                              newL[idx].label = e.target.value;
                              setAllowanceList(newL);
                            }}
                          />
                          <div className="relative max-w-[200px]">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Amount" 
                              className="pl-9"
                              value={item.amount} 
                              onChange={(e) => {
                                const newL = [...allowanceList];
                                newL[idx].amount = e.target.value;
                                setAllowanceList(newL);
                              }}
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setAllowanceList(prev => prev.filter((_, i) => i !== idx))}
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Calculated Gross Total */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Gross Monthly Salary</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Sum of basic salary and all active allowances.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-muted-foreground block uppercase">{form.currency}</span>
                        <span className="text-2xl font-bold text-primary font-display">
                          {calculateGrossTotal().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Banking & Taxes */}
                <div className="border-t border-border/60 pt-4 space-y-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                    <FileText className="h-4 w-4 text-primary" /> Banking & Tax Registration
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-bank">Bank Name</Label>
                      <Input id="emp-bank" placeholder="JPMorgan Chase" value={form.bankName} onChange={(e) => setField("bankName", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-iban">Account Number / IBAN</Label>
                      <Input id="emp-iban" placeholder="US12 3456 7890 1234" value={form.accountNumber} onChange={(e) => setField("accountNumber", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-taxId">Tax ID / SSN</Label>
                      <Input id="emp-taxId" placeholder="12-3456789" value={form.taxId} onChange={(e) => setField("taxId", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Payment Method</Label>
                      <Select value={form.paymentMethod} onValueChange={(v) => setField("paymentMethod", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((pm) => (
                            <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

          {/* STEP 5: REVIEW & CONFIRM */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-500">
              {/* Requirements Gate Warning if incomplete */}
              {(!form.name?.trim() || !form.email?.trim() || !form.role?.trim() || !form.nationalId?.trim() || !hasIdScan || !hasContract) && (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-500/10 flex gap-3 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="text-xs space-y-1">
                    <h5 className="font-semibold text-sm">Missing Required Documents/Fields</h5>
                    <p className="leading-relaxed">This record will be saved in <strong>Pending Documents</strong> status instead of Active because the following mandatory items are missing:</p>
                    <ul className="list-disc pl-4 space-y-0.5 mt-1 font-semibold">
                      {!form.name?.trim() && <li>Full Name</li>}
                      {!form.email?.trim() && <li>Email Address</li>}
                      {!form.role?.trim() && <li>Job Title / Role</li>}
                      {!form.nationalId?.trim() && <li>National ID Number</li>}
                      {!hasIdScan && <li>National ID / Passport Scan file</li>}
                      {!hasContract && <li>Signed Employment Contract file</li>}
                    </ul>
                    <p className="mt-1.5">You can still onboard them. Once these files/fields are updated via their profile page, the status will advance to Active.</p>
                  </div>
                </div>
              )}

              {/* SYSTEM ACCESS SECTION */}
              {dbEmployeeId && (
                <Card className="shadow-premium border-primary/20 overflow-hidden bg-primary/5">
                  <CardHeader className="pb-4 border-b border-primary/10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                          <Shield className="h-4 w-4" /> System Login Access
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {form.userId 
                            ? "Configure or update login credentials for this employee."
                            : "Grant system dashboard login credentials to this employee."}
                        </CardDescription>
                      </div>
                      <Badge variant={form.userId ? "default" : "secondary"} className="text-[10px] font-bold tracking-tight uppercase bg-primary/20 text-primary border-primary/30">
                        {form.userId ? "Access Granted" : "No Access"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 text-sm">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Login Username / Email</Label>
                        <Input disabled value={form.email || ""} className="bg-muted/50 border-muted-foreground/10 text-muted-foreground" />
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
                        {form.userId ? "Set New Password" : "Create Password"}
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                          <Input 
                            type="text" 
                            placeholder={form.userId ? "Enter new password to reset" : "Enter minimum 6 characters"} 
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
                          if (!dbEmployeeId) return;
                          setIsProvisioningAccess(true);
                          try {
                            const res = await provisionEmployeeAccess(dbEmployeeId, {
                              password: systemAccessPassword,
                              role: systemAccessRole,
                            });
                            setForm(prev => ({ ...prev, userId: res.userId }));
                            setSystemAccessPassword("");
                            toast({
                              title: "System Access Ready",
                              description: `Successfully configured login credentials for ${form.name}.`,
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
                        {isProvisioningAccess ? "Processing..." : form.userId ? "Update Login Account" : "Grant Login Account"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 1 Review */}
              <Card className="shadow-card border-border relative">
                <Button 
                  onClick={() => setCurrentStep(1)} 
                  variant="link" 
                  className="absolute right-4 top-4 text-xs text-primary font-bold uppercase tracking-wider"
                >
                  Edit
                </Button>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">1. Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm pt-0">
                  <div className="flex items-center gap-3 col-span-2 pb-2 border-b border-border/40">
                    <div className="w-12 h-12 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                      {form.photoUrl ? (
                        <img src={form.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{form.name || "N/A"}</h4>
                      <p className="text-xs text-muted-foreground">Profile Picture</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Email Address</span>
                    <span className="font-medium text-foreground">{form.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Phone Number</span>
                    <span className="font-medium text-foreground">{form.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Date of Birth / Gender</span>
                    <span className="font-medium text-foreground">{form.dateOfBirth || "N/A"} · {form.gender || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">{form.nationalIdType || "National ID"} / Nationality</span>
                    <span className="font-medium text-foreground">{form.nationalId || "N/A"} · {form.nationality || "N/A"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Home Address</span>
                    <span className="font-medium text-foreground">{form.homeAddress || "N/A"}</span>
                  </div>
                  <div className="col-span-2 p-3 rounded-lg bg-muted/30 space-y-2">
                    <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider mb-1">Emergency Contacts</span>
                    {emergencyContacts.map((c, i) => (
                      <div key={i} className="text-xs border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0">
                        <span className="font-semibold text-foreground">{c.name || "Unnamed"}</span>
                        {c.relation && <span className="text-muted-foreground"> ({c.relation})</span>}
                        {c.phoneLocal && <span className="text-foreground font-semibold"> · {c.phoneCode} {c.phoneLocal}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Step 2 Review */}
              <Card className="shadow-card border-border relative">
                <Button 
                  onClick={() => setCurrentStep(2)} 
                  variant="link" 
                  className="absolute right-4 top-4 text-xs text-primary font-bold uppercase tracking-wider"
                >
                  Edit
                </Button>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">2. Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm pt-0">
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Role & Department</span>
                    <span className="font-bold text-foreground">{form.role || "N/A"} · {form.department || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Employment Type</span>
                    <span className="font-medium text-foreground">{form.employmentType}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Start Date & Location</span>
                    <span className="font-medium text-foreground">{form.startDate || "N/A"} · {form.workLocation}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Reports To (Manager)</span>
                    <span className="font-medium text-foreground">
                      {team.find(m => m.id === form.managerId)?.name || "Directly to Board / Self"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Professional Bio / Notes</span>
                    <p className="text-xs italic text-muted-foreground whitespace-pre-wrap">{form.bio || "No professional bio added."}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 Review */}
              <Card className="shadow-card border-border relative">
                <Button 
                  onClick={() => setCurrentStep(3)} 
                  variant="link" 
                  className="absolute right-4 top-4 text-xs text-primary font-bold uppercase tracking-wider"
                >
                  Edit
                </Button>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">3. Documents & Files</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm pt-0">
                  {uploadedFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No documents uploaded.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="p-3 rounded-xl border border-border flex items-center justify-between bg-muted/10">
                          <div className="flex items-center gap-2 min-w-0">
                            <File className="h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold block truncate text-foreground/90">{file.label}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">{file.category}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 4 Review */}
              <Card className="shadow-card border-border relative">
                <Button 
                  onClick={() => setCurrentStep(4)} 
                  variant="link" 
                  className="absolute right-4 top-4 text-xs text-primary font-bold uppercase tracking-wider"
                >
                  Edit
                </Button>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">4. Payroll & Banking</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm pt-0">
                  {form.isHourlyMode ? (
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold uppercase">Compensation Structure</span>
                      <span className="font-bold text-foreground">Hourly Rate: {form.hourlyRate} {form.currency}/hr</span>
                    </div>
                  ) : (
                    <div className="col-span-2 space-y-2.5">
                      <span className="text-xs text-muted-foreground block font-semibold uppercase">Compensation Structure</span>
                      <div className="grid grid-cols-2 gap-2 text-xs border border-border rounded-xl p-3 bg-muted/20">
                        <div className="text-muted-foreground">Basic Salary:</div>
                        <div className="font-bold text-foreground text-right">{form.currency} {parseFloat(String(form.basicSalary || "0")).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                        {form.housingAllowance && (
                          <>
                            <div className="text-muted-foreground">Housing Allowance:</div>
                            <div className="font-semibold text-foreground text-right">{form.currency} {parseFloat(String(form.housingAllowance)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                          </>
                        )}
                        {form.transportAllowance && (
                          <>
                            <div className="text-muted-foreground">Transport Allowance:</div>
                            <div className="font-semibold text-foreground text-right">{form.currency} {parseFloat(String(form.transportAllowance)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                          </>
                        )}
                        {allowanceList.map((allow, idx) => (
                          <React.Fragment key={idx}>
                            <div className="text-muted-foreground">{allow.label || "Allowance"}:</div>
                            <div className="font-semibold text-foreground text-right">{form.currency} {parseFloat(allow.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                          </React.Fragment>
                        ))}
                        <div className="text-sm font-bold text-primary border-t border-border pt-1 mt-1">Total Gross Salary:</div>
                        <div className="text-sm font-bold text-primary border-t border-border pt-1 mt-1 text-right">{form.currency} {calculateGrossTotal().toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Bank Details</span>
                    <span className="font-semibold text-foreground">{form.bankName || "N/A"}</span>
                    <span className="text-xs text-muted-foreground block">A/C: {form.accountNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-semibold uppercase">Tax ID / payment Method</span>
                    <span className="font-semibold text-foreground">Tax ID: {form.taxId || "N/A"}</span>
                    <span className="text-xs text-muted-foreground block">Paid via {form.paymentMethod}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stepper Buttons */}
          <div className="flex justify-between pt-4">
            {currentStep > 1 ? (
              <Button onClick={handlePrev} variant="outline" className="gap-2 rounded-xl">
                <ArrowLeft className="h-4 w-4" /> Previous Step
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <Button onClick={handleNext} className="gap-2 rounded-xl" variant="hero">
                Next Step <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinalSubmit} className="gap-2 rounded-xl shadow-premium" variant="hero">
                <CheckCircle className="h-4 w-4" /> {isEditMode ? "Save Changes" : "Complete Onboarding"}
              </Button>
            )}
          </div>
        </div>

        {/* Sticky Actions Sidebar Panel */}
        <div className="space-y-5 lg:col-span-1">
          <Card className="shadow-card border-border sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Onboarding Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current Step Status</Label>
                <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    currentStep === 5 
                      ? (!form.name?.trim() || !form.email?.trim() || !form.role?.trim() || !form.nationalId?.trim() || !hasIdScan || !hasContract)
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                      : "bg-blue-400"
                  }`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                    {currentStep === 5
                      ? (!form.name?.trim() || !form.email?.trim() || !form.role?.trim() || !form.nationalId?.trim() || !hasIdScan || !hasContract)
                        ? "Pending Documents"
                        : "Ready: Active"
                      : `Step ${currentStep} of 5`}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-4 bg-muted/10 p-2 rounded-xl">
                {isEditMode ? (
                  <Button onClick={handleFinalSubmit} className="w-full gap-2 text-xs font-semibold" variant="hero">
                    <Save className="h-4 w-4" /> Save Employee
                  </Button>
                ) : (
                  <Button onClick={handleSaveDraft} className="w-full gap-2 text-xs font-semibold" variant="hero">
                    <Save className="h-4 w-4" /> Save Draft
                  </Button>
                )}
                <Button variant="outline" className="w-full text-xs font-semibold" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Document Inline Preview Dialog */}
      <FilePreviewModal
        isOpen={!!previewFileUrl}
        onClose={() => setPreviewFileUrl(null)}
        fileUrl={previewFileUrl}
        fileLabel={previewFileLabel}
      />
    </div>
  );
}

// Upload Slot Helper Component
interface UploadSlotProps {
  category: string;
  label: string;
  isUploading: boolean;
  file?: EmployeeFile;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onPreview: (url: string, label: string) => void;
}

function UploadSlot({ category, label, isUploading, file, onUpload, onDelete, onPreview }: UploadSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isUploading) {
    return (
      <div className="h-28 rounded-xl border border-dashed border-primary/30 flex flex-col items-center justify-center bg-primary/5 text-center animate-pulse">
        <Upload className="h-5 w-5 animate-bounce text-primary" />
        <span className="text-[10px] font-bold text-primary uppercase mt-1">Uploading file...</span>
      </div>
    );
  }

  if (file) {
    const filename = file.fileUrl.split('/').pop() || file.fileUrl;
    return (
      <div className="h-28 rounded-xl border border-border bg-muted/10 p-3.5 flex flex-col justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <File className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <span className="text-xs font-bold block truncate text-foreground">{file.label || filename}</span>
            <span className="text-[9px] text-muted-foreground block font-medium">Uploaded: {file.uploadedAt ? file.uploadedAt.split('T')[0] : 'Today'}</span>
          </div>
        </div>
         <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-1.5">
           <Button variant="ghost" size="sm" onClick={() => onPreview(file.fileUrl, file.label || 'Document')} className="h-7 gap-1 text-[10px] font-bold uppercase hover:bg-muted p-2 rounded-lg">
            <Eye className="w-3 h-3" /> View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(file.id)} className="h-7 gap-1 text-[10px] font-bold uppercase text-destructive hover:bg-destructive/10 p-2 rounded-lg">
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => fileInputRef.current?.click()}
      className="h-28 rounded-xl border border-dashed border-border/80 hover:border-primary/50 flex flex-col items-center justify-center bg-muted/20 hover:bg-primary/5 transition-all duration-200 text-center cursor-pointer group"
    >
      <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="text-[11px] font-bold text-foreground/80 mt-1.5">Click or drag files here</span>
      <span className="text-[9px] text-muted-foreground mt-0.5">PDF, DOCX, PNG, JPG up to 15MB</span>
      <input type="file" ref={fileInputRef} className="hidden" onChange={onUpload} />
    </div>
  );
}

// Upload Slot Mini Helper Component (For list views)
interface UploadSlotMiniProps {
  isUploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}

function UploadSlotMini({ isUploading, onUpload, placeholder }: UploadSlotMiniProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isUploading) {
    return (
      <div className="h-full rounded-xl border border-dashed border-primary/30 flex items-center justify-center bg-primary/5 text-center animate-pulse p-3">
        <Upload className="h-3.5 w-3.5 animate-bounce text-primary mr-1.5" />
        <span className="text-[9px] font-bold text-primary uppercase">Uploading...</span>
      </div>
    );
  }

  return (
    <div 
      onClick={() => fileInputRef.current?.click()}
      className="h-full rounded-xl border border-dashed border-border/80 hover:border-primary/50 flex items-center justify-center bg-muted/20 hover:bg-primary/5 transition-all duration-200 cursor-pointer group p-3"
    >
      <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors mr-1.5" />
      <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">{placeholder}</span>
      <input type="file" ref={fileInputRef} className="hidden" onChange={onUpload} />
    </div>
  );
}
