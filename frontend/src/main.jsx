import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App.jsx";
import LessonPlan from "./LessonPlan.jsx";
import SavedPlans from "./SavedPlans.jsx";
import LessonView from "./LessonView.jsx";

import Classes from "./Classes.jsx";
import ClassView from "./ClassView.jsx";

import Resources from "./Resources.jsx";
import ResourceView from "./ResourceView.jsx";

import Analytics from "./Analytics.jsx";

import QuizList from "./QuizList.jsx";
import Quizzes from "./Quizzes.jsx";
import QuizView from "./QuizView.jsx";
import TakeQuiz from "./TakeQuiz.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>

        {/* Dashboard */}
        <Route path="/" element={<App />} />

        {/* Lesson Plans */}
        <Route path="/lesson-plan" element={<LessonPlan />} />
        <Route path="/saved-plans" element={<SavedPlans />} />
        <Route path="/lesson-view/:id" element={<LessonView />} />

        {/* Classes */}
        <Route path="/classes" element={<Classes />} />
        <Route path="/class-view/:id" element={<ClassView />} />

        {/* Resources */}
        <Route path="/resources" element={<Resources />} />
        <Route path="/resource-view/:id" element={<ResourceView />} />

        {/* Analytics */}
        <Route path="/analytics" element={<Analytics />} />

        {/* Quiz Builder */}
        <Route path="/quiz-builder" element={<Quizzes />} />

        {/* Quiz Library */}
        <Route path="/quizzes" element={<QuizList />} />

        {/* Quiz View */}
        <Route path="/quiz-view/:id" element={<QuizView />} />

        {/* Take Quiz */}
        <Route path="/take-quiz/:id" element={<TakeQuiz />} />

        {/* Fallback */}
        <Route
          path="*"
          element={
            <div style={{ padding: "40px", fontFamily: "Arial" }}>
              <h1>Page Not Found</h1>
              <p>The page you are looking for does not exist.</p>
            </div>
          }
        />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);