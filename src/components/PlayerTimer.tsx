import { formatTime, getCompletionTime, getElapsedTime } from "@/lib/game";
import { useEffect, useState } from "react";

// Add this new component
export default function PlayerTimer({
  startTime,
  completionTime,
}: {
  startTime: number | null;
  completionTime: number | null;
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!completionTime) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 100);
      return () => clearInterval(interval);
    }
  }, [completionTime]);

  if (!startTime) return null;

  return completionTime ? (
    <span className="font-semibold">
      ✓ {formatTime(getCompletionTime(startTime, completionTime))}
    </span>
  ) : (
    <span>⏱️ {formatTime(getElapsedTime(startTime, currentTime))}</span>
  );
}

// In TypingDuelGame component:
// REMOVE this effect:
// useEffect(() => {
//   const interval = setInterval(() => {
//     setCurrentTime(Date.now());
//   }, 100);
//   return () => clearInterval(interval);
// }, []);

// UPDATE player display to use PlayerTimer:
