import React from 'react';

interface Props {
  script: string[];
  onScriptChange: (script: string[]) => void;
  disabled: boolean;
}

export default function ScriptInput({ script, onScriptChange, disabled }: Props) {
  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const segments = text
      .split('\n---\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    onScriptChange(segments);
  };

  const scriptText = script.join('\n---\n');

  return (
    <div className="script-input">
      <label htmlFor="script">Your Script</label>
      <p className="hint">Separate segments with a blank line containing "---"</p>
      <textarea
        id="script"
        value={scriptText}
        onChange={handleScriptChange}
        disabled={disabled}
        placeholder="Enter your script...&#10;&#10;---&#10;&#10;Second part of your script..."
        rows={6}
      />
      <div className="segment-count">
        {script.length} segment{script.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
