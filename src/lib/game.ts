import { toast } from "sonner";

export const getAccuracy = (progress: string, phrase: string) => {
  if (!progress || !phrase) return 100;
  let correct = 0;
  for (let i = 0; i < progress.length; i++) {
    if (progress[i] === phrase[i]) {
      correct++;
    }
  }
  return progress.length > 0
    ? Math.round((correct / progress.length) * 100)
    : 100;
};

export const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const ms = Math.floor((milliseconds % 1000) / 100);
  return `${seconds}.${ms}s`;
};

export const getElapsedTime = (startTime: number, currentTime: number) => {
  if (!startTime || startTime > Date.now()) return 0;
  return currentTime - startTime;
};

export const getCompletionTime = (
  startTime: number | undefined,
  completionTime: number | undefined
) => {
  if (!startTime || !completionTime) return 0;
  return completionTime - startTime;
};

export const handleCopyText = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Text copied to clipboard!"),
    () => toast.error("Failed to copy text.")
  );
};

export const getWPM = (
  progress: string,
  startTime: number,
  endTime?: number
) => {
  if (!startTime) return 0;
  const end = endTime ?? Date.now();
  const elapsedMinutes = (end - startTime) / 60000;
  if (elapsedMinutes <= 0) return 0;
  return Math.round(progress.length / 5 / elapsedMinutes);
};

// Add these helper functions to your lib/game.ts or create a new utils file

export const calculateWinPercentage = (
  wins: number = 0,
  totalGames: number = 0
): number => {
  if (totalGames === 0) return 0;
  return Math.round((wins / totalGames) * 100);
};

export const formatWinPercentage = (
  wins: number = 0,
  totalGames: number = 0
): string => {
  const percentage = calculateWinPercentage(wins, totalGames);
  return `${percentage}%`;
};

export const getPlayerStats = (user: any) => {
  const wins = user?.wins || 0;
  const losses = user?.losses || 0;
  const totalGames = user?.totalGames || 0;
  const score = user?.score || 0;
  const winPercentage = calculateWinPercentage(wins, totalGames);

  return {
    wins,
    losses,
    totalGames,
    score,
    winPercentage,
  };
};

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local) return email;

  const visiblePart = local.slice(0, 2); // show first 2 chars
  const maskedPart = "*".repeat(local.length - 2);
  return `${visiblePart}${maskedPart}@${domain}`;
}
