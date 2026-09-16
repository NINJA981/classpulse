import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

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
      <AppShell>
        <div>
          <section className="empty-block">
            <span className="live-dot" />
            <p className="zine-label">Quiz</p>
            <h2>Loading quiz...</h2>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!quiz) {
    return (
      <AppShell>

        <div>

          <div className="page-center">

            <section className="empty-block">
              <p className="zine-label">
                QUIZ DETAILS
              </p>

              <h2>
                Quiz not found.
              </h2>

              <p>
                This quiz may have been deleted or does not
                exist anymore.
              </p>

              <Link
                to="/quizzes"
                className="ui-button ui-button-primary"
              >
                ← Back to Quizzes
              </Link>

            </section>

          </div>

        </div>

      </AppShell>
    );
  }

  return (
    <AppShell>

      {/* MAIN */}

      <div>

        {/* HERO */}

        <header className="page-header">

          <div className="page-header-copy">

            <p className="zine-label">
              QUIZ DETAILS
            </p>

            <h1>
              {quiz.title}
            </h1>

            <p>
              {quiz.subject} • {quiz.grade} •{" "}
              {quiz.duration}
            </p>

          </div>

          <div className="page-header-side">

            <Link
              to="/quizzes"
              className="ui-button ui-button-secondary"
            >
              ← Back to Quizzes
            </Link>

            <Link
              to={`/take-quiz/${quiz.id}`}
              className="ui-button ui-button-primary"
            >
              Take Quiz
            </Link>

          </div>

        </header>


        {/* QUIZ INFORMATION */}

        <section className="section-block">

        <div className="section-header">

          <div className="section-header-copy">

            <p className="zine-label">
              QUIZ INFORMATION
            </p>

            <h2>
              Assessment Overview
            </h2>

          </div>

          <span className="ui-pill">
            {quiz.questions?.length || 0}
          </span>

        </div>


        {/* QUESTIONS */}

        <div className="stack-5">

          {quiz.questions?.map((question, index) => {

            const options = Array.isArray(question.options)
              ? question.options
              : [];

            return (

              <article
                className={
                  index === 0
                    ? "stack-card pad-6"
                    : "ui-card pad-6"
                }
                key={index}
              >

                <div className="card-top">

                  <span className="index-circle">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="ui-pill">
                    Question {index + 1}
                  </span>

                </div>

                <div>

                  <p className="text-question">
                    {question.question}
                  </p>


                  {/* OPTIONS */}

                  <div className="card-grid-2 quizflow-options">

                    {["A", "B", "C", "D"].map(
                      (letter, optionIndex) => {

                        const isCorrect =
                          String(question.answer || "")
                            .trim()
                            .toUpperCase() === letter;

                        return (

                          <div
                            className={`quiz-option quiz-option-static${
                              isCorrect
                                ? " quiz-option-correct"
                                : ""
                            }`}
                            key={letter}
                          >

                            <span className="quiz-option-key">
                              {letter}
                            </span>

                            <span className="quiz-option-text">
                              {options[optionIndex] || "—"}
                            </span>

                            {isCorrect && (
                              <span className="quiz-option-mark">
                                ✓
                              </span>
                            )}

                          </div>

                        );
                      }
                    )}

                  </div>


                  {/* CORRECT ANSWER */}

                  <div className="detail-section">

                    <span>
                      Correct Answer
                    </span>

                    <p>
                      <strong>
                        {question.answer || "Not selected"}
                      </strong>
                    </p>

                  </div>

                </div>

              </article>

            );
          })}

        </div>

        </section>


        {/* BOTTOM ACTIONS */}

        <div className="ui-button-row back-row">

          <Link
            to={`/take-quiz/${quiz.id}`}
            className="ui-button ui-button-primary"
          >
            Take This Quiz
          </Link>

          <Link
            to="/quizzes"
            className="ui-button ui-button-secondary"
          >
            Back to Quiz Library
          </Link>

        </div>

      </div>

    </AppShell>
  );
}

export default QuizView;
