import React from 'react';
import { Bot, Library, RefreshCcw, ShieldCheck, User, Workflow } from 'lucide-react';

interface NavbarProps {
  onNavigate: (view: 'home' | 'result' | 'documents' | 'processing' | 'admin') => void;
  activeView: string;
  isAdmin: boolean;
  onToggleRole: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, activeView, isAdmin, onToggleRole }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 glass-nav flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-2 cursor-pointer group" onClick={() => onNavigate('home')}>
        <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
          <Bot size={24} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
            铸见
          </span>
          <span className="text-[10px] text-slate-400">让每一份工业文档，都能在关键时刻开口说话</span>
        </div>
      </div>

      <div className="flex bg-slate-100/50 p-1 rounded-full border border-white/50 backdrop-blur-sm gap-1">
        <NavButton
          active={activeView === 'home' || activeView === 'result'}
          label="智能问答"
          onClick={() => onNavigate('home')}
          icon={<Bot size={14} />}
        />
        <NavButton
          active={activeView === 'documents'}
          label="文档中心"
          onClick={() => onNavigate('documents')}
          icon={<Library size={14} />}
        />
        <NavButton
          active={activeView === 'processing'}
          label="文档处理"
          onClick={() => onNavigate('processing')}
          icon={<Workflow size={14} />}
        />
        {isAdmin && (
          <NavButton
            active={activeView === 'admin'}
            label="系统管理"
            onClick={() => onNavigate('admin')}
            icon={<ShieldCheck size={14} />}
          />
        )}
      </div>

      <div
        className="flex items-center gap-4 cursor-pointer group"
        onClick={onToggleRole}
        title="点击切换角色 (演示功能)"
      >
        <div className="flex flex-col items-end mr-2">
          <span className="text-xs font-bold text-slate-700">{isAdmin ? 'Admin User' : 'Normal User'}</span>
          <div className="flex items-center gap-1">
            <span
              className={`text-[10px] px-1.5 rounded border ${
                isAdmin
                  ? 'text-blue-500 bg-blue-50 border-blue-100'
                  : 'text-slate-500 bg-slate-50 border-slate-100'
              }`}
            >
              {isAdmin ? '管理员' : '普通用户'}
            </span>
            <RefreshCcw size={10} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
        </div>
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-lg transition-transform group-hover:scale-105 ${
            isAdmin
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
              : 'bg-gradient-to-br from-slate-400 to-slate-500'
          }`}
        >
          <User size={18} />
        </div>
      </div>
    </nav>
  );
};

const NavButton = ({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
      active ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default Navbar;
