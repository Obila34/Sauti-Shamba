import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Loader2, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit } from 'firebase/firestore';
import { processChat } from '../lib/gemini';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: any;
}

interface ChatBoxProps {
  location: string;
  user: any;
}

export function ChatBox({ location, user }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(newMessages);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'chats'));

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setImage(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !image) || isSending) return;

    const user = auth.currentUser;
    if (!user) return;

    const userMessage = input;
    const userImage = image;
    setInput('');
    setImage(null);
    setIsSending(true);

    try {
      // Save user message
      const chatPath = 'chats';
      await addDoc(collection(db, chatPath), {
        uid: user.uid,
        role: 'user',
        content: userMessage || (userImage ? "Picha ya shamba langu (Image of my farm)" : ""),
        imageUrl: userImage,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, chatPath));

      // Process with Gemini
      const base64Image = userImage ? userImage.split(',')[1] : undefined;
      const imageMimeType = userImage ? userImage.split(';')[0].split(':')[1] : undefined;
      const aiResponse = await processChat(userMessage, base64Image, imageMimeType, location);

      // Save AI response
      await addDoc(collection(db, chatPath), {
        uid: user.uid,
        role: 'assistant',
        content: aiResponse,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, chatPath));
    } catch (err) {
      console.error('Chat error:', err);
      // Add a local error message to the chat
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: "Samahani, kulikuwa na hitilafu. Tafadhali jaribu tena. (Sorry, there was an error. Please try again.)",
        timestamp: new Date()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-2xl shadow-xl overflow-hidden border border-green-100">
      <div className="bg-green-600 p-4 text-white font-bold flex items-center gap-2">
        <Bot className="w-5 h-5" />
        Mshauri wa Shamba (Farm Advisor Chat)
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
      >
        {messages.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Bot className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Uliza swali lolote kuhusu shamba lako.<br/>(Ask any question about your farm.)</p>
          </div>
        )}
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-green-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 rounded-tl-none border border-green-50'
            }`}>
              {msg.imageUrl && (
                <img 
                  src={msg.imageUrl} 
                  alt="User upload" 
                  className="w-full max-h-48 object-cover rounded-lg mb-2"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="prose prose-sm max-w-none prose-p:leading-tight">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white border border-green-50 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
              <span className="text-xs text-gray-400 font-bold uppercase">Anatafakari...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white border-t border-green-50">
        <AnimatePresence>
          {image && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative mb-2"
            >
              <img src={image} alt="Preview" className="h-20 w-20 object-cover rounded-lg border-2 border-green-500" />
              <button 
                type="button"
                onClick={() => setImage(null)}
                className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
          >
            <ImageIcon size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
            accept="image/*" 
            className="hidden" 
          />
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Andika swali lako hapa..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button 
            type="submit"
            disabled={(!input.trim() && !image) || isSending}
            className="p-2 bg-green-600 text-white rounded-full disabled:opacity-50 shadow-lg hover:bg-green-700 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
