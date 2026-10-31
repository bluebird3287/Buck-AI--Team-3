import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ThinkingIndicatorProps {
  stage?: string; // what BuckAI is doing right now
  slowNote?: string; // shown after 20 seconds
  className?: string;
}

// "Thinking… 12s": a live timer so students can see the AI is still working on a long request.
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ stage, slowNote, className = '' }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`flex items-start gap-2.5 text-xs bg-white p-3 rounded-lg border border-gray-200 w-fit max-w-full ${className}`}>
      <RefreshCw className="w-4 h-4 text-[#ba0c2f] animate-spin shrink-0 mt-0.5" aria-hidden />
      <div>
        <div className="font-semibold text-gray-900">
          Thinking… <span className="tabular-nums text-gray-600 font-normal" aria-hidden>{seconds}s</span>
        </div>
        {/* Only the stage is announced to screen readers, not every tick of the timer */}
        {stage && (
          <div role="status" aria-live="polite" className="text-gray-600 mt-0.5">
            {stage}
          </div>
        )}
        {seconds >= 20 && slowNote && <div className="text-gray-500 mt-0.5">{slowNote}</div>}
      </div>
    </div>
  );
};
