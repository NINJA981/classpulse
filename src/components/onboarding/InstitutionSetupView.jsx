'use client';

import React, { useState, useEffect } from 'react';
import { onboardingApi } from '../../mock/onboardingApi';

export const InstitutionSetupView = ({ onProceedToRoster }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    timezone: 'Asia/Kolkata (IST, UTC+05:30)',
    academicYear: '2026-2027'
  });

  const [domains, setDomains] = useState([]);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [createdInstitution, setCreatedInstitution] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch initial institution if exists
  useEffect(() => {
    let isMounted = true;
    onboardingApi.getCurrentInstitution().then((inst) => {
      if (isMounted && inst) {
        setCreatedInstitution(inst);
        setFormData({
          name: inst.name || '',
          code: inst.code || '',
          timezone: inst.timezone || 'Asia/Kolkata (IST, UTC+05:30)',
          academicYear: inst.academicYear || '2026-2027'
        });
        setDomains(inst.emailDomains || ['apex.edu']);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    
    setFormData((prev) => ({
      ...prev,
      name: val,
      // Auto-populate slug if user hasn't heavily customized it
      code: prev.code === '' || prev.code === prev.name.toLowerCase().trim().replace(/\s+/g, '-')
        ? generatedSlug
        : prev.code
    }));
  };

  const handleAddDomain = (e) => {
    if (e) e.preventDefault();
    const clean = domainInput.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;

    if (!clean.includes('.') || clean.length < 4) {
      setDomainError('Enter a valid domain, e.g. apex.edu');
      return;
    }

    if (domains.includes(clean)) {
      setDomainError('Domain already added.');
      return;
    }

    setDomains([...domains, clean]);
    setDomainInput('');
    setDomainError('');
  };

  const handleRemoveDomain = (toRemove) => {
    setDomains(domains.filter((d) => d !== toRemove));
  };

  const handleDomainKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.name.trim()) {
      setErrorMessage('Institution name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setErrorMessage('Institution code (slug) is required.');
      return;
    }
    if (domains.length === 0) {
      setErrorMessage('At least one institutional email domain is required (e.g. college.ac.in).');
      return;
    }

    setIsLoading(true);
    try {
      const result = await onboardingApi.createInstitution({
        name: formData.name,
        code: formData.code,
        emailDomains: domains,
        timezone: formData.timezone,
        academicYear: formData.academicYear
      });
      setCreatedInstitution(result);
      setIsEditing(false);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to initialize institution.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cp-stack">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="cp-eyebrow">Campus Profile</span>
          <h2 className="cp-h2">Institution Setup</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="cp-badge is-outline">Profile Configuration</span>
        </div>
      </div>

      {/* Confirmation Summary Card (shown when created and not actively re-editing) */}
      {createdInstitution && !isEditing ? (
        <div className="cp-card cp-card-static bg-surface border border-border-strong p-8 shadow-hard-lg">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border-soft pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="cp-badge is-ink">✓ INSTITUTION CONFIGURED</span>
                <span className="cp-caption text-muted">ID: {createdInstitution.id}</span>
              </div>
              <h3 className="cp-display text-4xl font-black tracking-tight">{createdInstitution.name}</h3>
              <p className="cp-lead text-secondary">
                Slug identifier: <strong className="text-primary">{createdInstitution.code}</strong> · Academic Year: <strong className="text-primary">{createdInstitution.academicYear}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="cp-btn-secondary"
              >
                Edit Parameters
              </button>
              {onProceedToRoster && (
                <button
                  type="button"
                  onClick={onProceedToRoster}
                  className="cp-btn-primary"
                >
                  Proceed to Roster Import →
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="p-4 border border-border-soft bg-surface-sunken">
              <span className="cp-eyebrow">Standard Timezone</span>
              <div className="text-sm font-bold mt-1 text-primary">{createdInstitution.timezone}</div>
              <span className="cp-caption text-muted">Synchronized for live Pi boundary logs</span>
            </div>

            <div className="p-4 border border-border-soft bg-surface-sunken">
              <span className="cp-eyebrow">Allowed Email Domains</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {createdInstitution.emailDomains?.map((dom) => (
                  <span key={dom} className="cp-badge is-ink">
                    @{dom}
                  </span>
                ))}
              </div>
              <span className="cp-caption text-muted mt-2 block">Strict domain enforcement during roster check</span>
            </div>

            <div className="p-4 border border-border-soft bg-surface-sunken">
              <span className="cp-eyebrow">Initialization Status</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="cp-dot is-live" />
                <span className="text-sm font-bold text-primary uppercase tracking-wider">Active & Ready</span>
              </div>
              <span className="cp-caption text-muted block mt-1">Ready to receive department and roster CSVs</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Form */}
      {(!createdInstitution || isEditing) && (
        <form onSubmit={handleSubmit} className="cp-panel border border-border bg-surface p-6 sm:p-8 space-y-8">
          <div className="border-b border-border pb-4">
            <span className="cp-eyebrow">Configuration Manifest</span>
            <h3 className="cp-h3 mt-1">Master Campus Parameters</h3>
            <p className="cp-lead text-secondary text-xs mt-1">
              Configure baseline identity metadata and strict organizational boundary filters.
            </p>
          </div>

          {errorMessage && (
            <div className="cp-alert border border-border-strong p-4 bg-surface-sunken">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <span aria-hidden="true">×</span> Validation Notice
              </div>
              <p className="text-xs text-secondary mt-1">{errorMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Institution Name */}
            <div className="space-y-2">
              <label htmlFor="inst-name" className="cp-label block">
                Official Institution / Campus Name <span className="text-primary">*</span>
              </label>
              <input
                id="inst-name"
                type="text"
                required
                value={formData.name}
                onChange={handleNameChange}
                placeholder="e.g. Apex Institute of Technology"
                className="cp-input w-full"
              />
              <span className="cp-caption text-muted block">
                Full chartered academic institution title.
              </span>
            </div>

            {/* Institution Slug / Code */}
            <div className="space-y-2">
              <label htmlFor="inst-code" className="cp-label block">
                Institution Code / URL Slug <span className="text-primary">*</span>
              </label>
              <input
                id="inst-code"
                type="text"
                required
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                  })
                }
                placeholder="e.g. apex-tech"
                className="cp-input w-full font-mono text-xs"
              />
              <span className="cp-caption text-muted block">
                Used in routing, API headers, and telemetry node pairing.
              </span>
            </div>
          </div>

          {/* Email Domains Chip Input */}
          <div className="space-y-3 border-t border-border-soft pt-6">
            <div className="flex items-center justify-between">
              <label htmlFor="domain-input" className="cp-label block">
                Authorized Email Domains (Chip Input) <span className="text-primary">*</span>
              </label>
              <span className="cp-caption text-muted">Press Enter or comma to append</span>
            </div>

            {/* Chips Container */}
            <div className="flex flex-wrap items-center gap-2 p-3 border border-border-input bg-surface min-h-[50px]">
              {domains.map((dom) => (
                <span
                  key={dom}
                  className="inline-flex items-center gap-2 border border-border-strong bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-primary"
                >
                  <span>@{dom}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(dom)}
                    className="hover:text-ink font-bold text-muted transition-colors"
                    aria-label={`Remove domain ${dom}`}
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                id="domain-input"
                type="text"
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  setDomainError('');
                }}
                onKeyDown={handleDomainKeyDown}
                placeholder={domains.length === 0 ? "Type e.g. apex.edu and press Enter" : "Add another domain..."}
                className="flex-1 min-w-[200px] border-none bg-transparent text-xs p-1 focus:outline-none"
              />

              {domainInput.trim() && (
                <button
                  type="button"
                  onClick={handleAddDomain}
                  className="cp-btn-ghost text-xs px-3 py-1"
                >
                  ＋ Add
                </button>
              )}
            </div>

            {domainError && <p className="text-xs text-primary font-bold">{domainError}</p>}

            <p className="cp-caption text-muted">
              Only faculty and student accounts bearing these domain suffixes can be imported during roster provisioning.
            </p>
          </div>

          {/* Timezone & Academic Year */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border-soft pt-6">
            <div className="space-y-2">
              <label htmlFor="inst-timezone" className="cp-label block">
                Primary Campus Timezone
              </label>
              <select
                id="inst-timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="cp-select w-full"
              >
                <option value="Asia/Kolkata (IST, UTC+05:30)">Asia/Kolkata (IST, UTC+05:30)</option>
                <option value="Asia/Singapore (SGT, UTC+08:00)">Asia/Singapore (SGT, UTC+08:00)</option>
                <option value="Asia/Dubai (GST, UTC+04:00)">Asia/Dubai (GST, UTC+04:00)</option>
                <option value="Europe/London (GMT/BST, UTC+01:00)">Europe/London (GMT/BST, UTC+01:00)</option>
                <option value="America/New_York (EST/EDT, UTC-05:00)">America/New_York (EST/EDT, UTC-05:00)</option>
                <option value="America/Los_Angeles (PST/PDT, UTC-08:00)">America/Los_Angeles (PST/PDT, UTC-08:00)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="inst-year" className="cp-label block">
                Active Academic Year Cycle
              </label>
              <select
                id="inst-year"
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="cp-select w-full"
              >
                <option value="2026-2027">2026-2027 (Current Term)</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2027-2028">2027-2028</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="cp-btn-secondary"
              >
                Cancel Edits
              </button>
            ) : (
              <div className="text-xs text-muted">
                Requires Administrator authorization.
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="cp-btn-primary"
            >
              {isLoading ? 'Writing Manifest...' : isEditing ? 'Save Revisions' : 'Initialize Institution Record'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
