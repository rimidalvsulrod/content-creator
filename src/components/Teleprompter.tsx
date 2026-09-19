import React from 'react';

interface Props {
  text: string;
  segmentIndex: number;
  totalSegments: number;
  isRecording: boolean;
}

export default function Teleprompter({
  text,
  segmentIndex,
  totalSegments,
  isRecording,
}: Props) {
  return (
    <div className="teleprompter">
      <div className="teleprompter-header">
        <span className="segment-indicator">
          Segment {segmentIndex + 1} / {totalSegments}
        </span>
        {isRecording && <span className="recording-indicator">● RECORDING</span>}
      </div>
      <div className="teleprompter-content">
        <p>{text}</p>
      </div>
      <div className="teleprompter-footer">
        {isRecording && <p>Speak clearly and naturally!</p>}
      </div>
    </div>
  );
}
