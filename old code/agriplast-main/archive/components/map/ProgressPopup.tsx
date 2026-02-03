'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ProgressUpdate {
  step: string;
  status: 'in_progress' | 'complete' | 'error' | 'success';
  message: string;
  progress: number;
  step_number?: number;
  total_steps?: number;
  logs?: string[];
  error?: string;
}

interface ProgressPopupProps {
  isOpen: boolean;
  progress: number;
  currentStep: string;
  progressUpdates?: ProgressUpdate[];
  onClose?: () => void;
  onRetry?: () => void;
  error?: string | null;
}

export function ProgressPopup({ 
  isOpen, 
  progress, 
  currentStep, 
  progressUpdates = [],
  onClose, 
  onRetry,
  error 
}: ProgressPopupProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (progress >= 100 && onClose && !error) {
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [progress, onClose, error]);

  // Calculate estimated time remaining
  useEffect(() => {
    if (progress > 0 && progress < 100) {
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      const rate = progress / elapsed; // % per second
      const remaining = (100 - progress) / rate; // seconds remaining
      setEstimatedTimeRemaining(Math.max(0, Math.round(remaining)));
    } else {
      setEstimatedTimeRemaining(null);
    }
  }, [progress, startTime]);

  if (!isOpen) return null;

  const allLogs = progressUpdates
    .filter(update => update.logs && update.logs.length > 0)
    .flatMap(update => update.logs || []);

  const content = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ position: 'fixed' }}>
      {/* Translucent background overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal content */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-10 max-w-2xl w-full mx-4 transform transition-all animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="text-center">
          {/* Title */}
          <h3 className="font-mono font-bold text-2xl text-gray-900 mb-6">
            {error ? 'Error' : progress >= 100 ? 'Complete!' : 'Planning & Executing'}
          </h3>
          
          {/* Error state */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-800 font-sans text-sm mb-4">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-6 py-2 bg-red-600 text-white font-sans font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry Execution
                </button>
              )}
            </div>
          )}
          
          {/* Progress Circle Visualization */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="#E5E7EB"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke={error ? "#EF4444" : "#4AC1FF"}
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            {/* Percentage text in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold" style={{ color: error ? '#EF4444' : '#4AC1FF' }}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
            <div 
              className="h-full transition-all duration-500 ease-out rounded-full"
              style={{ 
                width: `${progress}%`,
                background: error 
                  ? 'linear-gradient(to right, #EF4444, #F87171)'
                  : 'linear-gradient(to right, #4AC1FF, #60D0FF)'
              }}
            />
          </div>

          {/* Current Step */}
          <div className="text-base font-sans font-medium text-gray-700 mb-4 min-h-[48px] flex items-center justify-center">
            {currentStep}
          </div>

          {/* Estimated time remaining */}
          {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && !error && (
            <div className="text-sm font-sans text-gray-500 mb-4">
              Estimated time remaining: {estimatedTimeRemaining}s
            </div>
          )}

          {/* Step progress indicator */}
          {progressUpdates.length > 0 && !error && (
            <div className="mb-4">
              <div className="text-xs font-mono font-semibold text-gray-600 mb-2">Execution Steps</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {progressUpdates.slice(-5).map((update, idx) => (
                  <div key={idx} className="text-xs font-sans text-left bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        update.status === 'complete' ? 'bg-green-500' :
                        update.status === 'error' ? 'bg-red-500' :
                        'bg-blue-500'
                      }`} />
                      <span className="text-gray-700">{update.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backend logs toggle */}
          {allLogs.length > 0 && !error && (
            <div className="mb-4">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs font-sans text-blue-600 hover:text-blue-800 underline"
              >
                {showLogs ? 'Hide' : 'Show'} Backend Logs ({allLogs.length})
              </button>
              {showLogs && (
                <div className="mt-2 text-left bg-gray-900 text-green-400 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
                  {allLogs.map((log, idx) => (
                    <div key={idx} className="mb-1">{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spinner or Success Icon */}
          {!error && progress < 100 ? (
            <div className="flex justify-center">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-[#4AC1FF] border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : !error ? (
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Render using portal to ensure it's at the document root level
  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
