import React from 'react';

interface Props {
  pacing: number;
  onPacingChange: (pacing: number) => void;
  disabled: boolean;
}

export default function PacingControl({ pacing, onPacingChange, disabled }: Props) {
  return (
    <div className="pacing-control">
      <label htmlFor="pacing">Segment Duration</label>
      <div className="pacing-input">
        <input
          id="pacing"
          type="range"
          min="3"
          max="30"
          value={pacing}
          onChange={(e) => onPacingChange(parseInt(e.target.value))}
          disabled={disabled}
        />
        <span className="pacing-value">{pacing}s</span>
      </div>
      <p className="hint">
        Each segment records for {pacing} seconds, then 5 seconds break before next
      </p>
    </div>
  );
}
