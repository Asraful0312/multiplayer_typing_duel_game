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
