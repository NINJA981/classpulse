const STORAGE_KEY = "teacherGuideData";

const defaultData = {
  classes: [],
  students: [],
  lessonPlans: [],
  resources: [],
  quizzes: [],
  quizAttempts: [],
};

export function getData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return defaultData;
    }

    return {
      ...defaultData,
      ...JSON.parse(saved),
    };
  } catch (error) {
    console.error("Unable to load Teacher Guide data:", error);
    return defaultData;
  }
}

export function saveData(data) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );
}

export function updateData(updates) {
  const currentData = getData();

  const newData = {
    ...currentData,
    ...updates,
  };

  saveData(newData);

  return newData;
}

export function addItem(type, item) {
  const data = getData();

  const updatedItems = [
    ...(data[type] || []),
    {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      ...item,
    },
  ];

  const newData = {
    ...data,
    [type]: updatedItems,
  };

  saveData(newData);

  return newData;
}

export function removeItem(type, id) {
  const data = getData();

  const updatedItems = (data[type] || []).filter(
    (item) => item.id !== id
  );

  const newData = {
    ...data,
    [type]: updatedItems,
  };

  saveData(newData);

  return newData;
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStats() {
  const data = getData();

  const totalStudents = data.students.length;
  const totalClasses = data.classes.length;
  const totalLessonPlans = data.lessonPlans.length;
  const totalResources = data.resources.length;
  const totalQuizzes = data.quizzes.length;
  const totalQuizAttempts = data.quizAttempts.length;

  const scores = data.quizAttempts
    .map((attempt) => Number(attempt.score))
    .filter((score) => !Number.isNaN(score));

  const averageScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0) /
            scores.length
        )
      : 0;

  return {
    totalStudents,
    totalClasses,
    totalLessonPlans,
    totalResources,
    totalQuizzes,
    totalQuizAttempts,
    averageScore,
  };
}