import React from 'react';

interface Props {
  onCancel: () => void;
  isProcessing: boolean;
  currentSegment: number;
  totalSegments: number;
}

export default function RecordingControls({
  onCancel,
  isProcessing,
  currentSegment,
  totalSegments,
}: Props) {
  return (
    <div className="recording-controls">
      <div className="progress-info">
        <p>Progress: {currentSegment} / {totalSegments}</p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(currentSegment / totalSegments) * 100}%` }}
          />
        </div>
      </div>
      <button
        className="cancel-button"
        onClick={onCancel}
        disabled={isProcessing}
      >
        {isProcessing ? '⏳ Processing...' : '⏹ Cancel'}
      </button>
    </div>
  );
}
