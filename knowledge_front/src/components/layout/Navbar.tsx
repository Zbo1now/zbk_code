import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, KeyRound, Library, LogOut, ShieldCheck, User, Workflow } from 'lucide-react';
import type { AuthUser } from '../../utils/auth';

interface NavbarProps {
  onNavigate: (view: 'home' | 'result' | 'documents' | 'processing' | 'admin' | 'roles') => void;
  activeView: string;
  currentUser: AuthUser | null;
  onLogout: () => void;
}

const roleLabelMap: Record<string, string> = {
  ADMIN: '管理员',
  USER: '普通用户',
};

const sanitizeDisplayName = (user: AuthUser | null) => {
  if (!user) return '未登录';
  const name = (user.displayName || '').trim();
  if (!name || /^\?+$/.test(name)) {
    return user.username;
  }
  return name;
};

const formatRoleLabel = (role: string) => roleLabelMap[role] || role;

const Navbar: React.FC<NavbarProps> = ({ onNavigate, activeView, currentUser, onLogout }) => {
  const isAdmin = !!currentUser?.roles.includes('ADMIN');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6">
      <div className="group flex cursor-pointer items-center gap-2" onClick={() => onNavigate('home')}>
        <div className="rounded-xl bg-blue-600 p-2 text-white shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110">
          <Bot size={24} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-xl font-bold text-transparent">
            铸见
          </span>
          <span className="text-[10px] text-slate-400">让工业知识在需要的时候真正可用</span>
        </div>
      </div>

      <div className="flex gap-1 rounded-full border border-white/50 bg-slate-100/50 p-1 backdrop-blur-sm">
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
            active={activeView === 'roles'}
            label="角色管理"
            onClick={() => onNavigate('roles')}
            icon={<KeyRound size={14} />}
          />
        )}
        {isAdmin && (
          <NavButton
            active={activeView === 'admin'}
            label="系统管理"
            onClick={() => onNavigate('admin')}
            icon={<ShieldCheck size={14} />}
          />
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur transition hover:bg-white"
        >
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-700">{sanitizeDisplayName(currentUser)}</span>
            <span className="text-[10px] text-slate-400">{currentUser?.username}</span>
          </div>
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-white ring-2 ring-white shadow-lg ${
              isAdmin ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'
            }`}
          >
            <User size={18} />
          </div>
          <ChevronDown size={14} className={`text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/60">
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <div className="text-sm font-semibold text-slate-800">{sanitizeDisplayName(currentUser)}</div>
              <div className="mt-1 text-xs text-slate-500">{currentUser?.username}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(currentUser?.roles || []).map((role) => (
                  <span key={role} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-600">
                    {formatRoleLabel(role)}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              退出登录
            </button>
          </div>
        )}
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
    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
      active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/40 hover:text-slate-700'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default Navbar;
