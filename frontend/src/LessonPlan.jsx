import { useState } from "react";
import { Link } from "react-router-dom";

function LessonPlan() {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("45 minutes");
  const [objectives, setObjectives] = useState("");

  const [generated, setGenerated] = useState(false);
  const [saved, setSaved] = useState(false);

  const getObjectives = () => {
    const value = topic.trim().toLowerCase();

    if (value.includes("algebra") || value.includes("equation")) {
      return "Students will be able to identify variables and constants, simplify basic algebraic expressions, and solve simple equations.";
    }

    if (value.includes("photosynthesis") || value.includes("plant")) {
      return "Students will be able to explain photosynthesis, identify the materials required, and describe the products formed during the process.";
    }

    if (value.includes("water cycle")) {
      return "Students will be able to explain evaporation, condensation, precipitation, and collection and describe how water continuously moves through the environment.";
    }

    if (value.includes("cell") || value.includes("biology")) {
      return `Students will be able to understand the key concepts of ${topic}, identify important structures or processes, and explain their functions using examples.`;
    }

    if (
      value.includes("computer") ||
      value.includes("programming") ||
      value.includes("python")
    ) {
      return `Students will be able to understand the main concepts of ${topic}, explain their purpose, and apply their knowledge through a simple practical activity.`;
    }

    return `Students will be able to understand the key concepts of ${topic}, explain the main ideas in their own words, and apply their knowledge through practical activities.`;
  };

  const getLessonContent = () => {
    const value = topic.trim().toLowerCase();

    if (value.includes("algebra") || value.includes("equation")) {
      return {
        introduction:
          "Begin by asking students where they encounter unknown values in everyday situations. Introduce variables as symbols that represent unknown numbers and connect the idea to familiar mathematical examples.",

        activities:
          "Introduce variables, constants, and coefficients using simple expressions. Demonstrate how to simplify expressions and solve basic equations step by step. Allow students to solve practice problems individually and discuss their answers with the class.",

        assessment:
          "Ask students to identify variables, constants, and coefficients in given expressions. Provide a few simple equations and ask students to solve them independently.",

        homework:
          "Complete a short worksheet containing algebraic expressions and simple equations. Ask students to write one real-life situation that can be represented using an algebraic expression.",
      };
    }

    if (value.includes("photosynthesis") || value.includes("plant")) {
      return {
        introduction:
          "Begin by asking students how plants obtain the food they need to grow. Discuss the roles of sunlight, water, carbon dioxide, and chlorophyll.",

        activities:
          "Explain photosynthesis using a simple diagram. Discuss the materials required and the products formed. Ask students to create a labelled diagram showing the main stages of photosynthesis.",

        assessment:
          "Ask students to explain photosynthesis in their own words and identify the main materials required and products formed.",

        homework:
          "Draw and label the process of photosynthesis and write a short explanation of how plants make food.",
      };
    }

    if (value.includes("water cycle")) {
      return {
        introduction:
          "Begin by asking students what happens to water after rain falls. Introduce the water cycle as the continuous movement of water between the Earth's surface and atmosphere.",

        activities:
          "Explain evaporation, condensation, precipitation, and collection using a simple diagram. Ask students to arrange the stages in order and create their own labelled water-cycle diagram.",

        assessment:
          "Ask students to explain each stage of the water cycle and identify examples of evaporation, condensation, and precipitation.",

        homework:
          "Draw and label the complete water cycle. Write a short explanation of why the water cycle is important for life on Earth.",
      };
    }

    return {
      introduction: `Begin the lesson by introducing ${topic}. Ask students a few questions to understand what they already know and connect the topic with their previous learning.`,

      activities: `Explain the key concepts of ${topic} using clear examples and interactive activities. Encourage students to participate, ask questions, and complete a short individual or group activity.`,

      assessment: `Ask students short questions about ${topic}. Give them a small activity related to the lesson and use their responses to identify areas that need additional explanation.`,

      homework: `Give students a short practice activity related to ${topic}. Ask them to apply what they learned and prepare one question to discuss in the next class.`,
    };
  };

  const generateLessonPlan = () => {
    if (!subject.trim() || !grade.trim() || !topic.trim()) {
      alert("Please fill in Subject, Class / Grade and Topic.");
      return;
    }

    setSaved(false);
    setGenerated(true);
  };

  const saveLessonPlan = () => {
    if (!subject.trim() || !grade.trim() || !topic.trim()) {
      alert("Please fill in all required details.");
      return;
    }

    const content = getLessonContent();

    const lessonPlan = {
      id: Date.now(),
      subject: subject.trim(),
      grade: grade.trim(),
      topic: topic.trim(),
      duration,
      objectives: objectives.trim() || getObjectives(),
      introduction: content.introduction,
      activities: content.activities,
      assessment: content.assessment,
      homework: content.homework,
      savedAt: new Date().toISOString(),
    };

    try {
      const stored = localStorage.getItem("teacherGuidePlans");

      let existingPlans = [];

      if (stored) {
        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          existingPlans = parsed;
        }
      }

      const updatedPlans = [...existingPlans, lessonPlan];

      localStorage.setItem(
        "teacherGuidePlans",
        JSON.stringify(updatedPlans)
      );

      setSaved(true);
    } catch (error) {
      console.error("Error saving lesson plan:", error);
      alert("Unable to save the lesson plan. Please try again.");
    }
  };

  const createAnother = () => {
    setSubject("");
    setGrade("");
    setTopic("");
    setDuration("45 minutes");
    setObjectives("");
    setGenerated(false);
    setSaved(false);
  };

  const content = getLessonContent();
  const finalObjectives = objectives.trim() || getObjectives();

  return (
    <div className="lesson-page">
      {/* HEADER */}
      <header className="topbar">
        <div className="logo">TEACHER GUIDE</div>

        <nav>
          <Link to="/">Dashboard</Link>

          <Link to="/saved-plans">Lesson Plans</Link>

          <Link to="/classes">My Classes</Link>

          <Link to="/resources">Resources</Link>

          <Link to="/quizzes">Quizzes</Link>

          <Link to="/analytics">Analytics</Link>
        </nav>

        <button
          type="button"
          className="profile"
        >
          Teacher
        </button>
      </header>

      {/* MAIN */}
      <main className="lesson-main">
        {!generated ? (
          <>
            {/* PAGE HEADER */}
            <div className="page-heading">
              <p className="eyebrow">LESSON PLANNER</p>

              <h1>
                Create a
                <br />
                Lesson Plan.
              </h1>

              <p className="page-description">
                Build a structured lesson plan by entering
                the basic details of your class and topic.
              </p>
            </div>

            {/* FORM */}
            <section className="lesson-form">
              {/* SUBJECT + GRADE */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="subject">
                    Subject
                  </label>

                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(event) =>
                      setSubject(event.target.value)
                    }
                    placeholder="e.g. Mathematics"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="grade">
                    Class / Grade
                  </label>

                  <input
                    id="grade"
                    type="text"
                    value={grade}
                    onChange={(event) =>
                      setGrade(event.target.value)
                    }
                    placeholder="e.g. Grade 8"
                  />
                </div>
              </div>

              {/* TOPIC + DURATION */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="topic">
                    Topic
                  </label>

                  <input
                    id="topic"
                    type="text"
                    value={topic}
                    onChange={(event) =>
                      setTopic(event.target.value)
                    }
                    placeholder="e.g. Algebra"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="duration">
                    Duration
                  </label>

                  <select
                    id="duration"
                    value={duration}
                    onChange={(event) =>
                      setDuration(event.target.value)
                    }
                  >
                    <option value="30 minutes">
                      30 minutes
                    </option>

                    <option value="45 minutes">
                      45 minutes
                    </option>

                    <option value="60 minutes">
                      60 minutes
                    </option>

                    <option value="90 minutes">
                      90 minutes
                    </option>
                  </select>
                </div>
              </div>

              {/* OBJECTIVES */}
              <div className="form-group">
                <label htmlFor="objectives">
                  Learning Objectives
                </label>

                <textarea
                  id="objectives"
                  rows="5"
                  value={objectives}
                  onChange={(event) =>
                    setObjectives(event.target.value)
                  }
                  placeholder="Optional — Teacher Guide will generate objectives automatically."
                />
              </div>

              {/* ACTIONS */}
              <div className="form-actions">
                <Link
                  to="/"
                  className="cancel"
                >
                  Cancel
                </Link>

                <button
                  type="button"
                  className="generate"
                  onClick={generateLessonPlan}
                >
                  Generate Lesson Plan →
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* GENERATED PLAN */}
            <section className="generated-plan">
              {/* HEADER */}
              <div className="page-heading">
                <p className="eyebrow">
                  GENERATED LESSON PLAN
                </p>

                <h1>{topic}</h1>

                <p className="page-description">
                  {subject} · {grade} · {duration}
                </p>
              </div>

              {/* PLAN CONTENT */}
              <div className="plan-grid">
                {/* OBJECTIVES */}
                <div className="plan-section">
                  <span className="number">
                    01
                  </span>

                  <h2>
                    Learning Objectives
                  </h2>

                  <p>{finalObjectives}</p>
                </div>

                {/* INTRODUCTION */}
                <div className="plan-section">
                  <span className="number">
                    02
                  </span>

                  <h2>
                    Introduction
                  </h2>

                  <p>
                    {content.introduction}
                  </p>
                </div>

                {/* ACTIVITIES */}
                <div className="plan-section">
                  <span className="number">
                    03
                  </span>

                  <h2>
                    Teaching Activities
                  </h2>

                  <p>
                    {content.activities}
                  </p>
                </div>

                {/* ASSESSMENT */}
                <div className="plan-section">
                  <span className="number">
                    04
                  </span>

                  <h2>
                    Assessment
                  </h2>

                  <p>
                    {content.assessment}
                  </p>
                </div>

                {/* HOMEWORK */}
                <div className="plan-section">
                  <span className="number">
                    05
                  </span>

                  <h2>
                    Homework
                  </h2>

                  <p>
                    {content.homework}
                  </p>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="form-actions">
                <button
                  type="button"
                  className="generate"
                  onClick={saveLessonPlan}
                  disabled={saved}
                >
                  {saved
                    ? "✓ Lesson Plan Saved"
                    : "Save Lesson Plan"}
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={createAnother}
                >
                  ← Create Another
                </button>

                {saved && (
                  <Link
                    to="/saved-plans"
                    className="secondary"
                  >
                    View Saved Plans →
                  </Link>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default LessonPlan;