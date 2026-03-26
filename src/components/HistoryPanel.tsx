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
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
      <div className="flex items-center gap-2 mb-4 border-bottom pb-2">
        <History className="text-green-600" />
        <h2 className="text-xl font-bold text-gray-800">Historia Yako</h2>
      </div>
      
      {conversations.length === 0 ? (
        <p className="text-gray-500 italic">Bado huna historia ya mazungumzo.</p>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <motion.div
              key={conv.id}
              whileHover={{ x: 5 }}
              onClick={() => onSelect(conv.id)}
              className="p-3 border rounded-xl hover:bg-green-50 cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-green-700">{conv.crop}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  conv.recommendation === 'SELL' ? 'bg-green-100 text-green-800' :
                  conv.recommendation === 'URGENT ACTION' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {conv.recommendation}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-1 italic">"{conv.transcription}"</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                <Calendar size={10} />
                {conv.timestamp?.toDate ? conv.timestamp.toDate().toLocaleDateString() : 'Hivi sasa'}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
