import React from 'react';
import { History, MessageSquare, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface Conversation {
  id: string;
  transcription: string;
  timestamp: any;
  crop: string;
  recommendation: string;
}

interface HistoryPanelProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ conversations, onSelect }) => {
  return (
    <div className="space-y-4">
      {conversations.length === 0 ? (
        <div className="glass p-12 rounded-[32px] apple-shadow text-center opacity-40">
          <History className="w-12 h-12 mx-auto mb-4" />
          <p className="text-sm font-medium uppercase tracking-widest">No history yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {conversations.map((conv) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(conv.id)}
              className="glass p-6 rounded-[24px] apple-shadow cursor-pointer apple-transition group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
                    {conv.timestamp?.toDate ? conv.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
                  </span>
                  <h3 className="text-xl font-light group-hover:text-apple-blue apple-transition">{conv.crop}</h3>
                </div>
                <span className={`text-[10px] px-3 py-1 rounded-full font-bold tracking-widest uppercase ${
                  conv.recommendation === 'SELL' ? 'bg-green-500/10 text-green-600' :
                  conv.recommendation === 'URGENT ACTION' ? 'bg-red-500/10 text-red-600' :
                  'bg-apple-blue/10 text-apple-blue'
                }`}>
                  {conv.recommendation}
                </span>
              </div>
              <p className="text-sm text-black/60 font-light italic line-clamp-2 leading-relaxed">
                "{conv.transcription}"
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
