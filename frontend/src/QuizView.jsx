import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function QuizView() {
  const { id } = useParams();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedQuizzes =
        JSON.parse(
          localStorage.getItem("teacherGuideQuizzes")
        ) || [];

      const foundQuiz = savedQuizzes.find(
        (item) => String(item.id) === String(id)
      );

      setQuiz(foundQuiz || null);
    } catch (error) {
      console.error("Unable to load quiz:", error);
      setQuiz(null);
    }

    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="app">
        <main className="dashboard">
          <section className="empty-state">
            <h2>Loading quiz...</h2>
          </section>
        </main>
      </div>
    );
  }

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
              This quiz may have been deleted or does not
              exist anymore.
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
            QUIZ DETAILS
          </p>

          <h1>
            {quiz.title}
          </h1>

          <p className="hero-text">
            {quiz.subject} • {quiz.grade} •{" "}
            {quiz.duration}
          </p>

          <div className="hero-buttons">

            <Link
              to={`/take-quiz/${quiz.id}`}
              className="primary-button"
            >
              Take Quiz
            </Link>

            <Link
              to="/quizzes"
              className="secondary-button"
            >
              ← Back to Quizzes
            </Link>

          </div>

        </section>


        {/* QUIZ INFORMATION */}

        <section className="quiz-library-header">

          <div>

            <p className="eyebrow">
              QUIZ INFORMATION
            </p>

            <h2>
              Assessment Overview
            </h2>

          </div>

          <div className="quiz-count">
            {quiz.questions?.length || 0}
          </div>

        </section>


        {/* QUESTIONS */}

        <section className="quiz-list">

          {quiz.questions?.map((question, index) => {

            const options = Array.isArray(question.options)
              ? question.options
              : [];

            return (

              <article
                className="saved-quiz-card"
                key={index}
              >

                <div className="saved-quiz-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="saved-quiz-content">

                  <h2>
                    Question {index + 1}
                  </h2>

                  <p className="quiz-question-text">
                    {question.question}
                  </p>


                  {/* OPTIONS */}

                  <div className="quiz-view-options">

                    {["A", "B", "C", "D"].map(
                      (letter, optionIndex) => (

                        <div
                          className="quiz-option"
                          key={letter}
                        >

                          <strong>
                            {letter}
                          </strong>

                          <span>
                            {options[optionIndex] || "—"}
                          </span>

                        </div>

                      )
                    )}

                  </div>


                  {/* CORRECT ANSWER */}

                  <div className="correct-answer">

                    <span>
                      Correct Answer
                    </span>

                    <strong>
                      {question.answer || "Not selected"}
                    </strong>

                  </div>

                </div>

              </article>

            );
          })}

        </section>


        {/* BOTTOM ACTIONS */}

        <div className="quiz-actions">

          <Link
            to={`/take-quiz/${quiz.id}`}
            className="primary-button"
          >
            Take This Quiz
          </Link>

          <Link
            to="/quizzes"
            className="secondary-button"
          >
            Back to Quiz Library
          </Link>

        </div>

      </main>

    </div>
  );
}

export default QuizView;