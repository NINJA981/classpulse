import { detectTopics } from './library.js';
import type { RefinedChunk, KnowledgeItem } from './types.js';

/**
 * Extracts key knowledge items (concepts, definitions, facts) from refined chunks.
 */
export function extractKnowledge(chunks: RefinedChunk[], subject?: string): KnowledgeItem[] {
  const fullText = chunks.map((c) => c.refinedText).join(' ');
  const detected = detectTopics(fullText);
  const items: KnowledgeItem[] = [];

  let itemId = 1;

  for (const t of detected) {
    // 1. Definition
    items.push({
      id: `know_${itemId++}`,
      name: t.knowledge.definitionTerm,
      description: t.knowledge.definition,
      type: 'definition',
      sourceChunkIds: chunks.map((c) => c.id).slice(0, 2)
    });

    // 2. Core Concept
    items.push({
      id: `know_${itemId++}`,
      name: t.topic,
      description: t.knowledge.description,
      type: 'concept',
      sourceChunkIds: chunks.map((c) => c.id)
    });

    // 3. Facts
    for (const fact of t.knowledge.facts) {
      items.push({
        id: `know_${itemId++}`,
        name: `${t.topic} Core Fact`,
        description: fact,
        type: 'fact',
        sourceChunkIds: chunks.map((c) => c.id)
      });
    }
  }

  // If no predefined topic matched, synthesize concepts from first few chunk sentences
  if (items.length === 0 && chunks.length > 0) {
    const firstChunk = chunks[0];
    items.push({
      id: `know_${itemId++}`,
      name: subject ? `${subject} Key Principle` : 'Lecture Core Concept',
      description: firstChunk.refinedText.slice(0, 200),
      type: 'concept',
      sourceChunkIds: [firstChunk.id]
    });
  }

  return items;
}
