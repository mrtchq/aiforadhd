import React, { useEffect, useRef } from 'react';

export type CallState = 'idle' | 'requesting-permission' | 'connecting' | 'active' | 'ended' | 'error';

interface VoiceCallManagerProps {
  isOpen: boolean;
  onStateChange: (state: CallState) => void;
  onTimeRemainingChange: (seconds: number) => void;
  onVolumeChange: (userVol: number, quillVol: number) => void;
  onError: (msg: string | null) => void;
  onEnd: () => void;
  todoistToken?: string | null;
  locations?: any[];
  onToolExecuted?: (data: { toolExecuted: string; args: any; result: any }) => void;
}

// Convert float32 PCM array to 16-bit signed integer ArrayBuffer
const floatTo16BitPCM = (input: Float32Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    let val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(i * 2, val, true); // true for little-endian PCM
  }
  return buffer;
};

// Robust, fast, and bug-free base64 converter for ArrayBuffer
const base64ArrayBuffer = (arrayBuffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Downsamples float32 array buffer from native rate to target rate (16000Hz)
const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array => {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }
  if (inputSampleRate < outputSampleRate) {
    return buffer; // Fallback if native is somehow lower than 16k
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
};

export default function VoiceCallManager({
  isOpen,
  onStateChange,
  onTimeRemainingChange,
  onVolumeChange,
  onError,
  onEnd,
  todoistToken = null,
  locations = [],
  onToolExecuted,
}: VoiceCallManagerProps) {
  // Audio & WS Context refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  // State refs to prevent closures from having stale state
  const silenceTimerRef = useRef(0);
  const durationTimerRef = useRef(300);
  const quillVolumeRef = useRef(0);
  const userVolumeRef = useRef(0);
  const hasErrorRef = useRef(false);

  // Keep callback refs updated to avoid stale React closures
  const onVolumeChangeRef = useRef(onVolumeChange);
  const onTimeRemainingChangeRef = useRef(onTimeRemainingChange);
  const onStateChangeRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);
  const onEndRef = useRef(onEnd);
  const onToolExecutedRef = useRef(onToolExecuted);

  useEffect(() => {
    onVolumeChangeRef.current = onVolumeChange;
    onTimeRemainingChangeRef.current = onTimeRemainingChange;
    onStateChangeRef.current = onStateChange;
    onErrorRef.current = onError;
    onEndRef.current = onEnd;
    onToolExecutedRef.current = onToolExecuted;
  }, [onVolumeChange, onTimeRemainingChange, onStateChange, onError, onEnd, onToolExecuted]);

  // Stop all active model audio playbacks
  const stopAllAudio = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    quillVolumeRef.current = 0;
    onVolumeChangeRef.current(userVolumeRef.current, 0);
  };

  // Playback base64 audio chunk received from server
  const playAudioChunk = (audioCtx: AudioContext, base64PCM: string) => {
    try {
      const binary = window.atob(base64PCM);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);

      // Convert Int16 back to Float32
      const float32Array = new Float32Array(int16Array.length);
      let sumSquares = 0;
      for (let i = 0; i < int16Array.length; i++) {
        const val = int16Array[i] / 32768.0;
        float32Array[i] = val;
        sumSquares += val * val;
      }
      
      // Calculate output volume for waveform animation
      const rms = Math.sqrt(sumSquares / int16Array.length);
      const qVol = rms * 4.5;
      quillVolumeRef.current = qVol;
      onVolumeChangeRef.current(userVolumeRef.current, qVol);

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000); // Model outputs at 24kHz PCM
      audioBuffer.getChannelData(0).set(float32Array);

      const now = audioCtx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.08; // small schedule offset to counteract jitter
      }

      const sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioCtx.destination);

      activeSourcesRef.current.push(sourceNode);
      sourceNode.onended = () => {
        const idx = activeSourcesRef.current.indexOf(sourceNode);
        if (idx > -1) activeSourcesRef.current.splice(idx, 1);
        
        // Reset visual volume when idle
        if (activeSourcesRef.current.length === 0) {
          quillVolumeRef.current = 0;
          onVolumeChangeRef.current(userVolumeRef.current, 0);
        }
      };

      sourceNode.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

    } catch (err) {
      console.error('[CallManager] Playback error:', err);
    }
  };

  // End Call function (fully release stream, ws, context)
  const endCall = () => {
    // Stop mic capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    // Stop and clean playback sources
    stopAllAudio();

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    quillVolumeRef.current = 0;
    userVolumeRef.current = 0;
    onVolumeChangeRef.current(0, 0);
  };

  // Start Voice Call Process
  const startCall = async () => {
    onStateChangeRef.current('requesting-permission');
    onErrorRef.current(null);
    hasErrorRef.current = false;
    silenceTimerRef.current = 0;
    durationTimerRef.current = 300;
    onTimeRemainingChangeRef.current(300);

    try {
      // 1. Request Microphone access (at native default rate)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      onStateChangeRef.current('connecting');

      // 2. Open Audio Contexts
      const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputAudioCtx;
      outputAudioCtxRef.current = outputAudioCtx;

      // 3. Connect to server-side WebSocket proxy with credentials and parameters
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const queryParams = new URLSearchParams();
      if (todoistToken) {
        queryParams.append('todoist_token', todoistToken);
      }
      if (locations && locations.length > 0) {
        queryParams.append('locations', encodeURIComponent(JSON.stringify(locations)));
      }
      const queryStr = queryParams.toString();
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws${queryStr ? '?' + queryStr : ''}`;
      console.log('[CallManager] Connecting to live socket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[CallManager] WS connected. Setting up mic processor.');
        onStateChangeRef.current('active');

        // Set up mic capture script processor
        const source = inputAudioCtx.createMediaStreamSource(stream);
        const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(inputAudioCtx.destination);

        processor.onaudioprocess = (e) => {
          const channelData = e.inputBuffer.getChannelData(0);

          // Compute user amplitude (RMS) on native channel data
          let sumSquares = 0;
          for (let i = 0; i < channelData.length; i++) {
            sumSquares += channelData[i] * channelData[i];
          }
          const rms = Math.sqrt(sumSquares / channelData.length);
          const uVol = rms * 5.0;
          userVolumeRef.current = uVol;
          onVolumeChangeRef.current(uVol, quillVolumeRef.current);

          // Downsample native buffer to 16000Hz PCM
          const resampledData = downsampleBuffer(channelData, inputAudioCtx.sampleRate, 16000);

          // Convert to int16, encode to base64, and send over WebSocket
          const pcmBuffer = floatTo16BitPCM(resampledData);
          const base64PCM = base64ArrayBuffer(pcmBuffer);
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ audio: base64PCM }));
          }

          // -------------------------------------------------------------
          // SILENCE DETECTION ENGINE (10s threshold when model is idle)
          // -------------------------------------------------------------
          const isQuillSpeaking = quillVolumeRef.current > 0.01 || (nextStartTimeRef.current > outputAudioCtx.currentTime);
          
          if (!isQuillSpeaking) {
            // User silence check (threshold 0.0035 for clear rooms)
            if (rms < 0.0035) {
              const elapsedSeconds = channelData.length / inputAudioCtx.sampleRate; // native time duration
              silenceTimerRef.current += elapsedSeconds;

              if (silenceTimerRef.current >= 10) {
                console.log('[CallManager] 10s of user silence detected. Terminating call.');
                onStateChangeRef.current('ended');
                endCall();
                onEndRef.current();
              }
            } else {
              silenceTimerRef.current = 0;
            }
          } else {
            silenceTimerRef.current = 0;
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.error) {
            hasErrorRef.current = true;
            onStateChangeRef.current('error');
            onErrorRef.current(msg.error);
            endCall();
            onEndRef.current();
            return;
          }

          if (msg.audio) {
            playAudioChunk(outputAudioCtx, msg.audio);
          }

          if (msg.interrupted) {
            console.log('[CallManager] Model turn interrupted by user speaking. Stopping audio.');
            stopAllAudio();
          }

          if (msg.toolExecuted) {
            console.log('[CallManager] Tool execution complete:', msg.toolExecuted, msg.args, msg.result);
            if (onToolExecutedRef.current) {
              onToolExecutedRef.current(msg);
            }
          }
        } catch (err) {
          console.error('[CallManager] Error parsing server payload:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('[CallManager] WebSocket error:', e);
        if (hasErrorRef.current) return;
        hasErrorRef.current = true;
        onStateChangeRef.current('error');
        onErrorRef.current('A network interruption occurred. Please try again.');
        endCall();
        onEndRef.current();
      };

      ws.onclose = () => {
        console.log('[CallManager] WebSocket closed.');
        if (hasErrorRef.current) return;
        onStateChangeRef.current('ended');
        endCall();
        onEndRef.current();
      };

    } catch (err: any) {
      console.error('[CallManager] Call initiation failed:', err);
      onStateChangeRef.current('error');
      const isPermissionError = err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('permission') || err.message?.toLowerCase().includes('allowed');
      onErrorRef.current(
        isPermissionError
          ? 'Microphone access is blocked. Please allow mic permissions in your address bar, or click Open in New Tab if running inside a sandboxed iframe.'
          : (err.message || 'Microphone access is required for Voice calls. Please grant permission in your browser settings.')
      );
      onEndRef.current();
    }
  };

  // Run countdown of 5 minutes call limit
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && inputAudioCtxRef.current) {
        durationTimerRef.current -= 1;
        onTimeRemainingChangeRef.current(durationTimerRef.current);
        
        if (durationTimerRef.current <= 0) {
          console.log('[CallManager] 5-minute maximum call duration reached.');
          onStateChangeRef.current('ended');
          endCall();
          onEndRef.current();
        }
      }
    }, 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Clean up fully on unmount or toggle
  useEffect(() => {
    if (isOpen) {
      startCall();
    } else {
      endCall();
    }
    return () => {
      endCall();
    };
  }, [isOpen]);

  return null;
}
