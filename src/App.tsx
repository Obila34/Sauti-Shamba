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
import { WeatherView } from './components/WeatherView';
import { MarketView } from './components/MarketView';
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
  const [activeTab, setActiveTab] = useState<'voice' | 'chat' | 'weather' | 'market'>('voice');
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
    setLastResponse(null); // Clear previous response immediately
    try {
      const buffer = await blob.arrayBuffer();
      const base64data = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const result = await processVoiceNote(base64data, blob.type, location);
      setLastResponse(result);
      
      if (user) {
        const path = 'conversations';
        addDoc(collection(db, path), {
          uid: user.uid,
          timestamp: serverTimestamp(),
          ...result
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, path));
      }
      
      speak(result.responseSwahili);
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
    <div className="min-h-screen bg-white font-sans text-black selection:bg-apple-blue/20">
      {/* Connection Status Banner */}
      {connectionStatus !== 'connected' && (
        <div className={`fixed top-0 left-0 right-0 z-[60] text-center py-1 text-[10px] font-bold tracking-widest uppercase ${connectionStatus === 'connecting' ? 'bg-yellow-400/90 text-yellow-900' : 'bg-red-500/90 text-white'} backdrop-blur-md`}>
          {connectionStatus === 'connecting' ? 'Connecting to database...' : 'Connection Error'}
        </div>
      )}

      {/* Minimal Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass apple-shadow">
        <div className="max-w-2xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-medium tracking-tight">Sauti</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2 hover:bg-black/5 rounded-full apple-transition"
                >
                  <HistoryIcon className="w-5 h-5 opacity-60" />
                </button>
                <img 
                  src={user.photoURL} 
                  alt={user.displayName} 
                  className="w-8 h-8 rounded-full apple-shadow" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="text-sm font-medium text-apple-blue hover:opacity-70 apple-transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-24 pb-32 space-y-12">
        {/* Location Selector - Minimal Underline Style */}
        <section className="flex flex-col items-center text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full">
            <MapPin className="w-3.5 h-3.5 opacity-40" />
            <select 
              value={location}
              onChange={handleLocationChange}
              className="bg-transparent text-xs font-semibold uppercase tracking-widest focus:outline-none appearance-none cursor-pointer text-black/60"
            >
              {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </section>

        {/* Main Content Area with Transitions */}
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="min-h-[500px]"
        >
          {activeTab === 'voice' && (
            <VoiceRecorder 
              onRecordingComplete={handleRecordingComplete}
              isProcessing={isProcessing}
            />
          )}

          {activeTab === 'chat' && (
            <div className="space-y-8">
              {!user ? (
                <div className="glass p-12 rounded-[32px] text-center space-y-6 apple-shadow">
                  <div className="w-16 h-16 bg-apple-blue/10 rounded-2xl flex items-center justify-center mx-auto">
                    <Send className="w-8 h-8 text-apple-blue" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-light">Chat with Sauti</h2>
                    <p className="text-black/40 max-w-xs mx-auto">Sign in to start a conversation and track your farm's progress.</p>
                  </div>
                  <button 
                    onClick={handleLogin}
                    className="bg-black text-white px-8 py-3.5 rounded-full font-medium apple-transition hover:scale-[1.02] active:scale-[0.96]"
                  >
                    Continue with Google
                  </button>
                </div>
              ) : (
                <ChatBox location={location} user={user} />
              )}
            </div>
          )}

          {activeTab === 'weather' && (
            <WeatherView location={location} />
          )}

          {activeTab === 'market' && (
            <MarketView />
          )}
        </motion.div>

        {/* Response Area - Glass Morphism */}
        <AnimatePresence>
          {lastResponse && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-8 rounded-[32px] apple-shadow space-y-8"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                    lastResponse.recommendation === 'SELL' ? 'text-green-500' :
                    lastResponse.recommendation === 'URGENT ACTION' ? 'text-red-500' :
                    'text-apple-blue'
                  }`}>
                    Recommendation
                  </span>
                  <h2 className="text-4xl font-light tracking-tighter">
                    {lastResponse.recommendation}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => speak(lastResponse.responseSwahili)} 
                    className="w-10 h-10 glass rounded-full flex items-center justify-center hover:bg-black/5 apple-transition"
                  >
                    <Volume2 className="w-5 h-5 opacity-60" />
                  </button>
                  <button 
                    onClick={copyToWhatsApp} 
                    className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:opacity-90 apple-transition"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">Kiswahili</span>
                  <p className="text-xl font-light leading-relaxed text-black/80">
                    {lastResponse.responseSwahili}
                  </p>
                </div>

                <div className="h-px bg-black/5" />

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">English</span>
                  <p className="text-lg font-light leading-relaxed text-black/50 italic">
                    {lastResponse.responseEnglish}
                  </p>
                </div>

                {lastResponse.profitEstimate && (
                  <div className="bg-apple-blue/5 p-6 rounded-2xl flex items-center justify-between border border-apple-blue/10">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-apple-blue/60">Profit Estimate</span>
                      <div className="text-2xl font-medium tracking-tight">KSh {lastResponse.profitEstimate.toLocaleString()}</div>
                    </div>
                    <TrendingUp className="w-8 h-8 text-apple-blue/40" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Bottom Nav */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="glass apple-shadow rounded-full p-1.5 flex gap-1">
          {[
            { id: 'voice', label: 'Voice', icon: Mic },
            { id: 'chat', label: 'Chat', icon: Send },
            { id: 'weather', label: 'Weather', icon: CloudSun },
            { id: 'market', label: 'Market', icon: TrendingUp }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium apple-transition ${
                activeTab === tab.id 
                  ? 'bg-black text-white apple-shadow' 
                  : 'text-black/40 hover:text-black hover:bg-black/5'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'opacity-100' : 'opacity-40'} />
              <span className={activeTab === tab.id ? 'block' : 'hidden md:block'}>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex justify-center items-end md:items-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-lg glass apple-shadow rounded-[32px] p-8 max-h-[80vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-light tracking-tight">History</h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="w-10 h-10 glass rounded-full flex items-center justify-center hover:bg-black/5 apple-transition"
                >
                  <X className="w-5 h-5 opacity-40" />
                </button>
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
    </div>
  );
}
