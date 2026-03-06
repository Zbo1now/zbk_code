import React, { useState } from 'react';
import { Search, Sparkles, Send, Paperclip, Settings2, Zap, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HeroInputProps {
  onSearch: (query: string, useRerank: boolean) => void;
  className?: string;
}

const HeroInput: React.FC<HeroInputProps> = ({ onSearch, className }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [useRerank, setUseRerank] = useState(true);

  // Suggested questions for nice UX
  const suggestions = [
    "压铸模具热处理",
    "汽车发动机散热器材料",
    "铝合金压铸技术",
    "3D打印与铸造结合"
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative w-full max-w-3xl mx-auto ${className}`}
    >
      {/* Floating Functions (Moved Out) */}
      <div className="absolute -top-8 right-0 z-20 flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setUseRerank((prev) => !prev);
          }}
          className="group flex items-center gap-2 px-2 py-1 transition-all cursor-pointer select-none hover:bg-slate-100/50 rounded-full"
        >
          <span className="text-[10px] font-bold tracking-widest uppercase transition-colors text-slate-500 group-hover:text-slate-600">
            AI Rerank
          </span>
          <div className={`relative w-8 h-4 rounded-full transition-all duration-300 ${useRerank ? 'bg-slate-600 shadow-inner' : 'bg-slate-200'}`}>
            <div className={`absolute top-0.5 left-0.5 w-[14px] h-[12px] bg-white rounded-full shadow-sm transition-all duration-300 ${useRerank ? 'translate-x-3.5' : 'translate-x-0'}`} />
          </div>
        </button>
      </div>

      {/* Glow Effect */}
      <div className={`pointer-events-none absolute -inset-1 bg-gradient-to-r from-blue-300 via-purple-300 to-indigo-300 rounded-2xl blur-xl opacity-20 transition-opacity duration-500 ${isFocused ? 'opacity-50 scale-105' : ''}`}></div>

      {/* Input Container */}
      <div 
        className={`relative z-10 flex items-center bg-white/80 backdrop-blur-xl border border-blue-100/50 shadow-2xl rounded-2xl transition-all duration-300 overflow-visible ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}
      >
        {/* Animated Icon */}
        <div className="pl-5 text-slate-400">
          <AnimatePresence mode="wait">
            {isFocused ? (
              <motion.div 
                key="sparkles"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
              >
                <Sparkles size={22} className="text-blue-500" />
              </motion.div>
            ) : (
              <motion.div 
                key="search"
                initial={{ scale: 0, rotate: 45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: -45 }}
              >
                <Search size={22} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Field */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) onSearch(query, useRerank);
          }}
          placeholder="请输入工业技术问题，例如：模具热处理工艺..."
          className="w-full bg-transparent px-4 py-5 text-lg text-slate-800 placeholder-slate-400 focus:outline-none placeholder:text-base font-medium"
        />

        {/* Right Actions */}
        <div className="pr-3 flex items-center gap-1">
          {/* Upload Button */}
          <button 
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors tooltip hover:text-blue-500"
            title="上传文档"
          >
            <Paperclip size={20} />
          </button>
          
          {/* Divider */}
          <div className="h-6 w-px bg-slate-200 mx-1"></div>

          {/* Send Button */}
          <button 
            onClick={() => query.trim() && onSearch(query, useRerank)}
            className={`p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
              query.trim() 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            disabled={!query.trim()}
          >
            <Send size={18} className={query.trim() ? "translate-x-0.5 translate-y-0.5" : ""} />
          </button>
        </div>
      </div>

      {/* Decorative Technical Markers */}
      <div className="absolute -left-8 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-1 opacity-20">
         <div className="w-2 h-2 rounded-full border border-slate-900"></div>
         <div className="w-px h-12 bg-slate-900 mx-auto"></div>
         <div className="w-2 h-2 rounded-full border border-slate-900"></div>
      </div>

      {/* Quick Suggestions */}
      <AnimatePresence>
        {(isFocused || query.length === 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-wrap gap-2 mt-4 ml-2"
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => { setQuery(suggestion); onSearch(suggestion, useRerank); }}
                className="px-3 py-1.5 bg-white/40 border border-slate-200/50 rounded-lg text-xs font-medium text-slate-500 hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300"
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HeroInput;
