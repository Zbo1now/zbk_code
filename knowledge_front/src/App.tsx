import React, { useState } from 'react';
import Navbar from './components/layout/Navbar';
import HeroInput from './components/search/HeroInput';
import AIPanel from './components/results/AIPanel';
import SourceBar from './components/results/SourceBar';
import Documents from './components/documents/Documents';
import AdminDashboard from './components/admin/AdminDashboard';
import FilePreviewDrawer from './components/layout/FilePreviewDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, FolderUp } from 'lucide-react';

function App() {
  const [view, setView] = useState<'home' | 'result' | 'documents' | 'admin'>('home');
  const [isAdmin, setIsAdmin] = useState(true); // Role State
  const [previewDoc, setPreviewDoc] = useState<{title: string, citation: string} | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [complete, setComplete] = useState(false);

  // Mock Sources
  const sources = [
    { id: '1', title: '10bar真空高压气淬炉在压铸模具热处理中的应用', summary: '...', score: 0.92 },
    { id: '2', title: '3D打印省去了砂型铸造过程中的繁琐工作', summary: '...', score: 0.85 },
    { id: '3', title: '大型铜合金螺旋桨铸造工艺介绍', summary: '...', score: 0.78 },
    { id: '4', title: '铝合金压铸件的表面处理方法', summary: '...', score: 0.75 },
    { id: '5', title: '精密铸造用无尘包埋料的制备及应用', summary: '...', score: 0.60 },
  ];

  const handleSearch = (q: string, useRerank: boolean) => {
    setQuery(q);
    setView('result');
    setLoading(true);
    setAnswer('');
    setComplete(false);

    // Simulate API delay and streaming
    setTimeout(() => {
      setLoading(false);
      const modeText = useRerank ? '（已启用AI精排优化）' : '（基础检索模式）';
      setAnswer(`针对 **${q}** 的问题 ${modeText}，根据现有文档库分析如下：\n\n` +  
      '压铸模具的热处理是保证模具寿命和铸件质量的关键环节。根据《10bar真空高压气淬炉在压铸模具热处理中的应用》[1]，采用高压气淬技术可以有效控制模具变形，提高表面硬度。\n\n' +
      '此外，3D打印技术在铸造领域的应用也日益广泛。它不仅缩短了加工周期，还减少了砂型铸造的繁琐工序[2]。对于铝合金压铸件，表面处理如氧化、喷涂等也是提升耐腐蚀性的重要手段[4]。\n\n' +
      '综上所述，结合先进的热处理设备与新型制造工艺（如3D打印），是提升铸造产业竞争力的重要方向。');
      setComplete(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-slate-900 bg-[#f0f2f5]">
      {/* L1: Ambient Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         {/* Industrial Grid Lines */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
         
         {/* CAD / Engineering Decorative Elements */}
         <svg className="absolute top-20 right-[-10%] w-[600px] h-[600px] opacity-[0.03] text-slate-800 rotate-12" viewBox="0 0 100 100">
           <path fill="currentColor" d="M50 0 L100 100 L0 100 Z" />
           <circle cx="50" cy="60" r="20" stroke="currentColor" strokeWidth="1" fill="none" />
           <rect x="25" y="40" width="50" height="40" stroke="currentColor" strokeWidth="1" fill="none" />
           <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" />
           <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.5" />
         </svg>

         <svg className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] opacity-[0.04] text-blue-900" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="10 5" />
            <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5" fill="none" />
            <path d="M100 20 L100 180 M20 100 L180 100" stroke="currentColor" strokeWidth="0.5" />
         </svg>

        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[35%] h-[40%] bg-blue-200/40 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>
      </div>

      {/* L2: Layout Shell */}
      <Navbar 
        onNavigate={setView} 
        activeView={view} 
        isAdmin={isAdmin}
        onToggleRole={() => {
          setIsAdmin(!isAdmin);
          // If switching to normal user while in admin view, redirect home
          if (view === 'admin' && isAdmin) setView('home'); 
        }}
      />

      <motion.main 
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-64px)] flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        
        {/* L3: Content Views */}
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center flex-grow py-20"
            >
              <div className="text-center mb-12">
                <h1 className="text-5xl font-extrabold mb-6 tracking-tight">
                  <span className="text-slate-800">智慧检索，</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">洞见非凡</span>
                </h1>
                <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                  基于 RAG 技术的下一代工业知识问答引擎。<br/>
                  融合文档解析、语义检索与大模型推理，为您提供精准可靠的专业解答。
                </p>
              </div>

              <HeroInput onSearch={handleSearch} />
            </motion.div>
          )}

          {view === 'result' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-5xl mx-auto space-y-6 pb-20"
            >
              {/* Compact Search Bar Header */}
              <div className="flex items-center gap-4 mb-4">
                 <button 
                   onClick={() => setView('home')}
                   className="p-2 rounded-full hover:bg-white/50 text-slate-500 transition-colors"
                   title="返回首页"
                 >
                   <ArrowLeft size={24} />
                 </button>
                 <div className="text-2xl font-bold text-slate-800 truncate">{query}</div>
              </div>

              <div className="space-y-6">
                <AIPanel answer={answer} loading={loading} complete={complete} />
                
                {complete && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <SourceBar 
                      sources={sources} 
                      onOpenPreview={(title, citation) => setPreviewDoc({ title, citation })}
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'documents' && (
             <motion.div 
               key="documents"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               transition={{ duration: 0.3 }}
               className="w-full"
             >
               <Documents onOpenPreview={(title) => setPreviewDoc({ title, citation: '' })} />
             </motion.div>
          )}

          {view === 'admin' && (
             <motion.div 
               key="admin"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               transition={{ duration: 0.3 }}
               className="w-full"
             >
               <AdminDashboard />
             </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Global File Preview Drawer */}
      <FilePreviewDrawer 
        isOpen={!!previewDoc} 
        onClose={() => setPreviewDoc(null)}
        fileTitle={previewDoc?.title || ''}
        citationText={previewDoc?.citation}
      />
    </div>
  );
}

export default App;
