import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const createEmptyQuestion = () => ({
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "",
});

function Quiz() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    subject: "",
    grade: "",
    duration: "",
  });

  const [questions, setQuestions] = useState([
    createEmptyQuestion(),
  ]);

  const [error, setError] = useState("");

  // -----------------------------
  // BASIC INFORMATION
  // -----------------------------
  const handleFormChange = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
  };

  // -----------------------------
  // QUESTION INFORMATION
  // -----------------------------
  const handleQuestionChange = (index, field, value) => {
    setQuestions((previous) =>
      previous.map((question, questionIndex) =>
        questionIndex === index
          ? {
              ...question,
              [field]: value,
            }
          : question
      )
    );

    setError("");
  };

  // -----------------------------
  // ADD QUESTION
  // -----------------------------
  const addQuestion = () => {
    setQuestions((previous) => [
      ...previous,
      createEmptyQuestion(),
    ]);

    setError("");
  };

  // -----------------------------
  // REMOVE QUESTION
  // -----------------------------
  const removeQuestion = (index) => {
    setQuestions((previous) =>
      previous.filter((_, questionIndex) => questionIndex !== index)
    );

    setError("");
  };

  // -----------------------------
  // SAVE QUIZ
  // -----------------------------
  const saveQuiz = (event) => {
    event.preventDefault();

    const cleanTitle = form.title.trim();
    const cleanSubject = form.subject.trim();
    const cleanGrade = form.grade.trim();
    const cleanDuration = form.duration.trim();

    // Basic information
    if (cleanTitle === "") {
      setError("Please enter the quiz title.");
      return;
    }

    if (cleanSubject === "") {
      setError("Please select a subject.");
      return;
    }

    if (cleanGrade === "") {
      setError("Please select a grade.");
      return;
    }

    if (cleanDuration === "") {
      setError("Please select a duration.");
      return;
    }

    // Questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (q.question.trim() === "") {
        setError(`Please enter Question ${i + 1}.`);
        return;
      }

      if (q.optionA.trim() === "") {
        setError(`Please enter Option A for Question ${i + 1}.`);
        return;
      }

      if (q.optionB.trim() === "") {
        setError(`Please enter Option B for Question ${i + 1}.`);
        return;
      }

      if (q.optionC.trim() === "") {
        setError(`Please enter Option C for Question ${i + 1}.`);
        return;
      }

      if (q.optionD.trim() === "") {
        setError(`Please enter Option D for Question ${i + 1}.`);
        return;
      }

      if (q.correctAnswer.trim() === "") {
        setError(
          `Please select the correct answer for Question ${i + 1}.`
        );
        return;
      }
    }

    // Prepare quiz
    const newQuiz = {
      id: Date.now(),
      title: cleanTitle,
      subject: cleanSubject,
      grade: cleanGrade,
      duration: cleanDuration,

      questions: questions.map((q) => ({
        question: q.question.trim(),
        optionA: q.optionA.trim(),
        optionB: q.optionB.trim(),
        optionC: q.optionC.trim(),
        optionD: q.optionD.trim(),
        correctAnswer: q.correctAnswer,
      })),

      createdAt: new Date().toISOString(),
    };

    // Get existing quizzes safely
    let existingQuizzes = [];

    try {
      const storedQuizzes = localStorage.getItem(
        "teacherGuideQuizzes"
      );

      if (storedQuizzes) {
        const parsed = JSON.parse(storedQuizzes);

        if (Array.isArray(parsed)) {
          existingQuizzes = parsed;
        }
      }
    } catch (error) {
      existingQuizzes = [];
    }

    // Save
    const updatedQuizzes = [
      ...existingQuizzes,
      newQuiz,
    ];

    localStorage.setItem(
      "teacherGuideQuizzes",
      JSON.stringify(updatedQuizzes)
    );

    // Clear error
    setError("");

    // Go to quiz list
    navigate("/quizzes");
  };

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
        </nav>

        <div className="teacher">
          Teacher
        </div>

      </header>

      {/* MAIN */}
      <main className="dashboard">

        {/* HERO */}
        <section className="hero">

          <p className="eyebrow">
            QUIZ BUILDER
          </p>

          <h1>
            Create.
            <br />
            Assess.
          </h1>

          <p className="hero-text">
            Create engaging quizzes for your students and
            organize assessments in one place.
          </p>

        </section>

        {/* FORM */}
        <form onSubmit={saveQuiz}>

          {/* QUIZ INFORMATION */}
          <section className="quiz-section">

            <div className="section-number">
              01
            </div>

            <h2>
              Quiz Information
            </h2>

            <div className="quiz-form">

              {/* TITLE */}
              <div className="form-group">

                <label htmlFor="quiz-title">
                  Quiz Title
                </label>

                <input
                  id="quiz-title"
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    handleFormChange(
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="Enter quiz title"
                />

              </div>

              {/* SUBJECT */}
              <div className="form-group">

                <label htmlFor="quiz-subject">
                  Subject
                </label>

                <select
                  id="quiz-subject"
                  value={form.subject}
                  onChange={(event) =>
                    handleFormChange(
                      "subject",
                      event.target.value
                    )
                  }
                >

                  <option value="">
                    Select Subject
                  </option>

                  <option value="Mathematics">
                    Mathematics
                  </option>

                  <option value="Science">
                    Science
                  </option>

                  <option value="English">
                    English
                  </option>

                  <option value="Computer Science">
                    Computer Science
                  </option>

                  <option value="Social Science">
                    Social Science
                  </option>

                </select>

              </div>

              {/* GRADE */}
              <div className="form-group">

                <label htmlFor="quiz-grade">
                  Grade
                </label>

                <select
                  id="quiz-grade"
                  value={form.grade}
                  onChange={(event) =>
                    handleFormChange(
                      "grade",
                      event.target.value
                    )
                  }
                >

                  <option value="">
                    Select Grade
                  </option>

                  <option value="Grade 6">
                    Grade 6
                  </option>

                  <option value="Grade 7">
                    Grade 7
                  </option>

                  <option value="Grade 8">
                    Grade 8
                  </option>

                  <option value="Grade 9">
                    Grade 9
                  </option>

                  <option value="Grade 10">
                    Grade 10
                  </option>

                </select>

              </div>

              {/* DURATION */}
              <div className="form-group">

                <label htmlFor="quiz-duration">
                  Duration
                </label>

                <select
                  id="quiz-duration"
                  value={form.duration}
                  onChange={(event) =>
                    handleFormChange(
                      "duration",
                      event.target.value
                    )
                  }
                >

                  <option value="">
                    Select Duration
                  </option>

                  <option value="15 minutes">
                    15 minutes
                  </option>

                  <option value="30 minutes">
                    30 minutes
                  </option>

                  <option value="45 minutes">
                    45 minutes
                  </option>

                  <option value="60 minutes">
                    60 minutes
                  </option>

                </select>

              </div>

            </div>

          </section>

          {/* QUESTIONS */}
          <section className="quiz-section">

            <div className="section-number">
              02
            </div>

            <h2>
              Questions
            </h2>

            {questions.map((q, index) => (

              <div
                className="question-card"
                key={index}
              >

                <div className="question-header">

                  <h3>
                    Question {index + 1}
                  </h3>

                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="remove-question"
                      onClick={() =>
                        removeQuestion(index)
                      }
                    >
                      Remove
                    </button>
                  )}

                </div>

                {/* QUESTION */}
                <div className="form-group">

                  <label>
                    Question
                  </label>

                  <textarea
                    value={q.question}
                    onChange={(event) =>
                      handleQuestionChange(
                        index,
                        "question",
                        event.target.value
                      )
                    }
                    placeholder="Enter your question"
                    rows={3}
                  />

                </div>

                {/* OPTIONS */}
                <div className="options-grid">

                  <div className="form-group">

                    <label>
                      Option A
                    </label>

                    <input
                      type="text"
                      value={q.optionA}
                      onChange={(event) =>
                        handleQuestionChange(
                          index,
                          "optionA",
                          event.target.value
                        )
                      }
                      placeholder="Enter option A"
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Option B
                    </label>

                    <input
                      type="text"
                      value={q.optionB}
                      onChange={(event) =>
                        handleQuestionChange(
                          index,
                          "optionB",
                          event.target.value
                        )
                      }
                      placeholder="Enter option B"
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Option C
                    </label>

                    <input
                      type="text"
                      value={q.optionC}
                      onChange={(event) =>
                        handleQuestionChange(
                          index,
                          "optionC",
                          event.target.value
                        )
                      }
                      placeholder="Enter option C"
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Option D
                    </label>

                    <input
                      type="text"
                      value={q.optionD}
                      onChange={(event) =>
                        handleQuestionChange(
                          index,
                          "optionD",
                          event.target.value
                        )
                      }
                      placeholder="Enter option D"
                    />

                  </div>

                </div>

                {/* CORRECT ANSWER */}
                <div className="form-group">

                  <label>
                    Correct Answer
                  </label>

                  <select
                    value={q.correctAnswer}
                    onChange={(event) =>
                      handleQuestionChange(
                        index,
                        "correctAnswer",
                        event.target.value
                      )
                    }
                  >

                    <option value="">
                      Select Correct Answer
                    </option>

                    <option value="Option A">
                      Option A
                    </option>

                    <option value="Option B">
                      Option B
                    </option>

                    <option value="Option C">
                      Option C
                    </option>

                    <option value="Option D">
                      Option D
                    </option>

                  </select>

                </div>

              </div>

            ))}

            {/* ADD QUESTION */}
            <button
              type="button"
              className="add-question-button"
              onClick={addQuestion}
            >
              + Add Another Question
            </button>

          </section>

          {/* ERROR */}
          {error && (
            <div className="quiz-error">
              {error}
            </div>
          )}

          {/* ACTIONS */}
          <div className="quiz-actions">

            <button
              type="submit"
              className="primary-button"
            >
              Save Quiz
            </button>

            <Link
              to="/quizzes"
              className="secondary-button"
            >
              Cancel
            </Link>

          </div>

        </form>

      </main>

    </div>
  );
}

export default Quiz;