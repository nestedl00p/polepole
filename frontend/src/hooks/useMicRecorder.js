import { useCallback, useRef, useState } from 'react';

// Records microphone audio via the MediaRecorder API and resolves a Blob on stop.
// Returns { supported, recording, error, start, stop }.
export function useMicRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const supported =
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const start = useCallback(async () => {
    setError(null);
    if (!supported) { setError('Recording is not supported in this browser.'); return false; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      return true;
    } catch {
      setError('Microphone access was blocked. Allow it in your browser to practice speaking.');
      return false;
    }
  }, [supported]);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const mr = recorderRef.current;
      if (!mr || mr.state === 'inactive') { setRecording(false); return resolve(null); }
      mr.onstop = () => {
        const type = mr.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        resolve(blob.size ? blob : null);
      };
      mr.stop();
    });
  }, []);

  return { supported, recording, error, start, stop };
}
