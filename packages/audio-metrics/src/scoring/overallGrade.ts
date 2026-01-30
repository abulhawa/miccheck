import type { CategoryScores, GradeLetter } from "../types";

const gradeFromStars = (stars: number): GradeLetter => {
  switch (stars) {
    case 5:
      return "A";
    case 4:
      return "B";
    case 3:
      return "C";
    case 2:
      return "D";
    case 1:
    default:
      return "F";
  }
};

/**
 * Determine the overall letter grade based on the weakest category.
 */
export const computeOverallGrade = (scores: CategoryScores): GradeLetter => {
  const minStars = Math.min(scores.level.stars, scores.noise.stars, scores.room.stars);
  return gradeFromStars(minStars);
};
