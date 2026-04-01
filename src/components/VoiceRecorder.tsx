import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isHoldingRef = useRef(false);

  const handleStart = async () => {
    if (isProcessing || isHoldingRef.current) return;
    isHoldingRef.current = true;
    setIsHolding(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!isHoldingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error:', err);
      isHoldingRef.current = false;
      setIsHolding(false);
      alert('Tafadhali ruhusu maikrofoni ili kurekodi sauti.');
    }
  };

  const handleStop = () => {
    isHoldingRef.current = false;
    setIsHolding(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    if (streamRef.current && !mediaRecorderRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="orb-container">
        <div className="orb-aurora" />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onMouseDown={handleStart}
          onMouseUp={handleStop}
          onMouseLeave={handleStop}
          onTouchStart={(e) => { e.preventDefault(); handleStart(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleStop(); }}
          disabled={isProcessing}
          className={`orb-core ${
            isProcessing ? 'orb-processing' : isHolding ? 'orb-listening' : 'orb-idle'
          } flex items-center justify-center cursor-pointer border-none outline-none`}
        >
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-white/80 animate-spin" />
          ) : isHolding ? (
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-sm" />
            </div>
          ) : (
            <Mic className="w-12 h-12 text-white/90" />
          )}
        </motion.button>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 text-center space-y-2"
      >
        <p className="text-2xl font-light tracking-tight text-black/80">
          {isProcessing ? 'Inachakata...' : isHolding ? 'Tusikilize...' : 'Sema na Zao'}
        </p>
        <p className="text-sm text-black/40 font-medium uppercase tracking-[0.2em]">
          {isHolding ? 'Release to process' : 'Press and hold to speak'}
        </p>
      </motion.div>
    </div>
  );
};
