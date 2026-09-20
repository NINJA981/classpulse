import bcrypt from 'bcryptjs';
import { Institution } from '../models/Institution.js';
import { User } from '../models/User.js';
import { Section } from '../models/Section.js';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { Assignment } from '../models/Assignment.js';

export async function seedDatabase(): Promise<void> {
  const institutionCount = await Institution.countDocuments();
  if (institutionCount > 0) {
    console.log('[Seed] Database already seeded. Skipping initial seeding.');
    return;
  }

  console.log('[Seed] Seeding MongoDB with initial ClassPulse data...');

  // 1. Institution
  const institution = await Institution.create({
    name: 'Apex Institute of Technology',
    code: 'apex-tech',
    emailDomains: ['apex.edu', 'alumni.apex.edu'],
    timezone: 'Asia/Kolkata (IST, UTC+05:30)',
    academicYear: '2026-2027',
    status: 'active'
  });

  // 2. Users
  const salt = await bcrypt.genSalt(10);
  const adminPass = await bcrypt.hash('admin123', salt);
  const teacherPass = await bcrypt.hash('teacher123', salt);
  const studentPass = await bcrypt.hash('student123', salt);

  await User.create([
    {
      name: 'Campus Administrator',
      email: 'admin@apex.edu',
      passwordHash: adminPass,
      role: 'admin',
      institutionId: institution._id
    },
    {
      name: 'Dr. Anitha',
      email: 'anitha@apex.edu',
      passwordHash: teacherPass,
      role: 'teacher',
      institutionId: institution._id,
      department: 'Life Sciences'
    },
    {
      name: 'Prof. Rajesh Kumar',
      email: 'rajesh@apex.edu',
      passwordHash: teacherPass,
      role: 'teacher',
      institutionId: institution._id,
      department: 'Physics'
    },
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@apex.edu',
      passwordHash: studentPass,
      role: 'student',
      rollNumber: '21CS001',
      institutionId: institution._id
    }
  ]);

  // 3. Sections
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const section1 = await Section.create({
    name: 'Grade 10 - Section B',
    courseName: 'Biology & Genetics',
    institutionId: institution._id,
    teacherNames: ['Dr. Anitha'],
    joinCode: 'CP-8921',
    joinCodeExpiresAt: futureDate,
    enrolledCount: 34,
    enrolledRollNumbers: ['21CS001', '21CS002', '21CS003']
  });

  const section2 = await Section.create({
    name: 'Grade 10 - Section A',
    courseName: 'Physics & Thermodynamics',
    institutionId: institution._id,
    teacherNames: ['Prof. Rajesh Kumar'],
    joinCode: 'CP-4412',
    joinCodeExpiresAt: futureDate,
    enrolledCount: 29,
    enrolledRollNumbers: ['21CS001']
  });

  // 4. Lessons
  const lesson1 = await Lesson.create({
    teacherId: 'tch_001',
    sectionId: section1._id,
    title: 'Photosynthesis & Cellular Respiration',
    subject: 'Biology',
    className: 'Grade 10 - Section B',
    sourceType: 'audio',
    sourceFile: {
      path: '/uploads/photosynthesis-recording.webm',
      mimeType: 'audio/webm',
      sizeBytes: 18450200,
      durationSec: 1420
    },
    status: 'ready_for_review',
    timings: {
      startedAt: new Date(Date.now() - 3600000),
      elapsedSec: 42
    }
  });

  const lesson2 = await Lesson.create({
    teacherId: 'tch_001',
    sectionId: section2._id,
    title: 'Mendelian Genetics & Punnett Squares',
    subject: 'Biology',
    className: 'Grade 10 - Section A',
    sourceType: 'document',
    sourceFile: {
      path: '/uploads/genetics-handout.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2400000
    },
    status: 'published',
    timings: {
      startedAt: new Date(Date.now() - 86400000),
      elapsedSec: 28
    }
  });

  // 5. Questions for Lesson 1
  await Question.create([
    {
      lessonId: lesson1._id,
      sectionId: section1._id,
      type: 'mcq',
      stem: 'What is the primary electron donor in the light-dependent reactions of oxygenic photosynthesis?',
      options: ['Water (H2O)', 'Carbon Dioxide (CO2)', 'Glucose (C6H12O6)', 'NADPH'],
      correctIndex: 0,
      explanation: 'Photolysis of water provides the electrons necessary to replenish Photosystem II reaction center P680.',
      topicTag: 'Light Reactions',
      difficulty: 'medium',
      status: 'approved',
      editedByTeacher: false
    },
    {
      lessonId: lesson1._id,
      sectionId: section1._id,
      type: 'mcq',
      stem: 'Which enzyme catalyzes the fixation of CO2 onto ribulose-1,5-bisphosphate in the Calvin Cycle?',
      options: ['RuBisCO', 'ATP Synthase', 'Phosphofructokinase', 'DNA Polymerase III'],
      correctIndex: 0,
      explanation: 'RuBisCO (Ribulose-1,5-bisphosphate carboxylase-oxygenase) catalyzes the initial step of carbon fixation.',
      topicTag: 'Calvin Cycle',
      difficulty: 'easy',
      status: 'approved',
      editedByTeacher: false
    },
    {
      lessonId: lesson1._id,
      sectionId: section1._id,
      type: 'truefalse',
      stem: 'The proton gradient generated during photolysis is utilized directly by ATP Synthase to generate ATP.',
      options: ['True', 'False'],
      correctIndex: 0,
      explanation: 'Chemiosmotic ATP synthesis in chloroplast thylakoids relies on the electrochemical proton gradient.',
      topicTag: 'Chemiosmosis',
      difficulty: 'medium',
      status: 'approved',
      editedByTeacher: false
    }
  ]);

  // 6. Assignment for Lesson 1
  await Assignment.create({
    lessonId: lesson1._id,
    sectionId: section1._id,
    title: 'Cellular Energetics Comparative Analysis',
    subject: 'Biology',
    prompt: 'Compare ATP yields between substrate-level phosphorylation and oxidative phosphorylation. Outline key enzymatic checkpoints in a structured 1-page report.',
    estimatedMinutes: 30,
    status: 'published',
    rubric: [
      { criterion: 'Biochemical Accuracy', marks: 15, descriptor: 'Complete stoichiometry of glucose breakdown' },
      { criterion: 'Enzyme Pathway Diagram', marks: 10, descriptor: 'Clarity of mitochondrial membrane transport' }
    ]
  });

  console.log('[Seed] Database successfully seeded with ClassPulse initial dataset!');
}

