import React, { useRef, useState, useEffect } from 'react';
import ScriptInput from './components/ScriptInput';
import PacingControl from './components/PacingControl';
import Teleprompter from './components/Teleprompter';
import RecordingControls from './components/RecordingControls';
import axios from 'axios';
import './App.css';

interface RecordingState {
  isRecording: boolean;
  currentSegmentIndex: number;
  recordedBlobs: Blob[];
  isProcessing: boolean;
  error: string | null;
}

export default function App() {
  const [script, setScript] = useState<string[]>([]);
  const [pacing, setPacing] = useState(5);
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    currentSegmentIndex: 0,
    recordedBlobs: [],
    isProcessing: false,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (breakTimerRef.current) clearTimeout(breakTimerRef.current);
    };
  }, []);

  const startRecording = async () => {
    if (!script.length) {
      setState(prev => ({ ...prev, error: 'Please enter a script' }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      setState(prev => ({
        ...prev,
        isRecording: true,
        currentSegmentIndex: 0,
        recordedBlobs: [],
        error: null,
      }));

      recordSegment(mediaRecorder, 0);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to access camera',
      }));
    }
  };

  const recordSegment = (mediaRecorder: MediaRecorder, segmentIndex: number) => {
    if (segmentIndex >= script.length) {
      finishRecording();
      return;
    }

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.start();
    setState(prev => ({ ...prev, currentSegmentIndex: segmentIndex }));

    recordingTimerRef.current = setTimeout(() => {
      mediaRecorder.stop();

      const blob = new Blob(chunks, { type: 'video/webm' });
      setState(prev => ({
        ...prev,
        recordedBlobs: [...prev.recordedBlobs, blob],
      }));

      breakTimerRef.current = setTimeout(() => {
        recordSegment(mediaRecorder, segmentIndex + 1);
      }, 5000);
    }, pacing * 1000);
  };

  const finishRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      isProcessing: true,
    }));

    processVideo();
  };

  const processVideo = async () => {
    try {
      const formData = new FormData();
      state.recordedBlobs.forEach((blob, index) => {
        formData.append('segments', blob, `segment_${index}.webm`);
      });

      const response = await axios.post('/api/merge-video', formData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'content.mp4');
      document.body.appendChild(link);
      link.click();
      link.parentElement?.removeChild(link);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        isRecording: false,
        recordedBlobs: [],
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to process video',
        isProcessing: false,
      }));
    }
  };

  const cancelRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (breakTimerRef.current) clearTimeout(breakTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      recordedBlobs: [],
      error: null,
    }));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📹 Content Creator</h1>
        <p>Record with teleprompter, automatic cuts, and MP4 export</p>
      </header>

      <main className="app-main">
        {state.isRecording ? (
          <div className="recording-view">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="video-preview"
            />
            <Teleprompter
              text={script[state.currentSegmentIndex] || ''}
              segmentIndex={state.currentSegmentIndex}
              totalSegments={script.length}
              isRecording={true}
            />
            <RecordingControls
              onCancel={cancelRecording}
              isProcessing={state.isProcessing}
              currentSegment={state.currentSegmentIndex + 1}
              totalSegments={script.length}
            />
          </div>
        ) : (
          <div className="setup-view">
            <div className="setup-panel">
              <ScriptInput
                script={script}
                onScriptChange={setScript}
                disabled={state.isRecording}
              />
              <PacingControl
                pacing={pacing}
                onPacingChange={setPacing}
                disabled={state.isRecording}
              />
              <button
                className="start-button"
                onClick={startRecording}
                disabled={state.isRecording || !script.length}
              >
                {state.isProcessing ? '⏳ Processing...' : '🔴 Start Recording'}
              </button>
            </div>

            {state.error && (
              <div className="error-message">{state.error}</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
