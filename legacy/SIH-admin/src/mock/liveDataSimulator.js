// Mock data and real-time event simulation for ClassPulse Admin Dashboard

export const INITIAL_PI_NODES = [
  {
    id: 'pi-01',
    name: 'ClassPulse-Node-01',
    classroom: 'Grade 10-A (Science Lab)',
    ip: '192.168.1.104',
    port: 443,
    mic: 'USB Boundary Mic (16kHz Mono)',
    status: 'streaming',
    isMuted: false,
    privacyAudioPurged: true,
    vadActive: true,
    audioLevel: 72,
    latencyMs: 19800, // ~20s behind live
    temp: '41°C',
    cpu: '18%',
    activeTopic: 'Photosynthesis - Light & Dark Reactions'
  },
  {
    id: 'pi-02',
    name: 'ClassPulse-Node-02',
    classroom: 'Grade 9-B (Physics Lab)',
    ip: '192.168.1.108',
    port: 443,
    mic: 'USB Boundary Mic (16kHz Mono)',
    status: 'idle',
    isMuted: false,
    privacyAudioPurged: true,
    vadActive: false,
    audioLevel: 12,
    latencyMs: 0,
    temp: '38°C',
    cpu: '5%',
    activeTopic: 'Newton\'s Laws of Motion'
  },
  {
    id: 'pi-03',
    name: 'ClassPulse-Node-03',
    classroom: 'Grade 11-C (Chemistry Lab)',
    ip: '192.168.1.112',
    port: 443,
    mic: 'USB Boundary Mic (16kHz Mono)',
    status: 'streaming',
    isMuted: true,
    privacyAudioPurged: true,
    vadActive: false,
    audioLevel: 0,
    latencyMs: 20200,
    temp: '44°C',
    cpu: '22%',
    activeTopic: 'Organic Chemistry - Hydrocarbons'
  }
];

export const INITIAL_TRANSCRIPTS = [
  {
    id: 't-101',
    timestamp: '14:02:10',
    speaker: 'Teacher (Dr. Anitha)',
    tamilText: 'மாணவர்களே, இன்றைக்கு நாம் Photosynthesis பத்தி படிக்க போறோம். Solar energy எப்படி chemical energy-ஆ மாறுதுன்னு பார்ப்போம்.',
    englishText: 'Students, today we are going to study about Photosynthesis. We will see how solar energy transforms into chemical energy.',
    topicTag: 'Photosynthesis',
    confidence: 0.98,
    sileroVadDroppedNoise: true,
    rawAudioPurged: true
  },
  {
    id: 't-102',
    timestamp: '14:04:45',
    speaker: 'Teacher (Dr. Anitha)',
    tamilText: 'Chloroplast-ல இருக்ற Thylakoid membrane-ல தான் Light reaction நடக்குது. இதில் ATP மற்றும் NADPH உருவாக்கப்படுகிறது.',
    englishText: 'Light reaction occurs in the Thylakoid membrane inside the Chloroplast. ATP and NADPH are produced here.',
    topicTag: 'Light Reaction',
    confidence: 0.95,
    sileroVadDroppedNoise: true,
    rawAudioPurged: true
  },
  {
    id: 't-103',
    timestamp: '14:08:20',
    speaker: 'Teacher (Dr. Anitha)',
    tamilText: 'Calvin cycle-க்கு light நேரடியாக தேவை இல்லை, அதனால் இது Dark reaction எனப்படுகிறது. Carbon dioxide fix பண்ணப்படுது.',
    englishText: 'Calvin cycle does not directly require light, which is why it is called the Dark reaction. Carbon dioxide is fixed here.',
    topicTag: 'Calvin Cycle',
    confidence: 0.97,
    sileroVadDroppedNoise: true,
    rawAudioPurged: true
  }
];

export const SAMPLE_GENERATED_QUIZ = {
  id: 'qz-889',
  title: 'Quick Check: Photosynthesis & Light Reactions',
  topic: 'Photosynthesis - Chloroplast & Calvin Cycle',
  suggestedPrompt: 'Just covered photosynthesis and light reactions — launch a 4-question quiz?',
  timeLimitSeconds: 45,
  questions: [
    {
      id: 1,
      question: 'Where do the light-dependent reactions of photosynthesis take place inside the plant cell?',
      options: [
        'Stroma of Chloroplast',
        'Thylakoid Membrane',
        'Outer Mitochondrial Membrane',
        'Cytoplasm'
      ],
      correctAnswer: 1,
      explanation: 'Light-dependent reactions occur within the thylakoid membranes where chlorophyll absorbs light energy.'
    },
    {
      id: 2,
      question: 'What are the main energy-rich products generated during the light reaction phase?',
      options: [
        'Glucose and Pyruvate',
        'ATP and NADPH',
        'CO2 and Water',
        'Lactic acid and Oxygen'
      ],
      correctAnswer: 1,
      explanation: 'ATP and NADPH are high-energy molecules generated during light reactions to power the Calvin Cycle.'
    },
    {
      id: 3,
      question: 'Why is the Calvin Cycle also referred to as the "Dark Reaction"?',
      options: [
        'It only takes place during night time',
        'It produces dark pigment molecules',
        'It does not directly require photons of light to proceed',
        'It destroys chlorophyll molecules'
      ],
      correctAnswer: 2,
      explanation: 'It is termed light-independent (dark reaction) because it does not directly require light energy, though it uses ATP & NADPH.'
    },
    {
      id: 4,
      question: 'Which gas is released as a byproduct during the splitting of water molecules in light reactions?',
      options: [
        'Carbon Dioxide (CO2)',
        'Nitrogen (N2)',
        'Oxygen (O2)',
        'Methane (CH4)'
      ],
      correctAnswer: 2,
      explanation: 'Photolysis of water releases oxygen gas (O2) into the atmosphere.'
    }
  ]
};

export const INITIAL_ANALYTICS = {
  periodAccuracy: [
    { period: '00-08 min', topic: 'Overview', accuracy: 88, engagement: 94 },
    { period: '08-16 min', topic: 'Chloroplast Anatomy', accuracy: 82, engagement: 91 },
    { period: '16-24 min', topic: 'Light Reactions', accuracy: 74, engagement: 88 },
    { period: '24-32 min', topic: 'Calvin Cycle', accuracy: 69, engagement: 85 },
    { period: '32-40 min', topic: 'Quiz Assessment', accuracy: 84, engagement: 98 }
  ],
  topicMastery: [
    { topic: 'Chloroplast Structure', mastery: 92 },
    { topic: 'Thylakoid Light Absorption', mastery: 85 },
    { topic: 'ATP / NADPH Synthesis', mastery: 78 },
    { topic: 'Calvin Cycle CO2 Fixation', mastery: 64 },
    { topic: 'Photolysis of Water', mastery: 88 }
  ],
  studentRankings: [
    { rank: 1, name: 'Karthik_R', score: 380, avatar: '⚡' },
    { rank: 2, name: 'Priya_M', score: 370, avatar: '🌟' },
    { rank: 3, name: 'Arun_S', score: 350, avatar: '🚀' },
    { rank: 4, name: 'Deepa_K', score: 340, avatar: '🔥' },
    { rank: 5, name: 'Vijay_T', score: 320, avatar: '🎯' }
  ]
};
