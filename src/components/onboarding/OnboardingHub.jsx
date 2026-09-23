'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../../context/ClassPulseContext';
import { InstitutionSetupView } from './InstitutionSetupView';
import { ClassroomsDirectoryView } from './ClassroomsDirectoryView';
import { FacultyDirectoryView } from './FacultyDirectoryView';
import { StudentRosterView } from './StudentRosterView';
import { RosterImportView } from './RosterImportView';
import { CourseSyllabusView } from './CourseSyllabusView';
import { SectionManagementView } from './SectionManagementView';

export const OnboardingHub = () => {
  const { onboardingStep, setOnboardingStep } = useClassPulse();
  const [localStep, setLocalStep] = useState('institution');

  const activeStep = onboardingStep || localStep;
  const setActiveStep = setOnboardingStep || setLocalStep;

  return (
    <div className="w-full">
      {activeStep === 'institution' && (
        <InstitutionSetupView onProceedToRoster={() => setActiveStep('classrooms')} />
      )}

      {activeStep === 'classrooms' && (
        <ClassroomsDirectoryView />
      )}

      {activeStep === 'teachers' && (
        <FacultyDirectoryView />
      )}

      {activeStep === 'students' && (
        <StudentRosterView />
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
  );
};
