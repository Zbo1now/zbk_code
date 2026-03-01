import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, CheckCircle2, Copy } from 'lucide-react';

interface AIPanelProps {
  answer: string;
  loading: boolean;
  complete: boolean;
}

const AIPanel: React.FC<AIPanelProps> = ({ answer, loading, complete }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  // Clean effect if answer changes completely
  useEffect(() => {
    if (loading) {
      setDisplayedText('');
    } else if (complete) {
      setDisplayedText(answer); // Show full text if complete
    } else {
        // Typing simulation if streaming (but here mock just changes full text likely)
        // If 'answer' grows over time, setDisplayedText(answer) is enough for "typing"
        // But if 'answer' is full string provided at once, simulate typing:
        let i = 0;
        const interval = setInterval(() => {
          setDisplayedText(prev => {
            if (i < answer.length) {
              i++;
              return answer.substring(0, i);
            }
            clearInterval(interval);
            return prev;
          });
        }, 30); // Speed
        return () => clearInterval(interval);
    }
  }, [answer, loading, complete]);

  // Actual logic: If answer is streaming from parent, handled there. 
  // If static mock provided, simulate typing.
  // We'll rely on parent passing incrementally or simple effect.
  // For this demo, let's assume 'answer' is the FULL text and we type it out.
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 md:p-8 relative overflow-hidden group"
    >
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/50 to-purple-100/30 rounded-bl-full pointer-events-none -mr-16 -mt-16"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 shadow-sm ring-1 ring-blue-200">
          <Lightbulb size={20} className={loading ? "animate-pulse" : ""} />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">
          {loading ? "AI 正在思考..." : "智能综述"}
        </h2>
        
        {!loading && (
          <div className="ml-auto flex gap-2">
            <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
              <Copy size={16} />
            </button>
            <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <CheckCircle2 size={12} />
              已完成
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="prose prose-slate prose-lg max-w-none relative z-10 min-h-[200px]">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-600 leading-relaxed whitespace-pre-wrap"
            >
              {displayedText}
              <motion.span 
                animate={{ opacity: [0, 1, 0] }} 
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="inline-block w-2 h-4 bg-blue-500 ml-1 align-middle"
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Citations Footer (Mock) */}
      {!loading && (
        <div className="mt-8 pt-6 border-t border-slate-100 flex gap-2 flex-wrap text-sm text-slate-500">
          <span className="font-medium mr-2">参考来源:</span>
          {[1, 2, 3].map(i => (
            <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
              [{i}] 文档预览_{i}.pdf
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AIPanel;
