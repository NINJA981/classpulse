"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  GraduationCap,
  Mail,
  School,
  Globe,
  UserPlus,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Trash2,
  Shield,
  Calendar,
  X,
  LogOut,
  KeyRound,
  BookOpen,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  diagnosticApi,
  Guardian,
  GuardianStatus,
  UserProfile,
  JoinEnrollmentResponse,
} from "@/lib/diagnosticApi";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "kn", label: "Kannada" },
  { code: "gu", label: "Gujarati" },
];

export default function ProfilePage() {
  const router = useRouter();

  // Student Profile State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [enrollment, setEnrollment] =
    useState<JoinEnrollmentResponse | null>(null);

  // Guardian State
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingGuardian, setAddingGuardian] = useState(false);

  // Guardian Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Revoke Dialog State
  const [guardianToRevoke, setGuardianToRevoke] = useState<Guardian | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Language update state
  const [langSuccess, setLangSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const u = await diagnosticApi.getMe();
        if (!active) return;
        setProfile(u);

        const enr = diagnosticApi.getCurrentEnrollment();
        if (!active) return;
        setEnrollment(enr);

        const list = await diagnosticApi.getGuardians();
        if (!active) return;
        setGuardians(list);
      } catch (err: unknown) {
        console.error("Failed to load profile data", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  async function handleLanguageChange(lang: string) {
    if (!profile) return;
    try {
      const updated = await diagnosticApi.updateMe({ language: lang });
      setProfile(updated);
      setLangSuccess(true);
      setTimeout(() => setLangSuccess(false), 3000);
    } catch (err) {
      console.error("Language update failed", err);
    }
  }

  async function handleAddGuardian(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Please enter your guardian's full name.");
      return;
    }
    if (!phone.trim()) {
      setFormError("Please enter a valid mobile number.");
      return;
    }

    setAddingGuardian(true);
    setFormError("");
    setFormSuccess("");

    try {
      const newG = await diagnosticApi.addGuardian({
        name: name.trim(),
        phone: phone.trim(),
      });
      setGuardians((prev) => [newG, ...prev]);
      setName("");
      setPhone("");
      setFormSuccess(
        `Link invitation sent to ${newG.name}. Status is pending until verified.`
      );
      setTimeout(() => setFormSuccess(""), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to link guardian.";
      setFormError(msg);
    } finally {
      setAddingGuardian(false);
    }
  }

  async function handleConfirmRevoke() {
    if (!guardianToRevoke) return;
    setRevoking(true);
    try {
      await diagnosticApi.deleteGuardian(guardianToRevoke.id);
      setGuardians((prev) =>
        prev.map((g) =>
          g.id === guardianToRevoke.id
            ? { ...g, status: "revoked" as GuardianStatus }
            : g
        )
      );
      setGuardianToRevoke(null);
    } catch {
      alert("Failed to revoke access. Try again.");
    } finally {
      setRevoking(false);
    }
  }

  async function handleLogout() {
    await diagnosticApi.logout();
    router.push("/login");
  }

  const activeCount = guardians.filter((g) => g.status === "active").length;
  const pendingCount = guardians.filter((g) => g.status === "pending").length;

  return (
    <DashboardShell footerNote="Student identity & guardian privacy">
      {/* Hero Header */}
      <header className="cp-hero cp-hero--sky cp-tape-top">
        <div className="cp-hero__row">
          <div className="cp-hero__body">
            <p className="cp-sticker">Academic Identity</p>
            <h1 className="cp-h-hero">Student Profile</h1>
            <p className="cp-hero__sub">
              Manage your student credentials, enrolled class section, and linked guardians who receive your weekly concept-mastery digests.
            </p>
          </div>

          <div className="cp-hero__pills">
            <span className="ui-pill ui-pill-yellow font-mono text-xs">
              <GraduationCap className="w-3.5 h-3.5" />
              {profile?.registerNumber || "2024-CS-042"}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="ui-button ui-button-secondary ui-button-sm text-xs text-red-700 hover:bg-pink-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 1. STUDENT INFORMATION SECTION                            */}
      {/* ========================================================= */}
      <section className="cp-card cp-hero--white p-6 sm:p-8 relative border-2 border-ink shadow-zine">
        <div className="cp-tape-corner" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-ink mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-300 border-2 border-ink shadow-sm flex items-center justify-center font-bold text-xl text-ink">
              {profile?.name?.charAt(0) || "S"}
            </div>
            <div>
              <p className="zine-label">Student Information</p>
              <h2 className="cp-h-card text-2xl font-extrabold text-ink">
                {profile?.name || "Student"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/join"
              className="ui-button ui-button-secondary ui-button-sm text-xs"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Join Another Section
            </Link>
          </div>
        </div>

        {/* Student Data Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border-2 border-ink rounded-xl shadow-sm">
            <p className="zine-caption flex items-center gap-1.5 mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-ink" /> Register Number
            </p>
            <p className="font-mono font-bold text-ink text-base">
              {profile?.registerNumber || "2024-CS-042"}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border-2 border-ink rounded-xl shadow-sm">
            <p className="zine-caption flex items-center gap-1.5 mb-1">
              <Mail className="w-3.5 h-3.5 text-ink" /> Institutional Email
            </p>
            <p className="font-sans font-bold text-ink text-sm truncate">
              {profile?.email || "aarav.sharma@institution.edu"}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border-2 border-ink rounded-xl shadow-sm">
            <p className="zine-caption flex items-center gap-1.5 mb-1">
              <School className="w-3.5 h-3.5 text-ink" /> Institution
            </p>
            <p className="font-sans font-bold text-ink text-sm truncate">
              {enrollment?.institutionName ||
                profile?.institutionName ||
                "National Institute of Technology"}
            </p>
          </div>

          <div className="p-4 bg-yellow-50 border-2 border-ink rounded-xl shadow-sm">
            <p className="zine-caption flex items-center gap-1.5 mb-1 text-ink">
              <BookOpen className="w-3.5 h-3.5 text-ink" /> Enrolled Class
            </p>
            <p className="font-sans font-bold text-ink text-sm truncate">
              {enrollment?.courseTitle || "Advanced Calculus & Linear Algebra"}
            </p>
            <p className="text-[11px] font-mono text-faint">
              {enrollment ? `Code: ${enrollment.enrollmentId.replace("enr-", "")}` : "Code: MATH10"}
            </p>
          </div>
        </div>

        {/* Language Preference Strip */}
        <div className="mt-6 pt-5 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-ink text-sm">
              Preferred Language:
            </span>
            {langSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                Language saved!
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageChange(lang.label)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-ink transition-all ${
                  profile?.language === lang.label
                    ? "bg-yellow-300 shadow-sm"
                    : "bg-white hover:bg-yellow-50"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. GUARDIAN ACCESS SECTION                                */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
        {/* Left Column: Add Guardian Form & Plain-Language Explainer */}
        <div className="lg:col-span-7 space-y-6">
          <div className="cp-card cp-card--yellow p-6 sm:p-8 relative">
            <div className="cp-tape-corner" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="cp-sticker">Guardian Link</span>
                <h3 className="cp-h-card-sm text-xl font-bold">
                  Add a Guardian
                </h3>
              </div>
              <UserPlus className="w-5 h-5 text-ink" />
            </div>

            <p className="cp-text text-sm mb-6">
              Enter your parent or guardian&apos;s contact details to send a link invitation.
            </p>

            {formSuccess && (
              <div className="p-4 mb-6 bg-emerald-100 border-2 border-ink rounded-lg flex items-center gap-3 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <p className="text-sm font-bold">{formSuccess}</p>
              </div>
            )}

            {formError && (
              <div className="p-4 mb-6 bg-pink-100 border-2 border-ink rounded-lg flex items-center gap-3 text-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-sm font-bold">{formError}</p>
              </div>
            )}

            <form onSubmit={handleAddGuardian} className="space-y-4">
              <div>
                <label htmlFor="g-name" className="ui-label ui-label--upper mb-1.5">
                  <User className="w-3.5 h-3.5" /> Guardian Full Name
                </label>
                <input
                  id="g-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Suman Sharma"
                  className="ui-input"
                  required
                />
              </div>

              <div>
                <label htmlFor="g-phone" className="ui-label ui-label--upper mb-1.5">
                  <Phone className="w-3.5 h-3.5" /> Mobile Phone Number
                </label>
                <input
                  id="g-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="ui-input font-mono font-bold"
                  required
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={addingGuardian || !name.trim() || !phone.trim()}
                  className="ui-button ui-button-primary ui-button-lg w-full justify-center"
                >
                  {addingGuardian ? (
                    <>
                      <RotateCw className="w-5 h-5 animate-spin" />
                      Sending Link Invitation...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Send Guardian Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Linked Guardians List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-ink">
            <div>
              <p className="zine-label">Guardian Directory</p>
              <h3 className="cp-h-card-sm text-xl font-extrabold mt-0.5">
                Linked Guardians
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="ui-pill ui-pill-mint text-xs">
                {activeCount} Active
              </span>
              {pendingCount > 0 && (
                <span className="ui-pill ui-pill-yellow text-xs">
                  {pendingCount} Pending
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white border-2 border-ink rounded-xl">
              <RotateCw className="w-6 h-6 animate-spin mx-auto text-faint mb-2" />
              <p className="cp-caption">Loading guardians...</p>
            </div>
          ) : guardians.length === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-ink rounded-xl">
              <Shield className="w-10 h-10 text-muted mx-auto mb-2 opacity-50" />
              <p className="font-bold text-ink">No guardians linked yet</p>
              <p className="cp-caption mt-1">
                Add a guardian to share weekly progress digests.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {guardians.map((guardian) => {
                const isActive = guardian.status === "active";
                const isPending = guardian.status === "pending";
                const isRevoked = guardian.status === "revoked";

                return (
                  <div
                    key={guardian.id}
                    className={`p-4 border-2 border-ink rounded-xl shadow-sm bg-white transition-all ${
                      isRevoked ? "opacity-60 bg-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-ink text-base truncate">
                            {guardian.name}
                          </h4>
                          {isActive && (
                            <span className="ui-pill ui-pill-mint text-xs">
                              Active
                            </span>
                          )}
                          {isPending && (
                            <span className="ui-pill ui-pill-yellow text-xs">
                              Pending
                            </span>
                          )}
                          {isRevoked && (
                            <span className="ui-pill ui-pill-muted text-xs">
                              Revoked
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-mono text-faint mt-1 flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          {guardian.phone}
                        </p>

                        <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          Linked {guardian.createdAt}
                        </p>
                      </div>

                      {/* Action */}
                      {!isRevoked ? (
                        <button
                          type="button"
                          onClick={() => setGuardianToRevoke(guardian)}
                          className="ui-button ui-button-secondary text-xs px-3 py-1.5 text-red-700 hover:bg-pink-100 hover:text-red-900 shrink-0"
                          title="Revoke access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-muted uppercase font-bold">
                          Access ended
                        </span>
                      )}
                    </div>

                    {isRevoked && (
                      <p className="text-xs font-medium text-red-700 mt-2 pt-2 border-t border-dashed border-slate-300">
                        Digests stopped. This guardian no longer receives updates.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Revoke Confirmation Dialog */}
      {guardianToRevoke && (
        <div className="ui-modal-overlay">
          <div className="ui-modal max-w-md">
            <div className="cp-modal__head">
              <div>
                <p className="cp-sticker cp-sticker--muted">Confirm Action</p>
                <h3 className="cp-h-card-sm text-xl mt-1 text-red-900">
                  Revoke Guardian Access?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuardianToRevoke(null)}
                className="ui-button ui-button-icon"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-sm font-bold text-ink">
                Are you sure you want to revoke access for{" "}
                <span className="underline">{guardianToRevoke.name}</span>?
              </p>

              <div className="p-3.5 bg-pink-100 border-2 border-ink rounded-lg text-xs text-red-900 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Digests stop immediately.
                </p>
                <p>
                  They will no longer receive weekly concept-mastery reports or syllabus updates.
                </p>
              </div>
            </div>

            <div className="cp-modal__foot">
              <button
                type="button"
                onClick={() => setGuardianToRevoke(null)}
                disabled={revoking}
                className="ui-button ui-button-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revoking}
                className="ui-button ui-button-danger"
              >
                {revoking ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  "Yes, Revoke Access"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
