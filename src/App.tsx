import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  CloudRain, 
  Bug, 
  TrendingUp, 
  Calendar, 
  Calculator, 
  Camera, 
  Mic, 
  Send, 
  User, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  Info,
  Menu,
  X,
  Plus,
  ArrowRight,
  Leaf,
  Bell,
  Settings,
  ArrowLeft,
  Phone,
  Paperclip,
  MoreHorizontal,
  Search,
  History,
  Activity,
  Sun,
  Cloud,
  CloudLightning,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  serverTimestamp, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';
import { format } from 'date-fns';

// --- Types ---
import { Farmer, FieldData, Message, Conversation, DiseaseReport } from './types';

// --- Constants ---
const SYSTEM_INSTRUCTION = `You are Zao — Kenya's most intelligent voice-powered farm assistant, built on Google's AI for Agriculture platform.
You are warm, trusted, and practical. Every answer is hyper-local, actionable, and budget-conscious. You speak the farmer's language.

Always match the farmer's language. Swahili → respond in Swahili. English → English. Mixed/Sheng → friendly mix.

Voice mode: MAX 4 sentences. No symbols or lists. Natural speech only.
Text/chat mode: Full emojis, tables, bold, structured formatting.
Always end with one follow-up question.
Tone: Trusted neighbor + PhD agronomist. Never condescending. Always budget-conscious.

HARD RULES:
- NO banned pesticides (Endosulfan, DDT, Methyl parathion)
- NO human medical advice
- NO invented prices — use ranges, add "check current rates"
- ALWAYS respect traditional farming knowledge, build on it
- ALWAYS assume farmer has ≤2 acres and limited cash — give cheapest effective solution first
- NEVER give advice without considering the farmer's resource constraints`;

const MARKET_PRICES = [
  { crop: "Maize", price: "3,200", trend: "up", icon: "🌽" },
  { crop: "Beans", price: "8,500", trend: "down", icon: "🫘" },
  { crop: "Potatoes", price: "1,200", trend: "up", icon: "🥔" },
  { crop: "Tomatoes", price: "2,400", trend: "up", icon: "🍅" },
];

const COUNTIES = [
  "Migori", "Nakuru", "Kiambu", "Nairobi", "Mombasa", 
  "Uasin Gishu", "Kilifi", "Machakos", "Kisumu", "Meru",
  "Bungoma", "Kakamega", "Nyeri", "Murang'a", "Kericho"
];

const QUICK_ACTIONS = [
  { id: 'chat', label: 'Crop Advice', icon: Leaf, bg: 'bg-green-pale', iconColor: 'text-green-primary' },
  { id: 'diagnosis', label: 'Pest Diagnosis', icon: Bug, bg: 'bg-[#FFF0DC]', iconColor: 'text-earth-brown' },
  { id: 'market', label: 'Market Prices', icon: TrendingUp, bg: 'bg-[#FFF9E6]', iconColor: 'text-sun-gold' },
  { id: 'diagnosis_upload', label: 'Upload Photo', icon: Camera, bg: 'bg-[#EAF2FB]', iconColor: 'text-sky-blue' },
  { id: 'profit', label: 'Farm Calculator', icon: Calculator, bg: 'bg-earth-pale', iconColor: 'text-earth-brown' },
  { id: 'calendar', label: 'Planting Calendar', icon: Calendar, bg: 'bg-green-pale', iconColor: 'text-green-primary' },
];

const PLANTING_CALENDAR = [
  { month: "Jan", task: "Harvest short rains. Sell beans now (peak price). Review farm finances." },
  { month: "Feb", task: "Land prep. Buy seed and fertilizer early (prices rise in March)." },
  { month: "Mar", task: "PLANT! First rains. Maize (H614D), beans, sweet potatoes." },
  { month: "Apr", task: "Top-dress CAN. Scout Fall Armyworm daily. Weed beans." },
  { month: "May", task: "Second weeding. Foliar spray if plants look pale." },
  { month: "Jun", task: "Maize tasseling — critical. Scout every 2 days." },
  { month: "Jul", task: "Early harvest. Dry immediately. DO NOT SELL — store in PICS bags." },
  { month: "Aug", task: "Main harvest. Prices at lowest. STORE everything possible." },
  { month: "Sep", task: "SHORT RAINS. Plant beans, kale, tomatoes, sorghum." },
  { month: "Oct", task: "Fertilize. Sell stored maize (price recovering)." },
  { month: "Nov", task: "Harvest short rains beans. Sell at peak KES 9,000–11,000." },
  { month: "Dec", task: "Rest land or plant drought-tolerant crops. Plan next year." },
];

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      try {
        const parsed = JSON.parse(event.error.message);
        setErrorInfo(JSON.stringify(parsed, null, 2));
      } catch {
        setErrorInfo(event.error.message);
      }
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="glass-card p-8 max-w-2xl w-full border-red-200">
          <h2 className="text-2xl font-bold text-red-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-8 h-8" />
            System Error
          </h2>
          <p className="text-red-600 mb-4">Something went wrong. Please check your connection or Firebase configuration.</p>
          <pre className="bg-black/5 p-4 rounded-lg overflow-auto text-xs font-mono mb-6">
            {errorInfo}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary w-full"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => {
  const [appState, setAppState] = useState<'splash' | 'onboarding' | 'main'>('splash');
  const [user, setUser] = useState<any>(null);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [fieldData, setFieldData] = useState<FieldData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'farm' | 'chat' | 'diagnosis' | 'profile' | 'market' | 'calendar' | 'profit'>('home');
  const [diagnosisImage, setDiagnosisImage] = useState<string | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedCounty, setSelectedCounty] = useState('Migori');
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingInterval = useRef<any>(null);
  const selectionRef = useRef({ county: 'Migori', town: '', crops: [] as string[] });

  // Keep ref in sync with state for auth listener
  useEffect(() => {
    selectionRef.current = { county: selectedCounty, town: selectedTown, crops: selectedCrops };
  }, [selectedCounty, selectedTown, selectedCrops]);

  // --- Splash Screen Timer ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) setAppState('onboarding');
      else setAppState('main');
    }, 2500);
    return () => clearTimeout(timer);
  }, [user]);

  // --- Firebase Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setAppState('main');
        // Fetch or create farmer profile
        const farmerDoc = await getDoc(doc(db, 'farmers', u.uid));
        if (farmerDoc.exists()) {
          setFarmer(farmerDoc.data() as Farmer);
        } else {
          const newFarmer: Farmer = {
            id: u.uid,
            name: u.displayName || "Farmer",
            county: selectionRef.current.county,
            town: selectionRef.current.town || "Rongo",
            gps_lat: -1.1234,
            gps_lng: 34.5678,
            crops: selectionRef.current.crops.length > 0 ? selectionRef.current.crops : ["Maize", "Beans"],
            farm_size_acres: 1.5,
            language_preference: 'sw',
            created_at: serverTimestamp(),
            last_active: serverTimestamp(),
          };
          await setDoc(doc(db, 'farmers', u.uid), newFarmer);
          setFarmer(newFarmer);
        }

        // Fetch field data
        const fieldDoc = await getDoc(doc(db, 'farmers', u.uid, 'field_data', 'current'));
        if (fieldDoc.exists()) {
          setFieldData(fieldDoc.data() as FieldData);
        } else {
          const defaultField: FieldData = {
            alu_acreage: 1.5,
            amed_detected_crop: "Maize",
            amed_crop_stage: "Vegetative",
            amed_sowing_date: "2026-03-15",
            amed_harvest_estimate: "2026-07-15",
            amed_ndvi: 0.62,
            amed_last_updated: serverTimestamp(),
          };
          await setDoc(doc(db, 'farmers', u.uid, 'field_data', 'current'), defaultField);
          setFieldData(defaultField);
        }

        // Fetch chat history
        const q = query(
          collection(db, 'farmers', u.uid, 'conversations'),
          orderBy('session_date', 'desc'),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const lastSession = querySnapshot.docs[0].data() as Conversation;
          setMessages(lastSession.messages);
        } else {
          const initialGreeting = `Habari ${u.displayName?.split(' ')[0] || 'Mkulima'}! Karibu sana — welcome to Zao. I can see your farm in ${selectionRef.current.county}. Our satellite data shows your 1.5 acres field is currently in vegetative stage. How can I help you today?`;
          setMessages([{ role: 'model', content: initialGreeting, timestamp: new Date().toISOString() }]);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Voice Recording Logic ---
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    clearInterval(recordingInterval.current);
    sendMessage("Simulated voice recording message from farmer...");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
      } else if (error.code === 'auth/cancelled-popup-request') {
        setLoginError("A login request is already in progress.");
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError("Login popup was blocked.");
      } else {
        setLoginError("Login failed. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- AI Logic ---
  const sendMessage = async (text: string) => {
    if (!text.trim() || !user) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const fieldContext = `
FARMER_LOCATION: ${farmer?.county}, ${farmer?.town}.
FARMER_NAME: ${farmer?.name}.
FIELD_DATA: {
  acreage: ${fieldData?.alu_acreage} acres,
  detected_crop: ${fieldData?.amed_detected_crop},
  crop_stage: ${fieldData?.amed_crop_stage},
  days_since_sowing: 21,
  estimated_harvest: ${fieldData?.amed_harvest_estimate},
  vegetation_health_ndvi: ${fieldData?.amed_ndvi},
}
SEASON: Long Rains 2026, Week 3 of planting season.
`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: fieldContext + "\n\n" + text }] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
      
      const responseText = result.text;
      const modelMsg: Message = { role: 'model', content: responseText, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, modelMsg]);

      await addDoc(collection(db, 'farmers', user.uid, 'conversations'), {
        messages: [...messages, userMsg, modelMsg],
        session_date: serverTimestamp(),
        topics_covered: ['general'],
      });

    } catch (error) {
      console.error("AI Error", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePhotoDiagnosis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setDiagnosisImage(base64);
      setIsDiagnosing(true);
      setDiagnosisResult(null);
      setActiveTab('diagnosis');

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const prompt = `You are a crop disease expert. Examine this photo and return a structured diagnosis in Swahili and English.
        
        Format:
        " Nimechunguza picha yako kwa makini. (I have carefully examined your photo.)
        Ugonjwa (Diagnosis): [Name — English & Swahili]
        Uhakika (Confidence): High / Medium / Low
        Kinachoendelea: [2 sentences, simple language]
        Matibabu (Treatment): [Product, exact dosage, application method]
        Gharama (Cost): KES [range] at [nearest town] agrovet
        Kinga (Prevention): [One practical tip]
        Organic Option: [Natural alternative]
        Emergency: KEPHIS FREE 0800 720 553`;

        const imagePart = {
          inlineData: {
            data: base64.split(',')[1],
            mimeType: file.type
          }
        };

        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }]
        });
        
        const responseText = result.text;
        setDiagnosisResult(responseText);

        await addDoc(collection(db, 'disease_reports'), {
          farmer_id: user.uid,
          county: farmer?.county || 'Migori',
          location_lat: farmer?.gps_lat || 0,
          location_lng: farmer?.gps_lng || 0,
          disease_identified: responseText.split('\n')[1].split(':')[1]?.trim() || 'Unknown',
          confidence: 'High',
          photo_url: 'simulated_url',
          timestamp: serverTimestamp(),
          verified: false
        });

      } catch (error) {
        console.error("Diagnosis Error", error);
      } finally {
        setIsDiagnosing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Render Sections ---

  const SplashScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-[#1A3C2A] to-[#2D6A4F] text-white"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-6"
      >
        <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-xl border border-white/20">
          <Sprout className="w-12 h-12 text-sun-gold" />
        </div>
      </motion.div>
      <motion.h1 
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-4xl font-bold font-display mb-2"
      >
        Zao
      </motion.h1>
      <motion.p 
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 0.7 }}
        transition={{ delay: 0.5 }}
        className="text-lg"
      >
        Zao: Mkulima wa Kisasa
      </motion.p>
      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 2, ease: "linear" }}
          className="h-full bg-green-light"
        />
      </div>
    </motion.div>
  );

  const OnboardingScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-bg-primary flex items-center justify-center p-6"
    >
      <div className="w-full max-w-[420px] space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-green-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-apple-md">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-display italic text-green-primary">Karibu!</h2>
          <p className="text-text-secondary">Select your location to get started</p>
        </div>

        <div className="apple-card space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">County</label>
            <div className="relative">
              <select 
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
                className="input appearance-none pr-10"
              >
                {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-primary rotate-90" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">Town / Village</label>
            <input 
              className="input" 
              placeholder="e.g. Rongo, Awendo..." 
              value={selectedTown}
              onChange={(e) => setSelectedTown(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-text-secondary">What crops do you grow?</p>
            <div className="flex flex-wrap gap-2">
              {['Maize', 'Beans', 'Potatoes', 'Kale', 'Coffee', 'Tea'].map(crop => (
                <button 
                  key={crop}
                  onClick={() => {
                    setSelectedCrops(prev => 
                      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
                    );
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                    selectedCrops.includes(crop) 
                      ? "bg-green-primary border-green-primary text-white" 
                      : "border-green-light text-green-primary hover:bg-green-pale"
                  )}
                >
                  {crop}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="btn-apple-primary w-full"
          >
            {isLoggingIn ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Ingia Shamba"}
            {!isLoggingIn && <ArrowRight className="w-5 h-5" />}
          </button>
          
          {loginError && <p className="text-center text-xs text-red-500">{loginError}</p>}
        </div>

        <p className="text-center text-[12px] text-text-tertiary">
          Zao · Powered by Google AI
        </p>
      </div>
    </motion.div>
  );

  const BottomNav = () => (
    <nav className="glass-nav h-[83px] flex items-center justify-around px-2">
      {[
        { id: 'home', icon: Sprout, label: 'Home' },
        { id: 'farm', icon: MapPin, label: 'My Farm' },
        { id: 'chat', icon: Mic, label: 'Chat' },
        { id: 'diagnosis', icon: Camera, label: 'Diagnose' },
        { id: 'profile', icon: User, label: 'Profile' },
      ].map(item => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id as any)}
          className="flex flex-col items-center gap-1 flex-1 relative"
        >
          <item.icon className={cn(
            "w-6 h-6 transition-colors",
            activeTab === item.id ? "text-green-primary" : "text-text-tertiary"
          )} />
          <span className={cn(
            "text-[10px] font-medium",
            activeTab === item.id ? "text-green-primary" : "text-text-tertiary"
          )}>
            {item.label}
          </span>
          {activeTab === item.id && (
            <motion.div 
              layoutId="nav-dot"
              className="absolute -bottom-1 w-1 h-1 bg-green-primary rounded-full"
            />
          )}
        </button>
      ))}
    </nav>
  );

  if (appState === 'splash') return <SplashScreen />;
  if (appState === 'onboarding' && !user) return <OnboardingScreen />;

  return (
    <div className="min-h-screen bg-bg-primary pb-[83px]">
      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 space-y-6 max-w-[480px] mx-auto"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {user?.displayName?.[0] || 'M'}
                </div>
                <div>
                  <h3 className="text-[15px] font-bold leading-none mb-1">{user?.displayName?.split(' ')[0] || 'Mkulima'}</h3>
                  <p className="text-[13px] text-text-secondary leading-none">{farmer?.town}, {farmer?.county}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="relative">
                  <Bell className="w-6 h-6 text-text-primary" />
                  <div className="absolute top-0 right-0 w-2 h-2 bg-green-light rounded-full border-2 border-bg-primary" />
                </button>
                <Settings className="w-6 h-6 text-text-primary" />
              </div>
            </div>

            {/* Hero Weather Card */}
            <div className="relative h-[200px] rounded-[24px] overflow-hidden shadow-apple-md bg-gradient-to-br from-[#4A9ECA] to-[#1D638F] p-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 opacity-80 text-[13px]">
                  <MapPin className="w-4 h-4" />
                  {farmer?.town}, {farmer?.county}
                </div>
                <Sun className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-[22px] font-display font-medium">Rain expected Thursday</h2>
                <p className="text-[14px] opacity-85">Prepare seedbed by Wednesday</p>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                <div className="flex gap-4">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} className={cn(
                      "flex flex-col items-center gap-1 p-1.5 rounded-full",
                      i === 3 ? "bg-white text-green-primary" : "bg-white/10"
                    )}>
                      <span className="text-[10px] font-bold">{d}</span>
                      {i === 3 ? <CloudRain className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Farm Health Card */}
            <div className="apple-card">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[13px] font-bold text-text-tertiary uppercase tracking-wide">Your Farm</span>
                <span className="text-[13px] text-text-secondary">1.5 acres · Maize</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100" />
                    <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={226} strokeDashoffset={226 * (1 - 0.62)} className="text-green-primary" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[18px] font-bold leading-none">62%</span>
                    <span className="text-[9px] text-text-tertiary">Health</span>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-green-primary" />
                    <span className="text-sm font-medium">Stage: Vegetative</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-primary w-[60%]" />
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                    <Calendar className="w-4 h-4" />
                    Est. Harvest: July 15
                  </div>
                </div>
              </div>
              <button className="w-full mt-6 text-green-primary text-[13px] font-bold flex items-center justify-center gap-1">
                View Full Field Report <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="space-y-4">
              <h2 className="text-[20px] font-display font-bold px-1">What do you need?</h2>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map(action => (
                  <button 
                    key={action.id}
                    onClick={() => action.id === 'diagnosis_upload' ? fileInputRef.current?.click() : setActiveTab(action.id as any)}
                    className={cn(
                      "apple-card p-4 h-[100px] flex flex-col justify-between items-start relative overflow-hidden group active:scale-[0.97]",
                      action.bg
                    )}
                  >
                    <action.icon className={cn("w-8 h-8", action.iconColor)} />
                    <span className="text-[14px] font-bold text-text-primary">{action.label}</span>
                    <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-text-tertiary opacity-50" />
                  </button>
                ))}
              </div>
            </div>

            {/* Market Pulse */}
            <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <div>
                  <h2 className="text-[17px] font-bold">Market Prices Today</h2>
                  <p className="text-[13px] text-text-secondary">{farmer?.county} · {farmer?.town}</p>
                </div>
                <button className="text-green-primary text-[13px] font-bold">See All</button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                {MARKET_PRICES.map((item, i) => (
                  <div key={i} className="apple-card p-3 min-w-[140px] flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xl">{item.icon}</span>
                      {item.trend === 'up' ? <TrendingUp className="w-4 h-4 text-green-primary" /> : <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold">{item.crop}</p>
                      <p className="text-[18px] font-bold text-green-primary">KES {item.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Alert */}
            <div className="rounded-[16px] bg-gradient-to-r from-[#E9C46A] to-[#F4A261] p-4 text-white flex items-center gap-4 shadow-apple-md">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-bold">Fall Armyworm Alert in {farmer?.county}</p>
                <p className="text-[12px] opacity-90">12 farms reported this week. Tap to learn more.</p>
              </div>
              <ChevronRight className="w-5 h-5 opacity-70" />
            </div>
          </motion.div>
        )}

        {activeTab === 'chat' && (
          <motion.div 
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 flex flex-col"
          >
            {/* Chat Header */}
            <header className="glass-header h-[88px] flex items-end px-4 pb-3">
              <div className="flex items-center justify-between w-full">
                <button onClick={() => setActiveTab('home')} className="p-2 -ml-2">
                  <ArrowLeft className="w-6 h-6 text-green-primary" />
                </button>
                <div className="text-center">
                  <h2 className="text-[17px] font-bold">Zao</h2>
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-green-light rounded-full" />
                    <span className="text-[11px] text-green-primary font-bold uppercase tracking-wide">Active</span>
                  </div>
                </div>
                <button className="p-2 -mr-2">
                  <Phone className="w-6 h-6 text-green-primary" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-bounce">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex flex-col max-w-[82%] animate-message-in",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}>
                  <div className="flex items-end gap-2">
                    {msg.role === 'model' && (
                      <div className="w-7 h-7 bg-green-primary rounded-full flex items-center justify-center flex-shrink-0 mb-1">
                        <Leaf className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "p-4 shadow-apple-sm",
                      msg.role === 'user' 
                        ? "bg-green-primary text-white asymmetric-bubble-user" 
                        : "bg-white text-text-primary border border-black/5 asymmetric-bubble-ai"
                    )}>
                      <div className={cn(
                        "text-[15px] leading-relaxed prose prose-sm max-w-none",
                        msg.role === 'user' ? "prose-invert" : ""
                      )}>
                        <Markdown>
                          {msg.content}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-text-tertiary mt-1 px-1">
                    {format(new Date(msg.timestamp), 'HH:mm')}
                  </span>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-1 p-3 bg-white rounded-full w-16 shadow-apple-sm border border-black/5">
                  <div className="w-1.5 h-1.5 bg-green-primary rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-green-primary rounded-full typing-dot [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-green-primary rounded-full typing-dot [animation-delay:0.4s]" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="bg-white border-t border-black/5 p-4 pb-safe">
              {/* Quick Replies */}
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {['Bei ya soko?', 'Dawa gani?', 'Kalenda ya kupanda', 'Piga picha'].map(tip => (
                  <button 
                    key={tip}
                    onClick={() => sendMessage(tip)}
                    className="px-4 py-2 rounded-full border border-green-light text-green-primary text-[13px] font-medium whitespace-nowrap active:scale-95"
                  >
                    {tip}
                  </button>
                ))}
              </div>

              <div className={cn(
                "flex items-center gap-3 transition-all duration-300",
                isRecording ? "bg-green-pale p-2 rounded-[22px]" : ""
              )}>
                {!isRecording && (
                  <button className="p-2 text-text-tertiary">
                    <Paperclip className="w-6 h-6" />
                  </button>
                )}
                
                <div className="flex-1 relative">
                  {isRecording ? (
                    <div className="flex items-center gap-3 px-4 h-[44px]">
                      <div className="flex gap-1 items-center flex-1">
                        <div className="w-1 h-4 bg-green-primary rounded-full animate-pulse" />
                        <div className="w-1 h-6 bg-green-primary rounded-full animate-pulse [animation-delay:0.2s]" />
                        <div className="w-1 h-3 bg-green-primary rounded-full animate-pulse [animation-delay:0.4s]" />
                        <span className="text-green-primary font-bold ml-2 animate-pulse">Sikiliza...</span>
                      </div>
                      <span className="text-text-secondary font-mono text-sm">{formatTime(recordingTime)}</span>
                    </div>
                  ) : (
                    <input 
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                      placeholder="Uliza swali lolote..."
                      className="w-full bg-bg-primary rounded-[22px] px-4 py-2.5 text-[15px] focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-light transition-all"
                    />
                  )}
                </div>

                <button 
                  onClick={() => {
                    if (input.trim()) sendMessage(input);
                    else if (isRecording) stopRecording();
                    else startRecording();
                  }}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                    isRecording ? "bg-red-500 text-white" : "bg-green-primary text-white"
                  )}
                >
                  {input.trim() ? <Send className="w-5 h-5" /> : isRecording ? <X className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'market' && (
          <motion.div 
            key="market"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 bg-bg-primary z-50 flex flex-col"
          >
            <header className="p-4 flex items-center justify-between sticky top-0 bg-bg-primary/80 backdrop-blur-md z-10">
              <button onClick={() => setActiveTab('home')} className="p-2">
                <ArrowLeft className="w-6 h-6 text-green-primary" />
              </button>
              <h2 className="text-[17px] font-bold">Market Pulse</h2>
              <div className="w-10" />
            </header>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="apple-card bg-green-primary text-white p-6 space-y-2">
                <p className="text-sm opacity-80">Average Price Index</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-4xl font-display font-bold">KES 4,200</h3>
                  <span className="text-green-light font-bold mb-1 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" /> +4.2%
                  </span>
                </div>
                <p className="text-[12px] opacity-70">Updated 2 hours ago from {farmer?.county} Main Market</p>
              </div>
              
              <div className="space-y-3">
                {MARKET_PRICES.map((item, i) => (
                  <div key={i} className="apple-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-bg-primary rounded-2xl flex items-center justify-center text-2xl">
                        {item.icon}
                      </div>
                      <div>
                        <p className="font-bold">{item.crop}</p>
                        <p className="text-[12px] text-text-secondary">90kg Bag</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">KES {item.price}</p>
                      <p className={cn(
                        "text-[12px] font-bold flex items-center justify-end",
                        item.trend === 'up' ? "text-green-primary" : "text-red-500"
                      )}>
                        {item.trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
                        {item.trend === 'up' ? '+150' : '-200'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 bg-sun-gold/10 rounded-[20px] border border-sun-gold/20 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-sun-gold shrink-0" />
                <p className="text-[13px] text-earth-brown leading-relaxed">
                  <strong>Price Alert:</strong> Beans are expected to peak in 2 weeks. Consider holding stock for better margins.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'calendar' && (
          <motion.div 
            key="calendar"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 bg-bg-primary z-50 flex flex-col"
          >
            <header className="p-4 flex items-center justify-between sticky top-0 bg-bg-primary/80 backdrop-blur-md z-10">
              <button onClick={() => setActiveTab('home')} className="p-2">
                <ArrowLeft className="w-6 h-6 text-green-primary" />
              </button>
              <h2 className="text-[17px] font-bold">Planting Calendar</h2>
              <div className="w-10" />
            </header>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Maize', 'Beans', 'Kale', 'Potatoes'].map(c => (
                  <button key={c} className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap",
                    c === 'Maize' ? "bg-green-primary text-white" : "bg-white text-text-secondary border border-black/5"
                  )}>
                    {c}
                  </button>
                ))}
              </div>
              
              <div className="space-y-4">
                {PLANTING_CALENDAR.map((item, i) => (
                  <div key={i} className={cn(
                    "apple-card flex gap-4 p-4",
                    item.month === format(new Date(), 'MMM') ? "border-2 border-green-light bg-green-pale/30" : ""
                  )}>
                    <div className="w-14 flex flex-col items-center justify-center border-r border-black/5 pr-4">
                      <span className="text-sm font-bold text-green-primary">{item.month}</span>
                      {item.month === format(new Date(), 'MMM') && <span className="text-[10px] font-bold text-green-primary uppercase">Now</span>}
                    </div>
                    <p className="flex-1 text-[14px] leading-relaxed text-text-secondary">
                      {item.task}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profit' && (
          <motion.div 
            key="profit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 bg-bg-primary z-50 flex flex-col"
          >
            <header className="p-4 flex items-center justify-between sticky top-0 bg-bg-primary/80 backdrop-blur-md z-10">
              <button onClick={() => setActiveTab('home')} className="p-2">
                <ArrowLeft className="w-6 h-6 text-green-primary" />
              </button>
              <h2 className="text-[17px] font-bold">Profit Calculator</h2>
              <div className="w-10" />
            </header>
            <div className="p-5 space-y-6 overflow-y-auto">
              <div className="apple-card p-6 text-center space-y-2">
                <p className="text-sm text-text-tertiary font-bold uppercase tracking-wider">Estimated Profit</p>
                <h3 className="text-4xl font-display font-bold text-green-primary">KES 142,500</h3>
                <p className="text-[12px] text-text-secondary">Based on 1.5 acres of Maize</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-text-tertiary uppercase px-1">Input Costs</h4>
                <div className="apple-card space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Seeds (3 bags)</span>
                    <span className="font-bold">KES 12,000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Fertilizer (DAP/CAN)</span>
                    <span className="font-bold">KES 24,500</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Labor (Prep/Weeding)</span>
                    <span className="font-bold">KES 18,000</span>
                  </div>
                  <div className="pt-4 border-t border-black/5 flex justify-between items-center">
                    <span className="font-bold">Total Costs</span>
                    <span className="font-bold text-red-500">KES 54,500</span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-text-tertiary uppercase px-1">Expected Revenue</h4>
                <div className="apple-card space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Yield (45 bags)</span>
                    <span className="font-bold">KES 197,000</span>
                  </div>
                  <div className="pt-4 border-t border-black/5 flex justify-between items-center">
                    <span className="font-bold">Net Profit</span>
                    <span className="font-bold text-green-primary">KES 142,500</span>
                  </div>
                </div>
              </div>

              <button className="btn-apple-primary w-full">Update My Data</button>
            </div>
          </motion.div>
        )}

        {activeTab === 'diagnosis' && (
          <motion.div 
            key="diagnosis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg-primary z-50 flex flex-col overflow-y-auto"
          >
            <header className="p-4 flex items-center justify-between sticky top-0 bg-bg-primary/80 backdrop-blur-md z-10">
              <button onClick={() => setActiveTab('home')} className="p-2">
                <ArrowLeft className="w-6 h-6 text-green-primary" />
              </button>
              <h2 className="text-[17px] font-bold">Photo Diagnosis</h2>
              <div className="w-10" />
            </header>

            <div className="p-6 space-y-8 flex-1 flex flex-col items-center justify-center max-w-[480px] mx-auto w-full">
              {!diagnosisImage ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="apple-card w-full p-8 text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-green-pale rounded-full flex items-center justify-center mx-auto">
                    <Camera className="w-10 h-10 text-green-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-display font-bold">Piga Picha ya Mmea</h3>
                    <p className="text-text-secondary text-sm">Take a clear photo of the affected leaf, stem, or crop</p>
                  </div>
                  <div className="space-y-3">
                    <button onClick={() => fileInputRef.current?.click()} className="btn-apple-primary w-full">
                      <Camera className="w-5 h-5" /> Take Photo
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="btn-apple-secondary w-full">
                      Upload from Gallery
                    </button>
                  </div>
                  <p className="text-[12px] text-text-tertiary italic">Tip: Get closer — fill the frame with the affected area</p>
                </motion.div>
              ) : (
                <div className="w-full space-y-6">
                  <div className="relative aspect-[4/3] rounded-[24px] overflow-hidden shadow-apple-lg bg-black">
                    <img src={diagnosisImage} className="w-full h-full object-cover" alt="Crop" />
                    {isDiagnosing && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
                        <div className="relative mb-6">
                          <div className="w-16 h-16 border-4 border-green-light rounded-full animate-ping absolute inset-0" />
                          <div className="w-16 h-16 border-4 border-green-light rounded-full flex items-center justify-center relative bg-green-primary/20">
                            <Search className="w-8 h-8 text-green-light" />
                          </div>
                        </div>
                        <h3 className="text-xl font-display font-bold mb-2">Inachunguza...</h3>
                        <p className="text-sm opacity-80">Google Vision AI is examining your crop</p>
                      </div>
                    )}
                  </div>

                  {diagnosisResult && (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="apple-card p-0 overflow-hidden"
                    >
                      <div className="bg-green-primary p-4 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-bold">Diagnosis Complete</span>
                        </div>
                        <span className="bg-white text-green-primary text-[10px] font-bold px-2 py-1 rounded-full uppercase">High Confidence</span>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="markdown-body">
                          <Markdown>{diagnosisResult}</Markdown>
                        </div>
                        <div className="pt-4 border-t border-black/5 flex gap-3">
                          <button onClick={() => setActiveTab('chat')} className="btn-apple-primary flex-1 h-10 text-sm">Chat with Zao</button>
                          <button className="btn-apple-secondary flex-1 h-10 text-sm">Find Agrovet</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  <button onClick={() => setDiagnosisImage(null)} className="w-full text-text-tertiary text-sm font-bold">Retake Photo</button>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoDiagnosis} />
          </motion.div>
        )}

        {activeTab === 'farm' && (
          <motion.div 
            key="farm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 space-y-6 max-w-[480px] mx-auto"
          >
            <h2 className="text-3xl font-display font-bold px-1">My Farm</h2>
            
            {/* Map Section */}
            <div className="relative h-[220px] rounded-[24px] overflow-hidden shadow-apple-md bg-gray-200">
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/farm-map/800/600')] bg-cover bg-center opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 border-2 border-green-light bg-green-light/20 rounded-[20px] flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-primary rounded-full animate-ping" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-apple-sm text-[12px] font-bold flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-primary" />
                1.5 acres · Maize
              </div>
              <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-white text-[10px] font-medium">
                Updated 3 days ago
              </div>
            </div>

            {/* Health Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="apple-card p-3 flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-full border-4 border-green-pale flex items-center justify-center text-[13px] font-bold text-green-primary">62%</div>
                <span className="text-[10px] text-text-tertiary font-bold uppercase">NDVI</span>
              </div>
              <div className="apple-card p-3 flex flex-col items-center text-center gap-2">
                <span className="text-2xl font-display font-bold text-earth-brown">47</span>
                <span className="text-[10px] text-text-tertiary font-bold uppercase">Days Left</span>
              </div>
              <div className="apple-card p-3 flex flex-col items-center text-center gap-2">
                <Activity className="w-6 h-6 text-green-primary" />
                <span className="text-[10px] text-text-tertiary font-bold uppercase">Growing</span>
              </div>
            </div>

            {/* Field History */}
            <div className="apple-card">
              <h3 className="text-[17px] font-bold mb-4">Field History</h3>
              <div className="space-y-4">
                {[
                  { season: '2026 Long Rains', crop: 'Maize', status: 'In Progress', color: 'bg-green-light' },
                  { season: '2025 Short Rains', crop: 'Beans', status: '22 bags/acre', color: 'bg-green-primary' },
                  { season: '2025 Long Rains', crop: 'Maize', status: '18 bags/acre', color: 'bg-green-primary' },
                  { season: '2024 Short Rains', crop: 'Maize', status: 'Low yield', color: 'bg-red-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <div className="flex-1">
                      <p className="text-[14px] font-bold">{item.season}</p>
                      <p className="text-[12px] text-text-secondary">{item.crop}</p>
                    </div>
                    <span className="text-[12px] font-medium text-text-secondary">{item.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-green-pale rounded-[16px] flex items-start gap-3">
                <Info className="w-5 h-5 text-green-primary mt-0.5" />
                <p className="text-[13px] text-green-primary leading-relaxed">
                  3 consecutive maize seasons detected. Consider bean rotation to restore nitrogen.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 space-y-6 max-w-[480px] mx-auto"
          >
            <h2 className="text-3xl font-display font-bold px-1">Profile</h2>
            <div className="apple-card flex flex-col items-center py-8 gap-4">
              <div className="w-24 h-24 bg-green-primary rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {user?.displayName?.[0] || 'M'}
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">{user?.displayName}</h3>
                <p className="text-text-secondary">{user?.email}</p>
              </div>
              <button onClick={handleLogout} className="mt-4 text-red-500 font-bold text-sm">Sign Out</button>
            </div>

            <div className="apple-card space-y-4">
              <h3 className="font-bold">Farm Settings</h3>
              <div className="flex justify-between items-center py-2 border-b border-black/5">
                <span className="text-sm">Language</span>
                <span className="text-sm text-green-primary font-bold">Kiswahili</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-black/5">
                <span className="text-sm">Voice Mode</span>
                <span className="text-sm text-green-primary font-bold">Enabled</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Notifications</span>
                <span className="text-sm text-green-primary font-bold">On</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};

const Root = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default Root;
