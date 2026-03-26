import React, { useState, useEffect } from 'react';
import { 
  Sprout, 
  MapPin, 
  Share2, 
  Copy, 
  Volume2, 
  CloudSun, 
  TrendingUp,
  History as HistoryIcon,
  X,
  Mic,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { VoiceRecorder } from './components/VoiceRecorder';
import { HistoryPanel } from './components/HistoryPanel';
import { ChatBox } from './components/ChatBox';
import { processVoiceNote, SautiResponse } from './lib/gemini';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import Markdown from 'react-markdown';

const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita Taveta", "Tana River", "Tharaka Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useState('Nakuru');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<SautiResponse | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'chat'>('voice');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    // Test connection with retry
    const testConnection = async (retriesLeft = 5) => {
      try {
        setConnectionStatus('connecting');
        const testDoc = doc(db, '_connection_test_', 'ping');
        await getDocFromServer(testDoc);
        console.log("Firestore connection verified.");
        setConnectionStatus('connected');
      } catch (error: any) {
        const code = error.code || "unknown";
        const msg = (error.message || "").toLowerCase();
        
        console.warn(`Firestore test error (code: ${code}):`, error);
        
        // If we get specific codes, it means we REACHED the server
        if (code === 'permission-denied' || code === 'not-found' || code === 'unauthenticated' || msg.includes('permission-denied')) {
          console.log("Firestore reached (connectivity confirmed).");
          setConnectionStatus('connected');
          return;
        }

        if (retriesLeft > 0 && (code === 'unavailable' || code === 'deadline-exceeded' || msg.includes('offline'))) {
          console.log(`Retrying Firestore connection... (${retriesLeft} left)`);
          setTimeout(() => testConnection(retriesLeft - 1), 5000);
        } else {
          console.error(`Firestore connection could not be established (code: ${code}). This might be due to provisioning delay or network issues.`);
          setConnectionStatus('error');
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Load user settings
        const settingsPath = `userSettings/${u.uid}`;
        getDoc(doc(db, settingsPath)).then((snap) => {
          if (snap.exists()) {
            setLocation(snap.data().defaultLocation);
          } else {
            setDoc(doc(db, settingsPath), {
              uid: u.uid,
              defaultLocation: 'Nakuru',
              updatedAt: serverTimestamp()
            }).catch(e => handleFirestoreError(e, OperationType.WRITE, settingsPath));
          }
        }).catch(e => handleFirestoreError(e, OperationType.GET, settingsPath));

        // Load history
        const historyPath = 'conversations';
        const q = query(
          collection(db, historyPath),
          where('uid', '==', u.uid),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        onSnapshot(q, (snap) => {
          setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (e) => handleFirestoreError(e, OperationType.GET, historyPath));
      } else {
        setHistory([]);
        setLastResponse(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login error:', err);
      alert('Hitilafu wakati wa kuingia. (Error during login.)');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLoc = e.target.value;
    setLocation(newLoc);
    if (user) {
      const path = `userSettings/${user.uid}`;
      setDoc(doc(db, path), {
        uid: user.uid,
        defaultLocation: newLoc,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, path));
    }
  };

  const handleRecordingComplete = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const result = await processVoiceNote(base64data, blob.type, location);
        setLastResponse(result);
        
        if (user) {
          const path = 'conversations';
          await addDoc(collection(db, path), {
            uid: user.uid,
            timestamp: serverTimestamp(),
            ...result
          }).catch(e => handleFirestoreError(e, OperationType.CREATE, path));
        }
        
        speak(result.responseSwahili);
      };
    } catch (err) {
      console.error(err);
      alert('Hitilafu ilitokea. Tafadhali jaribu tena.');
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sw-KE';
    window.speechSynthesis.speak(utterance);
  };

  const copyToWhatsApp = () => {
    if (!lastResponse) return;
    const text = `*Sauti-Shamba Advisor*\n\n${lastResponse.responseSwahili}\n\n---\n\n${lastResponse.responseEnglish}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const demoQuestions = [
    { label: "Bei ya nyanya Muthurwa leo?", text: "Bei ya nyanya katika soko la Muthurwa leo ni gani?" },
    { label: "Shamba langu lina ugonjwa, nini nifanye?", text: "Shamba langu la mahindi lina ugonjwa, majani yanakuwa ya njano. Nifanye nini?" },
    { label: "Hali ya hewa kesho Nakuru?", text: "Hali ya hewa itakuwaje kesho hapa Nakuru?" }
  ];

  const handleDemo = async (text: string) => {
    setIsProcessing(true);
    try {
      // For demo, we simulate a voice note by sending the text prompt
      // In a real app, we'd have pre-recorded blobs
      const result = await processVoiceNote("", "text/plain", location); // Modified gemini.ts slightly to handle text
      // Actually, let's just use a text-based call for demo
      setLastResponse(result);
      speak(result.responseSwahili);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 font-sans text-gray-900 pb-12">
      {/* Connection Status Banner */}
      {connectionStatus !== 'connected' && (
        <div className={`fixed top-0 left-0 right-0 z-50 text-center py-1 text-[10px] font-bold ${connectionStatus === 'connecting' ? 'bg-yellow-400 text-yellow-900' : 'bg-red-500 text-white'}`}>
          {connectionStatus === 'connecting' ? 'Inaunganisha kwenye hifadhidata... (Connecting to database...)' : 'Hitilafu ya muunganisho! (Connection Error! Check your internet)'}
        </div>
      )}
      {/* Header */}
      <header className="bg-green-700 text-white p-6 shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sprout className="w-8 h-8" />
            <h1 className="text-2xl font-black tracking-tight">SAUTI-SHAMBA</h1>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white/50" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 hover:bg-green-600 rounded-full transition-colors"
                >
                  <HistoryIcon />
                </button>
                <button onClick={handleLogout} className="text-xs font-bold uppercase opacity-70 hover:opacity-100">Logout</button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-white text-green-700 px-4 py-2 rounded-full font-bold text-sm shadow-md hover:bg-green-50 transition-colors"
              >
                Ingia (Login)
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-8">
        {/* Location Selector */}
        <div className="bg-white p-4 rounded-2xl shadow-md flex items-center gap-3">
          <MapPin className="text-green-600" />
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Eneo Lako (Your Location)</label>
            <select 
              value={location}
              onChange={handleLocationChange}
              className="w-full bg-transparent font-bold text-lg focus:outline-none"
            >
              {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-green-100 rounded-2xl w-fit mx-auto">
          <button 
            onClick={() => setActiveTab('voice')}
            className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'voice' ? 'bg-green-600 text-white shadow-md' : 'text-green-800 hover:bg-green-200'}`}
          >
            Sauti (Voice)
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'chat' ? 'bg-green-600 text-white shadow-md' : 'text-green-800 hover:bg-green-200'}`}
          >
            Chat (Text/Image)
          </button>
        </div>

        {/* Main Content Area */}
        <div className="space-y-8">
          {activeTab === 'voice' ? (
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-green-600 p-4 text-white text-center font-bold">
                Mshauri wa Sauti (Voice Advisor)
              </div>
              {!user ? (
                <div className="p-12 text-center">
                  <p className="text-gray-600 mb-6 font-medium">Tafadhali ingia ili kuanza kurekodi na kuhifadhi historia yako.</p>
                  <button 
                    onClick={handleLogin}
                    className="bg-green-600 text-white px-8 py-4 rounded-full font-bold text-xl shadow-xl hover:bg-green-700 transition-colors"
                  >
                    Ingia na Google (Login with Google)
                  </button>
                </div>
              ) : (
                <VoiceRecorder 
                  onRecordingComplete={handleRecordingComplete}
                  isProcessing={isProcessing}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!user ? (
                <div className="bg-white p-12 rounded-3xl shadow-xl text-center">
                  <p className="text-gray-600 mb-6 font-medium">Tafadhali ingia ili kuanza kuzungumza na mshauri.</p>
                  <button 
                    onClick={handleLogin}
                    className="bg-green-600 text-white px-8 py-4 rounded-full font-bold text-xl shadow-xl hover:bg-green-700 transition-colors"
                  >
                    Ingia na Google (Login with Google)
                  </button>
                </div>
              ) : (
                <ChatBox location={location} />
              )}
            </div>
          )}
        </div>

        {/* Demo Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {demoQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => alert('Feature coming soon: Pre-recorded demo audio')}
              className="bg-white p-4 rounded-xl shadow hover:shadow-md transition-shadow text-left border-l-4 border-green-500"
            >
              <div className="text-xs text-gray-400 font-bold uppercase mb-1">Demo {i+1}</div>
              <div className="font-medium text-gray-700">{q.label}</div>
            </button>
          ))}
        </div>

        {/* Response Area */}
        <AnimatePresence>
          {lastResponse && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className={`p-6 rounded-3xl shadow-2xl border-4 ${
                lastResponse.recommendation === 'SELL' ? 'bg-green-100 border-green-500' :
                lastResponse.recommendation === 'URGENT ACTION' ? 'bg-red-100 border-red-500' :
                'bg-blue-100 border-blue-500'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="text-4xl font-black uppercase tracking-tighter">
                    {lastResponse.recommendation}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => speak(lastResponse.responseSwahili)} className="p-2 bg-white rounded-full shadow"><Volume2 /></button>
                    <button onClick={copyToWhatsApp} className="p-2 bg-green-500 text-white rounded-full shadow"><Share2 /></button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl shadow-inner">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Kiswahili</div>
                    <div className="text-xl font-bold text-green-900 leading-tight">
                      {lastResponse.responseSwahili}
                    </div>
                  </div>

                  <div className="bg-white/50 p-4 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">English</div>
                    <div className="text-lg text-gray-700 italic">
                      {lastResponse.responseEnglish}
                    </div>
                  </div>

                  {lastResponse.profitEstimate && (
                    <div className="bg-yellow-100 p-4 rounded-2xl flex items-center gap-3 border-2 border-yellow-400">
                      <TrendingUp className="text-yellow-600" />
                      <div>
                        <div className="text-xs font-bold text-yellow-700 uppercase">Makadirio ya Faida (Profit Estimate)</div>
                        <div className="text-2xl font-black text-yellow-900">KSh {lastResponse.profitEstimate.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* History Sidebar/Overlay */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="relative w-full max-w-md bg-green-50 h-full shadow-2xl p-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-green-800">HISTORIA</h2>
                <button onClick={() => setShowHistory(false)}><X /></button>
              </div>
              <HistoryPanel 
                conversations={history} 
                onSelect={(id) => {
                  const item = history.find(h => h.id === id);
                  if (item) setLastResponse(item);
                  setShowHistory(false);
                }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Nav (Mobile) */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-around md:hidden">
        <button 
          onClick={() => setActiveTab('voice')}
          className={`flex flex-col items-center ${activeTab === 'voice' ? 'text-green-600' : 'text-gray-400'}`}
        >
          <Mic size={20} />
          <span className="text-[10px] font-bold">Sauti</span>
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center ${activeTab === 'chat' ? 'text-green-600' : 'text-gray-400'}`}
        >
          <Send size={20} />
          <span className="text-[10px] font-bold">Chat</span>
        </button>
        <button className="flex flex-col items-center text-gray-400"><CloudSun size={20} /><span className="text-[10px] font-bold">Hali ya Hewa</span></button>
        <button className="flex flex-col items-center text-gray-400"><TrendingUp size={20} /><span className="text-[10px] font-bold">Soko</span></button>
      </footer>
    </div>
  );
}
