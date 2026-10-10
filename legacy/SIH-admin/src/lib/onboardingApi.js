/**
 * The onboarding console, talking to SIH-backend for real.
 *
 * This replaces src/mock/onboardingApi.js. The exported function names and return shapes are
 * the ones the views already expect, so the translation from the API's shapes lives here
 * rather than in every component.
 */

import { request } from './apiClient';
import { parseCsv, readFileAsText } from './csv';

/** Slot ids in RosterImportView map onto the kinds the import endpoint accepts. */
const SLOT_KINDS = {
  teachers: 'teachers',
  students: 'students',
  courses: 'courses',
  sections: 'sections'
};

/**
 * A course in the API is title/code/outcomes. The syllabus views also show a status and a
 * concept count, which are derived from whether the course has any concepts yet.
 */
function toCourseView(course, conceptCount) {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    department: course.departmentId || '',
    outcomes: course.outcomes || [],
    credits: null,
    semester: '',
    status: conceptCount > 0 ? 'validated' : 'none',
    syllabusFileName: null,
    copoFileName: null,
    uploadedAt: course.updatedAt,
    conceptCount
  };
}

export const onboardingApi = {
  // --- institution -------------------------------------------------------------------------

  /** PUT /api/admin/institution — creates it the first time, updates it after that. */
  async createInstitution(payload) {
    const { name, code, emailDomains, timezone, academicYear } = payload;
    if (!name || !code) throw new Error('Institution name and code are required.');

    const { institution } = await request('/admin/institution', {
      method: 'PUT',
      body: JSON.stringify({
        name: name.trim(),
        code: code.trim().toLowerCase().replace(/\s+/g, '-'),
        emailDomains: Array.isArray(emailDomains)
          ? emailDomains.filter(Boolean)
          : [emailDomains].filter(Boolean),
        timezone: timezone || 'Asia/Kolkata',
        academicYear: academicYear || '2026-2027'
      })
    });
    return institution;
  },

  async getCurrentInstitution() {
    const { institution } = await request('/admin/institution');
    return institution;
  },

  // --- roster import -------------------------------------------------------------------------

  /**
   * Parses the chosen CSVs in the browser and posts the rows as one import. The server keeps
   * them staged and validated but writes nothing until confirmImport.
   */
  async uploadRoster(slots = {}) {
    const files = [];

    for (const [slotId, slot] of Object.entries(slots)) {
      const kind = SLOT_KINDS[slotId];
      // `departments` has no collection of its own yet, so it is not sent.
      if (!kind || !slot) continue;

      if (!slot.file) {
        throw new Error(
          `${slotId}.csv was not read. Choose the file again so its contents can be uploaded.`
        );
      }

      files.push({
        kind,
        fileName: slot.name || `${slotId}.csv`,
        rows: parseCsv(await readFileAsText(slot.file))
      });
    }

    if (files.length === 0) throw new Error('Choose at least one CSV to import.');

    const { job } = await request('/admin/imports', {
      method: 'POST',
      body: JSON.stringify({ files })
    });
    return { importJobId: job.id, job };
  },

  async getImportStatus(importJobId) {
    const { job } = await request(`/admin/imports/${importJobId}`);
    return {
      id: job.id,
      // The server validates synchronously, so a job is only ever done or failed.
      status: job.status,
      rowCount: job.rowCount,
      successCount: job.successCount,
      files: job.files,
      errors: job.errors
    };
  },

  /**
   * Kept so RosterImportView's progress animation still has something to await. Validation
   * already happened server-side during the upload, so there is no stage to advance.
   */
  async advanceJobProgress(importJobId) {
    return this.getImportStatus(importJobId);
  },

  /** PATCH one cell. The server re-validates the whole import, so errors can clear in pairs. */
  async fixImportRow(importJobId, kind, rowNumber, field, newValue) {
    const { job } = await request(`/admin/imports/${importJobId}/rows`, {
      method: 'PATCH',
      body: JSON.stringify({ kind, row: rowNumber, field, value: String(newValue ?? '') })
    });
    return {
      success: true,
      rowCount: job.rowCount,
      successCount: job.successCount,
      errors: job.errors
    };
  },

  async confirmImport(importJobId) {
    const { job } = await request(`/admin/imports/${importJobId}/confirm`, { method: 'POST' });
    return {
      success: true,
      importedCount: job.successCount,
      skippedCount: job.rowCount - job.successCount,
      job
    };
  },

  // --- courses and syllabus ---------------------------------------------------------------------

  async getCourses() {
    const { items } = await request('/admin/courses');
    // The concept count drives the status pill, so it is fetched alongside each course.
    const counts = await Promise.all(
      items.map(async (course) => {
        try {
          const { items: concepts } = await request(`/admin/courses/${course.id}/concepts`);
          return concepts.length;
        } catch {
          return 0;
        }
      })
    );
    return items.map((course, index) => toCourseView(course, counts[index]));
  },

  async createCourse({ title, code, outcomes = [] }) {
    const { course } = await request('/admin/courses', {
      method: 'POST',
      body: JSON.stringify({ title, code, outcomes })
    });
    return toCourseView(course, 0);
  },

  async deleteCourse(courseId) {
    await request(`/admin/courses/${courseId}`, { method: 'DELETE' });
    return { success: true, courseId };
  },

  /**
   * Imports a course's syllabus.
   *
   * The server stores concepts, not documents — there is no PDF parser behind this — so the
   * upload has to be a CSV with unit, order, title, coTags and bloomLevel columns.
   */
  async uploadSyllabus(courseId, { syllabusFile, syllabusFileName = 'syllabus.csv' } = {}) {
    if (!syllabusFile) {
      throw new Error('Choose a syllabus CSV (unit, order, title, coTags, bloomLevel).');
    }

    const rows = parseCsv(await readFileAsText(syllabusFile));
    const concepts = rows.map((row, index) => ({
      unit: row.unit || 'Unit 1',
      order: Number(row.order) || index + 1,
      title: row.title || '',
      coTags: row.coTags ? row.coTags.split('|').map((tag) => tag.trim()).filter(Boolean) : [],
      bloomLevel: row.bloomLevel || 'L2 Understand'
    }));

    const missing = concepts.findIndex((concept) => !concept.title);
    if (missing !== -1) {
      throw new Error(`Row ${missing + 2} of ${syllabusFileName} has no title.`);
    }

    const { items } = await request(`/admin/courses/${courseId}/concepts`, {
      method: 'POST',
      body: JSON.stringify({ concepts, replace: true })
    });
    return { courseId, status: 'parsed', conceptCount: items.length };
  },

  /**
   * There is no separate validation pass server-side: concepts are validated as they are
   * imported. This reports what the course actually holds now.
   */
  async validateCourseSyllabus(courseId) {
    const { items } = await request(`/admin/courses/${courseId}/concepts`);
    return {
      success: items.length > 0,
      courseId,
      status: items.length > 0 ? 'validated' : 'none',
      conceptCount: items.length
    };
  },

  async getCourseConcepts(courseId) {
    const { items } = await request(`/admin/courses/${courseId}/concepts`);
    return items;
  },

  async deleteConcept(conceptId) {
    await request(`/admin/concepts/${conceptId}`, { method: 'DELETE' });
    return { success: true, conceptId };
  },

  // --- sections ------------------------------------------------------------------------------------

  async getSections(courseId = null) {
    const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
    const { items } = await request(`/admin/sections${query}`);
    return items;
  },

  async createSection({ courseId, name, teacherIds = [] }) {
    const { section } = await request('/admin/sections', {
      method: 'POST',
      body: JSON.stringify({ courseId, name, teacherIds })
    });
    return section;
  },

  async updateSection(sectionId, patch) {
    const { section } = await request(`/admin/sections/${sectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    return section;
  },

  async rotateSectionCode(sectionId) {
    const { section } = await request(`/admin/sections/${sectionId}/rotate-code`, {
      method: 'POST'
    });
    return section;
  },

  async deleteSection(sectionId) {
    await request(`/admin/sections/${sectionId}`, { method: 'DELETE' });
    return { success: true, sectionId };
  },

  // --- directories and overview -----------------------------------------------------------------------

  async getTeachers() {
    const { items } = await request('/admin/teachers');
    return items;
  },

  async getStudents({ sectionId, page = 1 } = {}) {
    const params = new URLSearchParams();
    if (sectionId) params.set('sectionId', sectionId);
    params.set('page', String(page));
    return request(`/admin/students?${params.toString()}`);
  },

  async getOverview() {
    return request('/admin/overview');
  }
};
