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
  const [previewDoc, setPreviewDoc] = useState<{title: string, citation: string, docId?: string} | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [complete, setComplete] = useState(false);
  const [sources, setSources] = useState<Array<{ id: string; title: string; summary: string; score: number; docId?: string }>>([]);
  const [docTitleMap, setDocTitleMap] = useState<Record<string, string>>({});

  const ensureDocTitleMap = async () => {
    if (Object.keys(docTitleMap).length > 0) return docTitleMap;
    try {
      const res = await fetch('/api/v1/knowledge/documents?page=1&pageSize=100&includeHidden=true');
      if (!res.ok) return {};
      const data = await res.json();
      const map: Record<string, string> = {};
      (data.items || []).forEach((item: any) => {
        if (item.docId) {
          map[item.docId] = item.displayName || item.originalFilename || item.docId;
        }
      });
      setDocTitleMap(map);
      return map;
    } catch {
      return {};
    }
  };

  const handleSearch = async (q: string, useRerank: boolean) => {
    setQuery(q);
    setView('result');
    setLoading(true);
    setAnswer('');
    setComplete(false);
    setSources([]);
    try {
      const res = await fetch('/api/v1/qa/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, topK: 6, useRerank })
      });
      if (!res.ok) throw new Error('检索失败');
      const data = await res.json();
      const results = data?.sources || [];
      const titleMap = await ensureDocTitleMap();

      const builtSources = results.map((item: any, idx: number) => ({
        id: item.chunkIds?.[0] || `${item.docId || 'doc'}_${idx}`,
        docId: item.docId,
        title: titleMap[item.docId] || item.source || item.docId || '未知文档',
        summary: item.content || '',
        score: typeof item.score === 'number' ? item.score : 0
      }));
      setSources(builtSources);

      const answerText = data?.answer || '未生成有效答案。';
      setAnswer(answerText);
      setComplete(true);
    } catch (e) {
      setAnswer('检索失败，请稍后重试。');
      setComplete(true);
    } finally {
      setLoading(false);
    }
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
                      onOpenPreview={(docId, title, citation) => setPreviewDoc({ docId, title, citation })}
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
               <Documents onOpenPreview={(docId, title) => setPreviewDoc({ docId, title, citation: '' })} />
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
        docId={previewDoc?.docId}
      />
    </div>
  );
}

export default App;
