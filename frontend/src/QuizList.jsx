import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function QuizList() {
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = () => {
    try {
      const saved = localStorage.getItem("teacherGuideQuizzes");

      if (!saved) {
        setQuizzes([]);
        return;
      }

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setQuizzes(parsed);
      } else {
        setQuizzes([]);
      }
    } catch (error) {
      console.error("Unable to load quizzes:", error);
      setQuizzes([]);
    }
  };

  const deleteQuiz = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this quiz?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const updatedQuizzes = quizzes.filter(
        (quiz) => quiz.id !== id
      );

      localStorage.setItem(
        "teacherGuideQuizzes",
        JSON.stringify(updatedQuizzes)
      );

      setQuizzes(updatedQuizzes);
    } catch (error) {
      console.error("Unable to delete quiz:", error);
    }
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
            QUIZ LIBRARY
          </p>

          <h1>
            Create.
            <br />
            Assess.
          </h1>

          <p className="hero-text">
            Manage your quizzes, review assessments and
            create new quizzes for your students.
          </p>

          <div className="hero-buttons">

            <Link
              to="/quiz-builder"
              className="primary-button"
            >
              + Create New Quiz
            </Link>

            <Link
              to="/"
              className="secondary-button"
            >
              Back to Dashboard
            </Link>

          </div>

        </section>


        {/* HEADER */}

        <section className="quiz-library-header">

          <div>

            <p className="eyebrow">
              YOUR QUIZZES
            </p>

            <h2>
              Saved Assessments
            </h2>

          </div>

          <div className="quiz-count">
            {quizzes.length}
          </div>

        </section>


        {/* EMPTY STATE */}

        {quizzes.length === 0 && (

          <section className="empty-state">

            <div className="empty-number">
              00
            </div>

            <h2>
              No quizzes created yet.
            </h2>

            <p>
              Create your first quiz to start building
              assessments for your students.
            </p>

            <Link
              to="/quiz-builder"
              className="primary-button"
            >
              Create Your First Quiz
            </Link>

          </section>

        )}


        {/* QUIZ LIST */}

        {quizzes.length > 0 && (

          <section className="quiz-list">

            {quizzes.map((quiz, index) => (

              <article
                className="saved-quiz-card"
                key={quiz.id}
              >

                {/* NUMBER */}

                <div className="saved-quiz-number">
                  {String(index + 1).padStart(2, "0")}
                </div>


                {/* CONTENT */}

                <div className="saved-quiz-content">

                  <div className="saved-quiz-top">

                    <div>

                      <h2>
                        {quiz.title}
                      </h2>

                      <p className="quiz-meta">
                        {quiz.subject}
                        {" • "}
                        {quiz.grade}
                      </p>

                    </div>

                  </div>


                  {/* DETAILS */}

                  <div className="quiz-details">

                    <span>
                      {quiz.questions?.length || 0} Questions
                    </span>

                    <span>
                      {quiz.duration}
                    </span>

                    {quiz.createdAt && (
                      <span>
                        {new Date(
                          quiz.createdAt
                        ).toLocaleDateString()}
                      </span>
                    )}

                  </div>


                  {/* ACTIONS */}

                  <div className="quiz-card-actions">

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        navigate(
                          `/quiz-view/${quiz.id}`
                        )
                      }
                    >
                      View
                    </button>


                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        navigate(
                          `/take-quiz/${quiz.id}`
                        )
                      }
                    >
                      Take Quiz
                    </button>


                    <button
                      type="button"
                      className="delete-button"
                      onClick={() =>
                        deleteQuiz(quiz.id)
                      }
                    >
                      Delete
                    </button>

                  </div>

                </div>

              </article>

            ))}

          </section>

        )}

      </main>

    </div>
  );
}

export default QuizList;