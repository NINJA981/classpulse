
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function TakeQuiz() {
  const { id } = useParams();

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // LOAD QUIZ
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedQuizzes = JSON.parse(
        localStorage.getItem("teacherGuideQuizzes") || "[]"
      );

      const foundQuiz = savedQuizzes.find(
        (item) => String(item.id) === String(id)
      );

      setQuiz(foundQuiz || null);
    } catch (error) {
      console.error("Error loading quiz:", error);
      setQuiz(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // --------------------------------------------------
  // SELECT ANSWER
  // --------------------------------------------------

  const handleAnswer = (questionIndex, answer) => {
    if (submitted) return;

    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionIndex]: answer,
    }));
  };

  // --------------------------------------------------
  // CHECK ANSWER
  // Supports:
  // answer: "A"
  // OR
  // answer: "Correct option text"
  // --------------------------------------------------

  const checkAnswer = (question, selectedAnswer) => {
    if (!question || selectedAnswer === undefined) {
      return false;
    }

    const options = Array.isArray(question.options)
      ? question.options
      : [];

    const correctAnswer =
      question.answer !== undefined && question.answer !== null
        ? String(question.answer).trim()
        : "";

    const selected = String(selectedAnswer).trim();

    if (!correctAnswer || !selected) {
      return false;
    }

    // If answer is stored as A, B, C or D
    if (/^[A-D]$/i.test(correctAnswer)) {
      return selected.toUpperCase() === correctAnswer.toUpperCase();
    }

    // If answer is stored as the actual option text
    const selectedIndex = options.findIndex((option, index) => {
      const letter = String.fromCharCode(65 + index);

      return (
        selected === letter ||
        selected === String(option).trim()
      );
    });

    if (selectedIndex === -1) {
      return false;
    }

    return (
      String(options[selectedIndex]).trim().toLowerCase() ===
      correctAnswer.toLowerCase()
    );
  };

  // --------------------------------------------------
  // SUBMIT QUIZ
  // --------------------------------------------------

  const submitQuiz = () => {
    if (!quiz) return;

    const questions = Array.isArray(quiz.questions)
      ? quiz.questions
      : [];

    if (questions.length === 0) {
      alert("This quiz has no questions.");
      return;
    }

    // Check unanswered questions
    const unanswered = questions.some(
      (_, index) => answers[index] === undefined
    );

    if (unanswered) {
      alert(
        "Please answer all questions before submitting the quiz."
      );
      return;
    }

    // Calculate score
    let calculatedScore = 0;

    questions.forEach((question, index) => {
      if (checkAnswer(question, answers[index])) {
        calculatedScore += 1;
      }
    });

    const totalQuestions = questions.length;

    const percentage = Math.round(
      (calculatedScore / totalQuestions) * 100
    );

    // Update screen
    setScore(calculatedScore);
    setSubmitted(true);

    // --------------------------------------------------
    // SAVE QUIZ ATTEMPT
    // --------------------------------------------------

    const attempt = {
      id: Date.now().toString(),
      quizId: quiz.id,
      quizTitle: quiz.title || "Untitled Quiz",
      subject: quiz.subject || "",
      grade: quiz.grade || "",
      score: calculatedScore,
      total: totalQuestions,
      percentage,
      submittedAt: new Date().toISOString(),
    };

    try {
      const existingAttempts = JSON.parse(
        localStorage.getItem("teacherGuideQuizAttempts") || "[]"
      );

      const safeAttempts = Array.isArray(existingAttempts)
        ? existingAttempts
        : [];

      const updatedAttempts = [
        ...safeAttempts,
        attempt,
      ];

      localStorage.setItem(
        "teacherGuideQuizAttempts",
        JSON.stringify(updatedAttempts)
      );

      // Save latest result for this quiz
      localStorage.setItem(
        `teacherGuideQuizResult_${quiz.id}`,
        JSON.stringify(attempt)
      );

      console.log("Quiz attempt saved:", attempt);
    } catch (error) {
      console.error("Error saving quiz attempt:", error);
    }
  };

  // --------------------------------------------------
  // RETAKE QUIZ
  // --------------------------------------------------

  const retakeQuiz = () => {
    setAnswers({});
    setScore(0);
    setSubmitted(false);
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="app">

        <header className="navbar">

          <div className="logo">
            TEACHER GUIDE
          </div>

          <nav>
            <Link to="/">Dashboard</Link>

            <Link to="/saved-plans">
              Lesson Plans
            </Link>

            <Link to="/classes">
              My Classes
            </Link>

            <Link to="/resources">
              Resources
            </Link>

            <Link to="/quizzes">
              Quizzes
            </Link>

            <Link to="/analytics">
              Analytics
            </Link>
          </nav>

          <div className="teacher">
            Teacher
          </div>

        </header>

        <main className="dashboard">

          <section className="empty-state">

            <div className="empty-number">
              ...
            </div>

            <h2>
              Loading quiz...
            </h2>

            <p>
              Please wait while the quiz is loading.
            </p>

          </section>

        </main>

      </div>
    );
  }

  // --------------------------------------------------
  // QUIZ NOT FOUND
  // --------------------------------------------------

  if (!quiz) {
    return (
      <div className="app">

        <header className="navbar">

          <div className="logo">
            TEACHER GUIDE
          </div>

          <nav>
            <Link to="/">Dashboard</Link>

            <Link to="/saved-plans">
              Lesson Plans
            </Link>

            <Link to="/classes">
              My Classes
            </Link>

            <Link to="/resources">
              Resources
            </Link>

            <Link to="/quizzes">
              Quizzes
            </Link>

            <Link to="/analytics">
              Analytics
            </Link>
          </nav>

          <div className="teacher">
            Teacher
          </div>

        </header>

        <main className="dashboard">

          <section className="empty-state">

            <div className="empty-number">
              404
            </div>

            <h2>
              Quiz not found.
            </h2>

            <p>
              This quiz may have been deleted or does not exist anymore.
            </p>

            <Link
              to="/quizzes"
              className="primary-button"
            >
              ← Back to Quizzes
            </Link>

          </section>

        </main>

      </div>
    );
  }

  // --------------------------------------------------
  // QUESTIONS
  // --------------------------------------------------

  const questions = Array.isArray(quiz.questions)
    ? quiz.questions
    : [];

  const percentage =
    questions.length > 0
      ? Math.round((score / questions.length) * 100)
      : 0;

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="app">

      {/* NAVBAR */}

      <header className="navbar">

        <div className="logo">
          TEACHER GUIDE
        </div>

        <nav>

          <Link to="/">
            Dashboard
          </Link>

          <Link to="/saved-plans">
            Lesson Plans
          </Link>

          <Link to="/classes">
            My Classes
          </Link>

          <Link to="/resources">
            Resources
          </Link>

          <Link to="/quizzes">
            Quizzes
          </Link>

          <Link to="/analytics">
            Analytics
          </Link>

        </nav>

        <div className="teacher">
          Teacher
        </div>

      </header>


      {/* MAIN */}

      <main className="dashboard">

        {/* QUIZ HEADER */}

        <section className="hero">

          <p className="eyebrow">
            TAKE QUIZ
          </p>

          <h1>
            {quiz.title || "Untitled Quiz"}
          </h1>

          <p className="hero-text">
            {quiz.subject || "General"} •{" "}
            {quiz.grade || "All Grades"} •{" "}
            {quiz.duration || "30 minutes"}
          </p>

          {!submitted && (
            <Link
              to="/quizzes"
              className="secondary-button"
            >
              ← Back to Quizzes
            </Link>
          )}

        </section>


        {/* RESULT */}

        {submitted && (

          <section className="quiz-result">

            <p className="eyebrow">
              QUIZ RESULT
            </p>

            <h2>
              Quiz Submitted Successfully!
            </h2>

            <div className="result-score">
              {score} / {questions.length}
            </div>

            <p>
              You scored{" "}
              <strong>
                {percentage}%
              </strong>
            </p>

            <div className="quiz-actions">

              <button
                type="button"
                className="primary-button"
                onClick={retakeQuiz}
              >
                Retake Quiz
              </button>

              <Link
                to="/quizzes"
                className="secondary-button"
              >
                Back to Quizzes
              </Link>

              <Link
                to="/analytics"
                className="secondary-button"
              >
                View Analytics
              </Link>

            </div>

          </section>

        )}


        {/* QUESTIONS */}

        {!submitted && (

          <section className="quiz-form-section">

            <div className="form-heading">

              <span className="number">
                {String(questions.length).padStart(2, "0")}
              </span>

              <h2>
                Questions
              </h2>

            </div>


            {questions.length === 0 ? (

              <section className="empty-state">

                <h2>
                  No questions available.
                </h2>

                <p>
                  This quiz does not contain any questions.
                </p>

                <Link
                  to="/quizzes"
                  className="primary-button"
                >
                  ← Back to Quizzes
                </Link>

              </section>

            ) : (

              questions.map((question, questionIndex) => {

                const options = Array.isArray(question.options)
                  ? question.options
                  : [];

                return (
                  <article
                    className="question-box"
                    key={questionIndex}
                  >

                    <div className="question-header">

                      <strong>
                        QUESTION {questionIndex + 1}
                      </strong>

                    </div>


                    <h2>
                      {question.question || "Question"}
                    </h2>


                    {options.length === 0 ? (

                      <p>
                        No answer options available for this question.
                      </p>

                    ) : (

                      <div className="take-quiz-options">

                        {options.map((option, optionIndex) => {

                          const letter =
                            String.fromCharCode(
                              65 + optionIndex
                            );

                          const selected =
                            answers[questionIndex] === letter;

                          return (
                            <label
                              key={optionIndex}
                              className={`take-quiz-option ${
                                selected
                                  ? "selected"
                                  : ""
                              }`}
                            >

                              <input
                                type="radio"
                                name={`question-${questionIndex}`}
                                value={letter}
                                checked={selected}
                                onChange={() =>
                                  handleAnswer(
                                    questionIndex,
                                    letter
                                  )
                                }
                              />

                              <span className="option-letter">
                                {letter}
                              </span>

                              <span className="option-text">
                                {option}
                              </span>

                            </label>
                          );

                        })}

                      </div>

                    )}

                  </article>
                );

              })

            )}


            {/* SUBMIT BUTTON */}

            {questions.length > 0 && (

              <section className="quiz-actions">

                <button
                  type="button"
                  className="primary-button"
                  onClick={submitQuiz}
                >
                  Submit Quiz
                </button>

                <Link
                  to="/quizzes"
                  className="secondary-button"
                >
                  Cancel
                </Link>

              </section>

            )}

          </section>

        )}

      </main>

    </div>
  );
}

export default TakeQuiz;

