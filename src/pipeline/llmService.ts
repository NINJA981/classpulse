import type { RefinedChunk, PipelineQuestion } from './types.js';
import { detectTopics, TOPIC_LIBRARY } from './library.js';

interface GenerateQuizParams {
  subject: string;
  chunks: RefinedChunk[];
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Deterministically balances the position of correct answers across questions.
 */
function rotateOptions(
  options: Array<{ text: string; isCorrect: boolean }>,
  seed: number
): Array<{ id: string; text: string; isCorrect: boolean }> {
  const shift = seed % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return rotated.map((o, idx) => ({
    id: `opt_${idx + 1}`,
    text: o.text,
    isCorrect: o.isCorrect
  }));
}

/**
 * Fallback algorithmic question generator when no external LLM is configured.
 */
function generateHeuristicQuiz(params: GenerateQuizParams): PipelineQuestion[] {
  const fullText = params.chunks.map((c) => c.refinedText).join(' ');
  const matched = detectTopics(fullText);
  const questions: PipelineQuestion[] = [];

  let qIndex = 1;

  // 1. First extract questions from matched domain topics
  for (const topic of matched) {
    for (const gq of topic.questions) {
      if (questions.length >= params.questionCount) break;

      const chunk = params.chunks[0] || {
        id: 'chunk_1',
        startTime: 0,
        endTime: 60
      };

      questions.push({
        id: `q_${qIndex}`,
        type: gq.type === 'true_false' ? 'true_false' : 'mcq',
        question: gq.question,
        options: rotateOptions(gq.options, qIndex),
        answerExplanation: gq.answerExplanation,
        difficulty: gq.difficulty || params.difficulty,
        source: {
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          chunkIds: [chunk.id]
        }
      });
      qIndex++;
    }
  }

  // 2. If more questions needed, generate grounded reading-comprehension questions
  while (questions.length < params.questionCount && params.chunks.length > 0) {
    const chunk = params.chunks[(questions.length) % params.chunks.length];
    const words = chunk.refinedText.split(/\s+/).filter((w) => w.length > 5);
    const keyTerm = words[0] || params.subject || 'The core principle';

    questions.push({
      id: `q_${qIndex}`,
      type: 'mcq',
      question: `Based on the lecture discussion: What is the significance of ${keyTerm.replace(/[^a-zA-Z0-9]/g, '')}?`,
      options: rotateOptions(
        [
          { text: `It serves as a core concept explained in ${chunk.refinedText.slice(0, 75)}...`, isCorrect: true },
          { text: 'It was dismissed as unrelated to the subject matter', isCorrect: false },
          { text: 'It represents an outdated hypothesis with no practical relevance', isCorrect: false },
          { text: 'It only applies in purely theoretical non-computational contexts', isCorrect: false }
        ],
        qIndex
      ),
      answerExplanation: `As stated in the lecture: "${chunk.refinedText.slice(0, 150)}..."`,
      difficulty: params.difficulty,
      source: {
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        chunkIds: [chunk.id]
      }
    });
    qIndex++;
  }

  return questions;
}

/**
 * Calls OpenAI-compatible chat completion API if configured.
 */
async function callChatCompletion(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const endpoint =
    process.env.LLM_ENDPOINT ||
    (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1/chat/completions' : null);
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '';

  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(45_000)
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Generates quiz questions using LLM with heuristic fallback.
 */
export async function generateQuiz(params: GenerateQuizParams): Promise<PipelineQuestion[]> {
  // Economical token management: sample up to 10 representative chunks across the lecture
  let selectedChunks = params.chunks;
  if (selectedChunks.length > 10) {
    const step = selectedChunks.length / 10;
    selectedChunks = Array.from({ length: 10 }, (_, i) => selectedChunks[Math.floor(i * step)]);
  }

  const contextSummary = selectedChunks
    .map((c, i) => `[Segment ${i + 1} (${c.startTime}s - ${c.endTime}s)]: ${c.refinedText.slice(0, 300)}`)
    .join('\n\n');

  const systemPrompt = `You are an expert educational assessment author for high-school and undergraduate students.
Generate ${params.questionCount} rigorous quiz questions grounded strictly in the provided lecture transcript.
Output ONLY a JSON array of question objects with the schema:
[
  {
    "type": "mcq" | "true_false",
    "question": "Clear stem",
    "options": [
      { "id": "opt_1", "text": "...", "isCorrect": true },
      { "id": "opt_2", "text": "...", "isCorrect": false }
    ],
    "answerExplanation": "Why the correct answer is right according to the lecture",
    "difficulty": "${params.difficulty}",
    "sourceStartTime": 0,
    "sourceEndTime": 30
  }
]`;

  const userPrompt = `Lecture Subject: ${params.subject}\n\nTranscript Chunks:\n${contextSummary}`;

  const responseText = await callChatCompletion(systemPrompt, userPrompt);
  if (responseText) {
    try {
      const cleaned = responseText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as Array<{
        type?: string;
        question: string;
        options: Array<{ id?: string; text: string; isCorrect: boolean }>;
        answerExplanation: string;
        difficulty?: string;
        sourceStartTime?: number;
        sourceEndTime?: number;
      }>;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          id: `q_${idx + 1}`,
          type: item.type === 'true_false' ? 'true_false' : 'mcq',
          question: item.question,
          options: item.options.map((o, optIdx) => ({
            id: o.id || `opt_${optIdx + 1}`,
            text: o.text,
            isCorrect: Boolean(o.isCorrect)
          })),
          answerExplanation: item.answerExplanation || '',
          difficulty: item.difficulty || params.difficulty,
          source: {
            startTime: Number(item.sourceStartTime ?? params.chunks[0]?.startTime ?? 0),
            endTime: Number(item.sourceEndTime ?? params.chunks[0]?.endTime ?? 30),
            chunkIds: [params.chunks[0]?.id || 'chunk_1']
          }
        }));
      }
    } catch {
      // Fall through to heuristic
    }
  }

  return generateHeuristicQuiz(params);
}

/**
 * Generates lecture reflection summary and key takeaways.
 */
export async function generateSummary(
  chunks: RefinedChunk[],
  subject: string
): Promise<{ summary: string; keyTakeaways: string[] }> {
  const fullText = chunks.map((c) => c.refinedText).join(' ');
  const detected = detectTopics(fullText);

  // If matched domain library, use authoritative summary
  if (detected.length > 0) {
    const primary = detected[0];
    return {
      summary: primary.summary,
      keyTakeaways: primary.keyTakeaways
    };
  }

  // Check LLM
  const systemPrompt = 'Generate a 1-paragraph summary and 3 bullet key takeaways for this lecture in JSON format: { "summary": "...", "keyTakeaways": ["...", "..."] }';
  const userPrompt = `Subject: ${subject}\n\nLecture Content:\n${fullText.slice(0, 4000)}`;

  const responseText = await callChatCompletion(systemPrompt, userPrompt);
  if (responseText) {
    try {
      const cleaned = responseText.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as { summary?: string; keyTakeaways?: string[] };
      if (parsed.summary && Array.isArray(parsed.keyTakeaways)) {
        return {
          summary: parsed.summary,
          keyTakeaways: parsed.keyTakeaways
        };
      }
    } catch {
      // Fall through
    }
  }

  // Fallback summary synthesis
  const preview = chunks.slice(0, 3).map((c) => c.refinedText).join(' ');
  return {
    summary: `This lecture explored foundational concepts in ${subject}. Key focus was placed on: ${preview.slice(0, 250)}...`,
    keyTakeaways: [
      `Key principles of ${subject} were introduced and demonstrated.`,
      'Students should review the foundational definitions and real-world examples discussed in the recording.',
      'Practical problem-solving applications were emphasized across the lecture sections.'
    ]
  };
}

