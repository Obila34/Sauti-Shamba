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
    <div className="flex flex-col h-[600px] glass apple-shadow rounded-[32px] overflow-hidden">
      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium uppercase tracking-widest">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-apple-blue text-white apple-shadow'
                    : 'bg-black/5 text-black'
                }`}
              >
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Uploaded"
                    className="rounded-xl mb-3 w-full object-cover apple-shadow"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                  <Markdown>{msg.content}</Markdown>
                </div>
                <div className={`text-[10px] mt-2 font-medium uppercase tracking-widest ${
                  msg.role === 'user' ? 'text-white/40' : 'text-black/20'
                }`}>
                  {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-black/5 text-black/40 rounded-2xl p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-medium uppercase tracking-widest">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white/50 backdrop-blur-md border-t border-black/5">
        <AnimatePresence>
          {image && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative inline-block mb-4"
            >
              <img src={image} alt="Preview" className="w-20 h-20 object-cover rounded-xl apple-shadow" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute -top-2 -right-2 bg-black text-white rounded-full p-1 apple-shadow apple-transition hover:scale-110"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-end gap-4">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Sauti anything..."
              className="w-full bg-transparent border-none focus:ring-0 p-0 text-lg font-light placeholder:text-black/20 resize-none min-h-[44px] max-h-32 no-scrollbar"
              rows={1}
            />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-black/10" />
          </div>

          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-black/5 rounded-full text-black/40 cursor-pointer hover:bg-black/10 apple-transition"
            >
              <ImageIcon size={20} />
            </button>
            <button
              type="submit"
              disabled={isSending || (!input.trim() && !image)}
              className="p-3 bg-apple-blue text-white rounded-full apple-shadow apple-transition disabled:opacity-20 hover:scale-[1.05] active:scale-[0.95]"
            >
              {isSending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
