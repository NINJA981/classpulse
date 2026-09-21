export interface GroundTruthQuestion {
  type: 'mcq' | 'true_false';
  question: string;
  options: Array<{ text: string; isCorrect: boolean }>;
  answerExplanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TopicEntry {
  key: string;
  topic: string;
  domain: string;
  triggers: string[];
  asrVariants: Array<{ correct: string; wrong: string[]; p: number }>;
  clean: string[];
  raw: string[];
  refined: string;
  knowledge: {
    description: string;
    definitionTerm: string;
    definition: string;
    facts: string[];
    importantPoints: string[];
  };
  questions: GroundTruthQuestion[];
  summary: string;
  keyTakeaways: string[];
}

export const TOPIC_LIBRARY: TopicEntry[] = [
  {
    key: 'binary_search',
    topic: 'Binary Search',
    domain: 'Computer Science',
    triggers: ['binary search', 'sorted array', 'search space', 'logarithmic', 'divide and conquer'],
    asrVariants: [
      { correct: 'binary search', wrong: ['binary search', 'binary such', 'binary serch', 'binaries search'], p: 0.35 },
      { correct: 'sorted', wrong: ['sorted', 'salted', 'sordid'], p: 0.3 },
      { correct: 'logarithmic', wrong: ['logarithmic', 'logarith mc', 'log arithmic'], p: 0.3 }
    ],
    clean: [
      'Today we cover binary search, one of the most fundamental algorithms in computer science.',
      'Binary search works on a sorted array by repeatedly halving the search space.',
      'We compare the target with the middle element; if the target is smaller we search the left half, otherwise the right half.',
      'Each comparison eliminates half of the remaining elements, giving logarithmic time complexity O of log n.',
      'One strict precondition: the input collection must be sorted for binary search to function correctly.'
    ],
    raw: [
      'Today we cover, uh, binary serch, one of the most fundamental algorithms in computer science right?',
      'Binary search works on a salted array by repeatedly halving the search space basically.',
      'We compare the target with the middle element if the target is smaller we search the left half otherwise the right half you know.',
      'Each comparison eliminates half of the remaining elements giving logarithmic time complexity O of log n.',
      'One strict precondition the input collection must be sorted for binary search to function correctly.'
    ],
    refined: 'Today we cover binary search, one of the most fundamental algorithms in computer science. Binary search works on a sorted array by repeatedly halving the search space. We compare the target with the middle element; if the target is smaller we search the left half, otherwise the right half. Each comparison eliminates half of the remaining elements, giving logarithmic time complexity O(log n). One strict precondition: the input collection must be sorted for binary search to function correctly.',
    knowledge: {
      description: 'A logarithmic-time search algorithm that repeatedly halves the search interval in a sorted collection.',
      definitionTerm: 'Logarithmic Complexity O(log n)',
      definition: 'An execution time bound where each step reduces the remaining problem size by a constant fraction.',
      facts: [
        'Binary search requires the underlying data to be sorted.',
        'Binary search has a worst-case time complexity of O(log n).'
      ],
      importantPoints: [
        'Every comparison eliminates half the remaining elements.',
        'Without sorted data the halving logic is invalid.'
      ]
    },
    questions: [
      {
        type: 'mcq',
        question: 'What is a mandatory precondition for binary search to operate correctly?',
        options: [
          { text: 'The array must be sorted', isCorrect: true },
          { text: 'The array must contain only positive numbers', isCorrect: false },
          { text: 'The array must be stored in a linked list', isCorrect: false },
          { text: 'The array size must be an exact power of two', isCorrect: false }
        ],
        answerExplanation: 'Binary search requires sorted data so it can discard half the remaining search space after each comparison.',
        difficulty: 'easy'
      },
      {
        type: 'mcq',
        question: 'What is the worst-case time complexity of binary search on an array of n items?',
        options: [
          { text: 'O(log n)', isCorrect: true },
          { text: 'O(n)', isCorrect: false },
          { text: 'O(n log n)', isCorrect: false },
          { text: 'O(1)', isCorrect: false }
        ],
        answerExplanation: 'Each step divides the search space by 2, resulting in at most log2(n) comparisons.',
        difficulty: 'medium'
      },
      {
        type: 'true_false',
        question: 'True or False: Binary search operates in O(1) auxiliary space.',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false }
        ],
        answerExplanation: 'Iterative binary search only stores low, mid, and high pointer indices, requiring O(1) constant space.',
        difficulty: 'medium'
      }
    ],
    summary: 'The lecture introduced binary search: an efficient O(log n) algorithm for searching sorted arrays by repeatedly halving the search space.',
    keyTakeaways: [
      'Binary search achieves logarithmic O(log n) time complexity.',
      'Input data must strictly be sorted before applying binary search.'
    ]
  },
  {
    key: 'merge_sort',
    topic: 'Merge Sort',
    domain: 'Computer Science',
    triggers: ['merge sort', 'merging', 'divide and conquer', 'recursive sort'],
    asrVariants: [
      { correct: 'merge sort', wrong: ['merge sort', 'murge sort', 'marsh sort'], p: 0.3 },
      { correct: 'divide and conquer', wrong: ['divide and conquer', 'divided in conquer'], p: 0.3 }
    ],
    clean: [
      'Merge sort is the canonical divide-and-conquer sorting algorithm.',
      'It recursively splits the array into two halves until each subarray contains a single element.',
      'Then it merges the sorted halves back together in linear time using a temporary buffer.',
      'Merge sort guarantees O of n log n time complexity across worst, average, and best cases.',
      'Because it preserves the relative order of duplicate keys, merge sort is stable.'
    ],
    raw: [
      'Merge sort is the canonical divide and conquer sorting algorithm, right?',
      'It recussively splits the array into two halves until each subarray contains a single element basically.',
      'Then it merges the sorted halves back together in linear time using a temporary buffer.',
      'Merge sort guarantees O of n log n time complexity across worst average and best cases.',
      'Because it preserves the relative order of duplicate keys merge sort is stable you know.'
    ],
    refined: 'Merge sort is the canonical divide-and-conquer sorting algorithm. It recursively splits the array into two halves until each subarray contains a single element. Then it merges the sorted halves back together in linear time using a temporary buffer. Merge sort guarantees O(n log n) time complexity across worst, average, and best cases. Because it preserves the relative order of duplicate keys, merge sort is stable.',
    knowledge: {
      description: 'A divide-and-conquer sorting algorithm that guarantees O(n log n) stable sorting with O(n) auxiliary space.',
      definitionTerm: 'Divide and Conquer',
      definition: 'A technique that breaks a problem down into subproblems, solves each recursively, and combines the results.',
      facts: [
        'Merge sort has a time complexity of O(n log n) in all cases.',
        'Merge sort requires O(n) auxiliary memory for buffer merging.'
      ],
      importantPoints: [
        'Merge sort is a stable sorting algorithm.',
        'Predictable O(n log n) performance comes at the cost of linear auxiliary space.'
      ]
    },
    questions: [
      {
        type: 'mcq',
        question: 'Which design paradigm does Merge Sort implement?',
        options: [
          { text: 'Divide and Conquer', isCorrect: true },
          { text: 'Greedy Approach', isCorrect: false },
          { text: 'Dynamic Programming', isCorrect: false },
          { text: 'Randomized Branching', isCorrect: false }
        ],
        answerExplanation: 'Merge sort divides the array into subproblems, solves them recursively, and merges the outputs.',
        difficulty: 'easy'
      },
      {
        type: 'mcq',
        question: 'What is the auxiliary space complexity of standard array merge sort?',
        options: [
          { text: 'O(n)', isCorrect: true },
          { text: 'O(1)', isCorrect: false },
          { text: 'O(log n)', isCorrect: false },
          { text: 'O(n^2)', isCorrect: false }
        ],
        answerExplanation: 'Merging two subarrays requires allocating temporary memory proportional to the input size O(n).',
        difficulty: 'medium'
      }
    ],
    summary: 'The lecture covered merge sort as the classic divide-and-conquer sort with stable O(n log n) performance and O(n) auxiliary space.',
    keyTakeaways: [
      'Merge sort provides stable O(n log n) sorting.',
      'Merging requires O(n) additional buffer space.'
    ]
  },
  {
    key: 'hash_tables',
    topic: 'Hash Tables & Hashing',
    domain: 'Computer Science',
    triggers: ['hash table', 'hash function', 'collision', 'chaining', 'bucket'],
    asrVariants: [
      { correct: 'hash table', wrong: ['hash table', 'hush table'], p: 0.3 },
      { correct: 'collision', wrong: ['collision', 'collishion'], p: 0.3 }
    ],
    clean: [
      'A hash table stores key-value pairs and provides average constant O of 1 time lookup.',
      'The hash function maps each key to an integer index in the underlying bucket array.',
      'When two keys hash to the same bucket index, a collision occurs.',
      'Collisions are typically resolved by chaining with linked lists or open addressing with probing.',
      'A uniform hash function and appropriate load factor are essential to prevent degradation to linear time.'
    ],
    raw: [
      'A hush table stores key-value pairs and provides average constant O of 1 time lookup basically.',
      'The hash function maps each key to an integer index in the underlying bucket array.',
      'When two keys hash to the same bucket index a collishion occurs, right?',
      'Collisions are typically resolved by chaining with linked lists or open addressing with probing.',
      'A uniform hash function and appropriate load factor are essential you know.'
    ],
    refined: 'A hash table stores key-value pairs and provides average constant O(1) time lookup. The hash function maps each key to an integer index in the underlying bucket array. When two keys hash to the same bucket index, a collision occurs. Collisions are typically resolved by chaining with linked lists or open addressing with probing. A uniform hash function and appropriate load factor are essential to prevent degradation to linear time.',
    knowledge: {
      description: 'A key-value data structure providing average O(1) retrieval through a hash function.',
      definitionTerm: 'Collision',
      definition: 'The condition where two distinct keys evaluate to the same array index via the hash function.',
      facts: [
        'Hash tables provide average O(1) insert, delete, and lookup performance.',
        'Collisions can be resolved via chaining or open addressing.'
      ],
      importantPoints: [
        'A high load factor degrades performance toward O(n).',
        'Uniform hashing distributes keys evenly to minimize collisions.'
      ]
    },
    questions: [
      {
        type: 'mcq',
        question: 'What is the average time complexity for lookup operations in a well-balanced hash table?',
        options: [
          { text: 'O(1)', isCorrect: true },
          { text: 'O(log n)', isCorrect: false },
          { text: 'O(n)', isCorrect: false },
          { text: 'O(n log n)', isCorrect: false }
        ],
        answerExplanation: 'When collisions are low and load factor is kept small, direct array indexing yields O(1) time.',
        difficulty: 'easy'
      },
      {
        type: 'mcq',
        question: 'What term describes two different keys computing the same hash table index?',
        options: [
          { text: 'Collision', isCorrect: true },
          { text: 'Buffer overflow', isCorrect: false },
          { text: 'Deadlock', isCorrect: false },
          { text: 'Segmentation fault', isCorrect: false }
        ],
        answerExplanation: 'A collision occurs when distinct inputs map to identical hash slots.',
        difficulty: 'easy'
      }
    ],
    summary: 'The lecture introduced hash tables, hash functions, and collision resolution techniques like chaining and probing.',
    keyTakeaways: [
      'Hash tables achieve average O(1) lookup.',
      'Collisions must be resolved to maintain optimal throughput.'
    ]
  },
  {
    key: 'newtons_laws',
    topic: "Newton's Laws of Motion",
    domain: 'Physics',
    triggers: ['newton', 'force equals mass', 'inertia', 'acceleration', 'action and reaction'],
    asrVariants: [
      { correct: 'Newton', wrong: ['Newton', 'new tin'], p: 0.2 },
      { correct: 'inertia', wrong: ['inertia', 'inner shia'], p: 0.3 }
    ],
    clean: [
      "Newton's first law states that an object remains at rest or in uniform motion unless acted on by a net external force; this is inertia.",
      'The second law relates force, mass, and acceleration: F equals m times a.',
      'The third law states that for every action force there is an equal and opposite reaction force.',
      'Together these three laws form the cornerstone of classical Newtonian mechanics.'
    ],
    raw: [
      "Newton's first law states that an object remains at rest or in uniform motion unless acted on by a net external force this is inner shia.",
      'The second law relates force mass and acceleration F equals m times a basically.',
      'The third law states that for every action force there is an equal and opposite reaction force you know.',
      'Together these three laws form the cornerstone of classical mechanics.'
    ],
    refined: "Newton's first law states that an object remains at rest or in uniform motion unless acted on by a net external force; this is inertia. The second law relates force, mass, and acceleration: F = ma. The third law states that for every action force there is an equal and opposite reaction force. Together these three laws form the cornerstone of classical Newtonian mechanics.",
    knowledge: {
      description: 'The three fundamental laws governing classical kinematics and the relationship between forces and acceleration.',
      definitionTerm: 'Inertia',
      definition: 'The resistance of any physical object to any change in its velocity or state of rest.',
      facts: [
        'F = ma describes the mathematical relationship between net force, mass, and acceleration.',
        'Action and reaction forces act on different bodies.'
      ],
      importantPoints: [
        'An object requires a net external force to accelerate.',
        'Every force has a corresponding equal and opposite counterpart.'
      ]
    },
    questions: [
      {
        type: 'mcq',
        question: "According to Newton's second law, what happens to acceleration if mass doubles while force remains constant?",
        options: [
          { text: 'Acceleration is halved', isCorrect: true },
          { text: 'Acceleration doubles', isCorrect: false },
          { text: 'Acceleration quadruples', isCorrect: false },
          { text: 'Acceleration remains unchanged', isCorrect: false }
        ],
        answerExplanation: 'From a = F/m, acceleration is inversely proportional to mass.',
        difficulty: 'medium'
      },
      {
        type: 'true_false',
        question: "True or False: Action and reaction forces act on the exact same object and cancel each other out.",
        options: [
          { text: 'False', isCorrect: true },
          { text: 'True', isCorrect: false }
        ],
        answerExplanation: 'Action and reaction forces act on two distinct interacting bodies, not the same body.',
        difficulty: 'medium'
      }
    ],
    summary: "The lecture covered Newton's three laws of motion: the law of inertia, F = ma, and action-reaction pairs.",
    keyTakeaways: [
      'Inertia keeps bodies in constant velocity unless acted upon by force.',
      'Acceleration is directly proportional to net force and inversely proportional to mass.'
    ]
  },
  {
    key: 'photosynthesis',
    topic: 'Photosynthesis & Cellular Energy',
    domain: 'Biology',
    triggers: ['photosynthesis', 'chlorophyll', 'calvin cycle', 'chloroplast', 'atp', 'light reaction'],
    asrVariants: [
      { correct: 'chlorophyll', wrong: ['chloro fill', 'chlorophyll'], p: 0.3 },
      { correct: 'chloroplast', wrong: ['chloroplast', 'chloro plast'], p: 0.3 }
    ],
    clean: [
      'Photosynthesis converts solar light energy, carbon dioxide, and water into chemical glucose and oxygen.',
      'It takes place in plant chloroplasts, where chlorophyll pigments absorb red and blue wavelengths.',
      'The light-dependent reactions split water molecules to generate ATP and NADPH.',
      'The Calvin cycle uses this energy to fix carbon dioxide into glucose molecules.'
    ],
    raw: [
      'Photosynthesis converts solar light energy carbon dioxide and water into chemical glucose and oxygen.',
      'It takes place in plant chloroplasts where chloro fill pigments absorb red and blue wavelengths basically.',
      'The light dependent reactions split water molecules to generate ATP and NADPH, right?',
      'The calvin cycle uses this energy to fix carbon dioxide into glucose molecules you know.'
    ],
    refined: 'Photosynthesis converts solar light energy, carbon dioxide, and water into chemical glucose and oxygen. It takes place in plant chloroplasts, where chlorophyll pigments absorb red and blue wavelengths. The light-dependent reactions split water molecules to generate ATP and NADPH. The Calvin cycle uses this energy to fix carbon dioxide into glucose molecules.',
    knowledge: {
      description: 'The biological conversion of light energy, carbon dioxide, and water into carbohydrates and oxygen.',
      definitionTerm: 'Chlorophyll',
      definition: 'The primary photoreceptor pigment in plant chloroplasts responsible for light absorption.',
      facts: [
        'Oxygen is produced as a byproduct of splitting water molecules.',
        'The Calvin cycle takes place in the chloroplast stroma without requiring direct light.'
      ],
      importantPoints: [
        'Light reactions generate ATP and NADPH.',
        'The Calvin cycle fixes inorganic carbon into carbohydrates.'
      ]
    },
    questions: [
      {
        type: 'mcq',
        question: 'Where does the oxygen released during photosynthesis originate from?',
        options: [
          { text: 'Splitting of water molecules (H2O)', isCorrect: true },
          { text: 'Breakdown of carbon dioxide (CO2)', isCorrect: false },
          { text: 'Synthesis of glucose', isCorrect: false },
          { text: 'Atmospheric nitrogen exchange', isCorrect: false }
        ],
        answerExplanation: 'Photolysis splits water during light reactions, releasing oxygen gas as a byproduct.',
        difficulty: 'medium'
      }
    ],
    summary: 'The lecture explored the stages of photosynthesis: light reactions producing ATP/NADPH and the Calvin cycle synthesizing glucose.',
    keyTakeaways: [
      'Photosynthesis converts light, CO2, and water into glucose and oxygen.',
      'Light reactions power the dark reactions (Calvin cycle).'
    ]
  }
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const ASR_CORRECTIONS: Array<{ pattern: RegExp; replacement: string }> = (() => {
  const map = new Map<string, string>();
  for (const topic of TOPIC_LIBRARY) {
    for (const variant of topic.asrVariants) {
      for (const wrong of variant.wrong) {
        if (wrong.toLowerCase() === variant.correct.toLowerCase()) continue;
        map.set(wrong.toLowerCase(), variant.correct);
      }
    }
  }
  return Array.from(map.entries()).map(([wrong, correct]) => ({
    pattern: new RegExp(`\\b${escapeRe(wrong)}\\b`, 'gi'),
    replacement: correct
  }));
})();

export function detectTopics(text: string): TopicEntry[] {
  const lower = text.toLowerCase();
  return TOPIC_LIBRARY.filter((t) => t.triggers.some((trig) => lower.includes(trig)));
}
