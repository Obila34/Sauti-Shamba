import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onRecordingComplete, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Tafadhali ruhusu maikrofoni ili kurekodi sauti. (Please allow microphone access to record voice.)');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="orb-container">
        <div className="orb-aurora" />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          disabled={isProcessing}
          className={`orb-core ${
            isProcessing ? 'orb-processing' : isRecording ? 'orb-listening' : 'orb-idle'
          } flex items-center justify-center cursor-pointer border-none outline-none`}
        >
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-white/80 animate-spin" />
          ) : isRecording ? (
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
          {isProcessing ? 'Inachakata...' : isRecording ? 'Tusikilize...' : 'Sema na Sauti'}
        </p>
        <p className="text-sm text-black/40 font-medium uppercase tracking-[0.2em]">
          {isRecording ? 'Release to process' : 'Press and hold to speak'}
        </p>
      </motion.div>
    </div>
  );
};
