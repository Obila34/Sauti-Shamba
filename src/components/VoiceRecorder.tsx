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
    <div className="flex flex-col items-center justify-center p-8">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        disabled={isProcessing}
        className={`w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
          isRecording ? 'bg-red-500 scale-110 ring-8 ring-red-100' : 'bg-green-600'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isProcessing ? (
          <Loader2 className="w-16 h-16 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="w-16 h-16 text-white" />
        ) : (
          <Mic className="w-16 h-16 text-white" />
        )}
        <span className="text-white font-bold mt-2 text-center px-4">
          {isProcessing ? 'Inachakata...' : isRecording ? 'Acha Kurekodi' : 'Rekodi Sauti'}
        </span>
      </motion.button>
      <p className="mt-4 text-gray-600 font-medium text-lg">
        {isRecording ? 'Tusikilize shamba lako...' : 'Bonyeza kurekodi ujumbe wako'}
      </p>
    </div>
  );
};
