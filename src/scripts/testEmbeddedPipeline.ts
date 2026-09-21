import fs from 'fs';
import path from 'path';
import {
  cleanRefineText,
  chunkTranscript,
  extractKnowledge,
  generateQuiz,
  generateSummary,
  ingestLectureFileInProcess
} from '../pipeline/index.js';
import { pipelineHealth } from '../services/pipelineClient.js';

async function runTest() {
  console.log('🧪 [Test 1] Testing Text Refinement & ASR Term Correction...');
  const noisyText = 'Okay so um today we cover, uh, binary serch on a salted array, right? It runs in O of log n basically.';
  const cleaned = cleanRefineText(noisyText);
  console.log('   Original:', noisyText);
  console.log('   Cleaned: ', cleaned);
  if (!cleaned.includes('binary search') || !cleaned.includes('sorted array')) {
    throw new Error('Text refiner failed to restore canonical terms!');
  }
  console.log('   ✅ Text Refinement verified.\n');

  console.log('🧪 [Test 2] Testing Transcript Chunking...');
  const sampleLecture =
    'Binary search works on a sorted array by repeatedly halving the search space. ' +
    'We compare the target element with the middle element of the array. ' +
    'If the target is smaller we continue searching in the left half. ' +
    'Otherwise we search the right half. ' +
    'Each comparison eliminates half of the remaining elements. ' +
    'The worst-case time complexity is logarithmic, O of log n.';
  const { segments, refinedChunks, durationSec } = chunkTranscript(sampleLecture, 60);
  console.log(`   Created ${segments.length} segments, ${refinedChunks.length} refined chunks over ${durationSec}s.`);
  if (segments.length === 0 || refinedChunks.length === 0) {
    throw new Error('Chunker failed to produce segments or chunks!');
  }
  console.log('   ✅ Chunker verified.\n');

  console.log('🧪 [Test 3] Testing Knowledge Extraction...');
  const knowledge = extractKnowledge(refinedChunks, 'Computer Science');
  console.log(`   Extracted ${knowledge.length} knowledge items:`);
  knowledge.forEach((k) => console.log(`   - [${k.type}] ${k.name}: ${k.description.slice(0, 60)}...`));
  if (knowledge.length === 0) {
    throw new Error('Knowledge extraction produced 0 items!');
  }
  console.log('   ✅ Knowledge extraction verified.\n');

  console.log('🧪 [Test 4] Testing Quiz Generation (MCQ & True/False)...');
  const questions = await generateQuiz({
    subject: 'Computer Science',
    chunks: refinedChunks,
    questionCount: 3,
    difficulty: 'medium'
  });
  console.log(`   Generated ${questions.length} questions:`);
  questions.forEach((q, i) => {
    console.log(`   Q${i + 1} (${q.type}): ${q.question}`);
    q.options.forEach((opt) => console.log(`      [${opt.isCorrect ? 'x' : ' '}] ${opt.text}`));
  });
  if (questions.length === 0) {
    throw new Error('Quiz generation failed!');
  }
  console.log('   ✅ Quiz generation verified.\n');

  console.log('🧪 [Test 5] Testing Summary & Key Takeaways...');
  const summaryResult = await generateSummary(refinedChunks, 'Computer Science');
  console.log('   Summary:', summaryResult.summary);
  console.log('   Takeaways:', summaryResult.keyTakeaways);
  console.log('   ✅ Summary processor verified.\n');

  console.log('🧪 [Test 6] Testing Full In-Process Audio Ingestion Workflow...');
  const testAudioPath = path.resolve(process.cwd(), 'uploads', 'test_lecture.webm');
  await fs.promises.mkdir(path.dirname(testAudioPath), { recursive: true });
  await fs.promises.writeFile(testAudioPath, Buffer.from('FAKE_AUDIO_SAMPLE_FOR_TESTING'));

  const ingestResult = await ingestLectureFileInProcess({
    filePath: testAudioPath,
    title: 'Binary Search Mastery',
    subject: 'Computer Science',
    teacherId: 'teacher_123',
    questionCount: 4,
    difficulty: 'medium'
  });

  console.log('   Ingest Result Session ID:', ingestResult.sessionId);
  console.log(`   Segments: ${ingestResult.transcript.segments.length}`);
  console.log(`   Questions Generated: ${ingestResult.quiz.questions.length}`);
  console.log(`   Summary Length: ${ingestResult.summary?.length ?? 0} chars`);
  if (ingestResult.quiz.questions.length === 0) {
    throw new Error('In-process audio ingestion failed to return questions!');
  }
  console.log('   ✅ Full In-Process Ingestion workflow verified.\n');

  console.log('🧪 [Test 7] Testing Pipeline Health Probe...');
  const health = await pipelineHealth();
  console.log('   Health Report:', health);
  if (!health.ok || health.mode !== 'embedded') {
    throw new Error('Health check failed for embedded pipeline!');
  }
  console.log('   ✅ Health check verified.\n');

  // Cleanup test audio
  await fs.promises.unlink(testAudioPath).catch(() => null);

  console.log('🎉 ALL 7 EMBEDDED PIPELINE TESTS PASSED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
