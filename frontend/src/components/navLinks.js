/* Default sidebar navigation. Includes Phase A onboarding & concept graph validation routes. */
export const DEFAULT_NAV_LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/concept-validation", label: "Concept Graph", also: ["/concept-validation"] },
  { to: "/saved-plans", label: "Lesson Plans", also: ["/lesson-plan", "/lesson/"] },
  { to: "/classes", label: "My Classes" },
  { to: "/resources", label: "Resources", also: ["/resource/"] },
  { to: "/quizzes", label: "Quizzes", also: ["/quiz/", "/quiz-list", "/saved-quizzes", "/take-quiz"] },
  { to: "/analytics", label: "Analytics" },
  { to: "/claim", label: "Account Claim", also: ["/claim"] },
];

