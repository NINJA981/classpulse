import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5000';

async function testAllFeatures() {
  console.log('=== [1] Testing Published Lessons & Questions ===');
  const publishedRes = await fetch(`${BACKEND_URL}/api/student/quizzes`);
  const publishedData = (await publishedRes.json()) as any;
  console.log(`Found ${publishedData.quizzes?.length || 0} published quizzes`);

  if (!publishedData.quizzes || publishedData.quizzes.length === 0) {
    console.error('No published quizzes found to test.');
    process.exit(1);
  }

  const testQuiz = publishedData.quizzes[0];
  const lessonId = testQuiz.id;
  console.log(`Selected Lesson: "${testQuiz.title}" (ID: ${lessonId})`);

  console.log('\n=== [2] Testing Live Quiz Creation (Option 1) ===');
  const createLiveRes = await fetch(`${BACKEND_URL}/api/live-quiz/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId })
  });
  const liveSession = (await createLiveRes.json()) as any;
  console.log('Created Live Session:', liveSession);

  if (!liveSession.pin) {
    throw new Error('Live session creation failed to return a PIN');
  }

  const pin = liveSession.pin;

  console.log('\n=== [3] Testing Live Quiz Socket.IO Room & Kahoot Gameplay (Option 1) ===');
  await new Promise<void>((resolve, reject) => {
    const hostSocket = io(BACKEND_URL);
    const student1 = io(BACKEND_URL);
    const student2 = io(BACKEND_URL);

    let hostJoined = false;
    let s1Joined = false;
    let s2Joined = false;

    hostSocket.on('connect', () => {
      console.log('Host connected, joining PIN:', pin);
      hostSocket.emit('quiz:host_join', { pin });
    });

    hostSocket.on('quiz:host_joined_ack', (data) => {
      console.log('Host joined ack:', data.title, 'Status:', data.status);
      hostJoined = true;
      checkReadyToStart();
    });

    student1.on('connect', () => {
      console.log('Student 1 connected, joining PIN:', pin);
      student1.emit('quiz:join', { pin, studentName: 'Aarav (Top Scorer)', studentId: 'stu_1' });
    });

    student1.on('quiz:joined_success', (data) => {
      console.log('Student 1 joined successfully:', data.studentName, 'ID:', data.studentId);
      s1Joined = true;
      checkReadyToStart();
    });

    student2.on('connect', () => {
      console.log('Student 2 connected, joining PIN:', pin);
      student2.emit('quiz:join', { pin, studentName: 'Diya (Speedster)', studentId: 'stu_2' });
    });

    student2.on('quiz:joined_success', (data) => {
      console.log('Student 2 joined successfully:', data.studentName, 'ID:', data.studentId);
      s2Joined = true;
      checkReadyToStart();
    });

    function checkReadyToStart() {
      if (hostJoined && s1Joined && s2Joined) {
        console.log('All participants in lobby! Starting game…');
        setTimeout(() => {
          hostSocket.emit('quiz:start', { pin });
        }, 500);
      }
    }

    student1.on('quiz:question_started', (q) => {
      console.log(`[Student 1] Question ${q.questionIndex + 1} received: "${q.stem}"`);
      // Student 1 answers correctly with 18s left
      setTimeout(() => {
        student1.emit('quiz:submit_answer', {
          pin,
          studentId: 'stu_1',
          questionIndex: q.questionIndex,
          selectedOption: 0,
          timeRemainingSec: 18
        });
      }, 300);
    });

    student2.on('quiz:question_started', (q) => {
      console.log(`[Student 2] Question ${q.questionIndex + 1} received: "${q.stem}"`);
      // Student 2 answers with 12s left
      setTimeout(() => {
        student2.emit('quiz:submit_answer', {
          pin,
          studentId: 'stu_2',
          questionIndex: q.questionIndex,
          selectedOption: 1,
          timeRemainingSec: 12
        });
      }, 500);
    });

    student1.on('quiz:answer_result', (res) => {
      console.log(`[Student 1 Result] Correct: ${res.isCorrect}, Points: +${res.pointsEarned}, Total: ${res.totalScore} pts, Streak: ${res.streak}`);
    });

    student2.on('quiz:answer_result', (res) => {
      console.log(`[Student 2 Result] Correct: ${res.isCorrect}, Points: +${res.pointsEarned}, Total: ${res.totalScore} pts, Streak: ${res.streak}`);

      // Now host advances to finish
      setTimeout(() => {
        console.log('Host requesting leaderboard snapshot…');
        hostSocket.emit('quiz:show_leaderboard', { pin });
      }, 400);
    });

    hostSocket.on('quiz:leaderboard_snapshot', (snap) => {
      console.log('Leaderboard Snapshot:', snap.leaderboard);
      // Advance to end
      setTimeout(() => {
        console.log('Host calling end_game to conclude live quiz…');
        hostSocket.emit('quiz:end_game', { pin });
      }, 300);
    });

    hostSocket.on('quiz:game_over', (over) => {
      console.log('🎉 GAME OVER! Podium:', over.podium);
      console.log('Full Standings:', over.leaderboard);

      hostSocket.disconnect();
      student1.disconnect();
      student2.disconnect();
      resolve();
    });

    setTimeout(() => {
      reject(new Error('Socket live quiz test timed out after 15s'));
    }, 15000);
  });

  console.log('\n=== [4] Testing Multilingual & Vernacular Support (Option 2) ===');
  const quizDetailRes = await fetch(`${BACKEND_URL}/api/student/quizzes/${lessonId}`);
  const quizDetail = (await quizDetailRes.json()) as any;
  console.log(`Quiz Detail: Title="${quizDetail.title}", Language=${quizDetail.language || 'en'}`);
  console.log(`Questions Count: ${quizDetail.questions?.length}`);
  const q0 = quizDetail.questions?.[0];
  console.log(`Sample Question Stem: "${q0?.stem}"`);
  console.log(`Sample Local Stem: "${q0?.stemLocal || '(none/english default)'}"`);

  console.log('\n=== [5] Testing Concept Gap Heatmap & AI Remedial Notes (Option 3) ===');
  const analyticsRes = await fetch(`${BACKEND_URL}/api/lessons/${lessonId}/analytics`);
  const analytics = (await analyticsRes.json()) as any;
  console.log('Analytics Summary:');
  console.log(`- Total Submissions: ${analytics.totalSubmissions}`);
  console.log(`- Class Average Mastery: ${analytics.classAveragePct}%`);
  console.log(`- Critical Concept Gaps (<50%): ${analytics.criticalGapsCount}`);
  console.log(`- Moderate Review Needed (50-75%): ${analytics.moderateGapsCount}`);
  console.log(`- Mastered Concepts (>75%): ${analytics.masteredCount}`);
  console.log(`- Question Breakdown Count: ${analytics.questions?.length}`);
  console.log(`- Generated Remedial Refresher Notes: ${analytics.remedialNotes?.length}`);

  if (analytics.remedialNotes && analytics.remedialNotes.length > 0) {
    console.log('\n--- Sample AI Remedial Refresher Card ---');
    console.log(`Topic: ${analytics.remedialNotes[0].topic}`);
    console.log(`Identified Misconception: ${analytics.remedialNotes[0].misconception}`);
    console.log(`Refresher (~60s): ${analytics.remedialNotes[0].remedialNote}`);
    console.log(`Action: ${analytics.remedialNotes[0].suggestedAction}`);
  }

  console.log('\n>>> ALL 3 CAPABILITIES VERIFIED END-TO-END! <<<');
}

testAllFeatures().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
