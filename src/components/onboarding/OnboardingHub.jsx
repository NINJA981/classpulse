'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../../context/ClassPulseContext';
import { InstitutionSetupView } from './InstitutionSetupView';
import { RosterImportView } from './RosterImportView';
import { CourseSyllabusView } from './CourseSyllabusView';
import { SectionManagementView } from './SectionManagementView';

export const OnboardingHub = () => {
  const { onboardingStep, setOnboardingStep } = useClassPulse();
  const [localStep, setLocalStep] = useState('institution');

  const activeStep = onboardingStep || localStep;
  const setActiveStep = setOnboardingStep || setLocalStep;

  return (
    <div className="space-y-12">
      {/* Executive Header */}
      <section className="cp-page-header">
        <div>
          <span className="cp-eyebrow">
            Initialization Manifest <span className="text-muted-2">• Run Once Per Institution</span>
          </span>
          <h1 className="cp-display">Onboarding & Campus Setup</h1>
          <p className="cp-lead">
            Foundational provisioning for institutions. Configure master campus schemas, batch-import rosters, compile syllabus concept trees, and issue cohort join codes before commencing live smart-classroom telemetry.
          </p>
        </div>
        <div className="cp-page-actions">
          <span className="cp-badge is-ink">ADMINISTRATOR SCOPED</span>
        </div>
      </section>

      {/* Metric Indicators */}
      <section className="cp-grid-stats">
        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">▣</span>
            <span className="cp-badge is-ink">Profile</span>
          </div>
          <span className="cp-stat-label">Campus Identity</span>
          <span className="cp-stat-value is-sm">Active Profile</span>
        </div>

        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">▤</span>
            <span className="cp-badge">Ingestion</span>
          </div>
          <span className="cp-stat-label">Roster Intake</span>
          <span className="cp-stat-value is-sm">4 CSV Slots</span>
        </div>

        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">□</span>
            <span className="cp-badge">Curriculum</span>
          </div>
          <span className="cp-stat-label">Curriculum Nodes</span>
          <span className="cp-stat-value is-sm">Syllabus + CO/PO</span>
        </div>

        <div className="cp-stat">
          <div className="cp-stat-top">
            <span className="cp-icon-box" aria-hidden="true">↗</span>
            <span className="cp-badge">Security</span>
          </div>
          <span className="cp-stat-label">Cohort Security</span>
          <span className="cp-stat-value is-sm">Rolling Codes</span>
        </div>
      </section>

      {/* Content Area — Step selection handled via Sidebar */}
      <section className="cp-stack">
        {/* Sub-view Content */}
        <div className="pt-2">
          {activeStep === 'institution' && (
            <InstitutionSetupView onProceedToRoster={() => setActiveStep('roster')} />
          )}

          {activeStep === 'roster' && (
            <RosterImportView onProceedToCourses={() => setActiveStep('syllabus')} />
          )}

          {activeStep === 'syllabus' && (
            <CourseSyllabusView onProceedToSections={() => setActiveStep('sections')} />
          )}

          {activeStep === 'sections' && (
            <SectionManagementView />
          )}
        </div>
      </section>
    </div>
  );
};
