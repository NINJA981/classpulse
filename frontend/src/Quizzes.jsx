import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Quizzes() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [duration, setDuration] = useState("30");

  const [questions, setQuestions] = useState([
    {
      question: "",
      options: ["", "", "", ""],
      answer: "",
    },
  ]);

  const [error, setError] = useState("");

  // =========================
  // ADD QUESTION
  // =========================

  const addQuestion = () => {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      {
        question: "",
        options: ["", "", "", ""],
        answer: "",
      },
    ]);

    setError("");
  };

  // =========================
  // REMOVE QUESTION
  // =========================

  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      setError("At least one question is required.");
      return;
    }

    setQuestions((currentQuestions) =>
      currentQuestions.filter((_, questionIndex) => {
        return questionIndex !== index;
      })
    );

    setError("");
  };

  // =========================
  // UPDATE QUESTION
  // =========================

  const updateQuestion = (index, value) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((item, questionIndex) => {
        if (questionIndex !== index) {
          return item;
        }

        return {
          ...item,
          question: value,
        };
      })
    );

    setError("");
  };

  // =========================
  // UPDATE OPTION
  // =========================

  const updateOption = (
    questionIndex,
    optionIndex,
    value
  ) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((item, currentIndex) => {
        if (currentIndex !== questionIndex) {
          return item;
        }

        const updatedOptions = [...item.options];

        updatedOptions[optionIndex] = value;

        return {
          ...item,
          options: updatedOptions,
        };
      })
    );

    setError("");
  };

  // =========================
  // UPDATE CORRECT ANSWER
  // =========================

  const updateAnswer = (questionIndex, value) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((item, currentIndex) => {
        if (currentIndex !== questionIndex) {
          return item;
        }

        return {
          ...item,
          answer: value,
        };
      })
    );

    setError("");
  };

  // =========================
  // SAVE QUIZ
  // =========================

  const saveQuiz = () => {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("Please enter the quiz title.");
      return;
    }

    if (!subject) {
      setError("Please select a subject.");
      return;
    }

    if (!grade) {
      setError("Please select a grade.");
      return;
    }

    if (!duration) {
      setError("Please select a duration.");
      return;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      setError("Please add at least one question.");
      return;
    }

    // Validate every question
    for (let i = 0; i < questions.length; i += 1) {
      const currentQuestion = questions[i];

      if (!currentQuestion.question.trim()) {
        setError(
          `Please enter Question ${i + 1}.`
        );
        return;
      }

      if (
        !Array.isArray(currentQuestion.options) ||
        currentQuestion.options.length !== 4
      ) {
        setError(
          `Question ${i + 1} must have exactly 4 options.`
        );
        return;
      }

      for (let j = 0; j < 4; j += 1) {
        if (!currentQuestion.options[j].trim()) {
          const optionLetter = String.fromCharCode(
            65 + j
          );

          setError(
            `Please enter Option ${optionLetter} for Question ${i + 1}.`
          );
          return;
        }
      }

      if (!currentQuestion.answer) {
        setError(
          `Please select the correct answer for Question ${i + 1}.`
        );
        return;
      }
    }

    // =========================
    // CREATE QUIZ OBJECT
    // =========================

    const newQuiz = {
      id: Date.now().toString(),

      title: cleanTitle,

      subject: subject,

      grade: grade,

      duration: `${duration} minutes`,

      questions: questions.map((item) => {
        return {
          question: item.question.trim(),

          options: item.options.map((option) =>
            option.trim()
          ),

          answer: item.answer,
        };
      }),

      createdAt: new Date().toISOString(),
    };

    // =========================
    // LOAD EXISTING QUIZZES
    // =========================

    let existingQuizzes = [];

    try {
      const savedQuizzes = localStorage.getItem(
        "teacherGuideQuizzes"
      );

      if (savedQuizzes) {
        const parsedQuizzes =
          JSON.parse(savedQuizzes);

        if (Array.isArray(parsedQuizzes)) {
          existingQuizzes = parsedQuizzes;
        }
      }
    } catch (storageError) {
      console.error(
        "Unable to read existing quizzes:",
        storageError
      );

      existingQuizzes = [];
    }

    // =========================
    // SAVE QUIZ
    // =========================

    const updatedQuizzes = [
      ...existingQuizzes,
      newQuiz,
    ];

    try {
      localStorage.setItem(
        "teacherGuideQuizzes",
        JSON.stringify(updatedQuizzes)
      );

      // Verify saved data
      const savedData = localStorage.getItem(
        "teacherGuideQuizzes"
      );

      if (!savedData) {
        setError(
          "Quiz could not be saved. Please try again."
        );
        return;
      }

      // Verify JSON can be parsed
      const verification = JSON.parse(savedData);

      if (!Array.isArray(verification)) {
        setError(
          "Quiz data could not be verified."
        );
        return;
      }

      // Go to quiz management page
      navigate("/quizzes");
    } catch (storageError) {
      console.error(
        "Unable to save quiz:",
        storageError
      );

      setError(
        "Quiz could not be saved. Please try again."
      );
    }
  };

  return (
    <div className="app">

      {/* =========================
          NAVBAR
      ========================= */}

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

      {/* =========================
          MAIN CONTENT
      ========================= */}

      <main className="dashboard">

        {/* =========================
            HERO
        ========================= */}

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
            Create engaging quizzes for your
            students and organize assessments
            in one place.
          </p>

        </section>

        {/* =========================
            QUIZ INFORMATION
        ========================= */}

        <section className="quiz-form-section">

          <div className="form-heading">

            <span className="number">
              01
            </span>

            <h2>
              Quiz Information
            </h2>

          </div>

          <div className="form-grid">

            {/* QUIZ TITLE */}

            <div className="form-group">

              <label htmlFor="quiz-title">
                Quiz Title
              </label>

              <input
                id="quiz-title"
                type="text"
                placeholder="Example: Algebra Basics"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
              />

            </div>

            {/* SUBJECT */}

            <div className="form-group">

              <label htmlFor="quiz-subject">
                Subject
              </label>

              <select
                id="quiz-subject"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setError("");
                }}
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
                value={grade}
                onChange={(event) => {
                  setGrade(event.target.value);
                  setError("");
                }}
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
                value={duration}
                onChange={(event) => {
                  setDuration(event.target.value);
                  setError("");
                }}
              >

                <option value="15">
                  15 minutes
                </option>

                <option value="30">
                  30 minutes
                </option>

                <option value="45">
                  45 minutes
                </option>

                <option value="60">
                  60 minutes
                </option>

              </select>

            </div>

          </div>

        </section>

        {/* =========================
            QUESTIONS
        ========================= */}

        <section className="quiz-form-section">

          <div className="form-heading">

            <span className="number">
              02
            </span>

            <h2>
              Questions
            </h2>

          </div>

          {questions.map(
            (item, questionIndex) => {

              return (
                <div
                  className="question-box"
                  key={`question-${questionIndex}`}
                >

                  {/* QUESTION HEADER */}

                  <div className="question-header">

                    <strong>
                      Question {questionIndex + 1}
                    </strong>

                    {questions.length > 1 && (
                      <button
                        type="button"
                        className="delete-question"
                        onClick={() =>
                          removeQuestion(
                            questionIndex
                          )
                        }
                      >
                        Delete
                      </button>
                    )}

                  </div>

                  {/* QUESTION TEXT */}

                  <div className="form-group">

                    <label
                      htmlFor={`question-${questionIndex}`}
                    >
                      Question
                    </label>

                    <textarea
                      id={`question-${questionIndex}`}
                      rows="4"
                      placeholder="Enter your question..."
                      value={item.question}
                      onChange={(event) =>
                        updateQuestion(
                          questionIndex,
                          event.target.value
                        )
                      }
                    />

                  </div>

                  {/* OPTIONS */}

                  <div className="options-grid">

                    {item.options.map(
                      (option, optionIndex) => {

                        const letter =
                          String.fromCharCode(
                            65 + optionIndex
                          );

                        return (
                          <div
                            className="form-group"
                            key={`option-${questionIndex}-${optionIndex}`}
                          >

                            <label
                              htmlFor={`option-${questionIndex}-${optionIndex}`}
                            >
                              Option {letter}
                            </label>

                            <input
                              id={`option-${questionIndex}-${optionIndex}`}
                              type="text"
                              placeholder={`Enter option ${letter}`}
                              value={option}
                              onChange={(event) =>
                                updateOption(
                                  questionIndex,
                                  optionIndex,
                                  event.target.value
                                )
                              }
                            />

                          </div>
                        );
                      }
                    )}

                  </div>

                  {/* CORRECT ANSWER */}

                  <div className="form-group">

                    <label
                      htmlFor={`answer-${questionIndex}`}
                    >
                      Correct Answer
                    </label>

                    <select
                      id={`answer-${questionIndex}`}
                      value={item.answer}
                      onChange={(event) =>
                        updateAnswer(
                          questionIndex,
                          event.target.value
                        )
                      }
                    >

                      <option value="">
                        Select Correct Answer
                      </option>

                      <option value="A">
                        Option A
                      </option>

                      <option value="B">
                        Option B
                      </option>

                      <option value="C">
                        Option C
                      </option>

                      <option value="D">
                        Option D
                      </option>

                    </select>

                  </div>

                </div>
              );
            }
          )}

          {/* ADD QUESTION */}

          <button
            type="button"
            className="secondary-button"
            onClick={addQuestion}
          >
            + Add Another Question
          </button>

        </section>

        {/* =========================
            ERROR MESSAGE
        ========================= */}

        {error && (
          <div
            className="quiz-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* =========================
            ACTION BUTTONS
        ========================= */}

        <section className="quiz-actions">

          <button
            type="button"
            className="primary-button"
            onClick={saveQuiz}
          >
            Save Quiz
          </button>

          <Link
            to="/quizzes"
            className="secondary-button"
          >
            Cancel
          </Link>

        </section>

      </main>

    </div>
  );
}

export default Quizzes;