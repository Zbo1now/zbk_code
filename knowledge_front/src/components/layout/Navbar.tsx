import React from 'react';
import { Bot, Layers, User, Settings } from 'lucide-react';

interface NavbarProps {
  onNavigate: (view: 'home' | 'result' | 'upload') => void;
  activeView: string;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, activeView }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 glass-nav flex items-center justify-between px-6 z-50">
      {/* Logo Area */}
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => onNavigate('home')}
      >
        <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
          <Bot size={24} />
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
          Knowledge RAG
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100/50 p-1 rounded-full border border-white/50 backdrop-blur-sm">
        <button
          onClick={() => onNavigate('home')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            activeView === 'home' || activeView === 'result'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          从这里开始
        </button>
        <button
          onClick={() => onNavigate('upload')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
            activeView === 'upload'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers size={14} />
          知识库管理
        </button>
      </div>

      {/* User Area */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <Settings size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white shadow-lg">
          <User size={16} />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
