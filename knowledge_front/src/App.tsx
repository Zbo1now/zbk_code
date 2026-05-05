import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, User } from 'lucide-react';
import Navbar from './components/layout/Navbar';
import HeroInput from './components/search/HeroInput';
import AIPanel from './components/results/AIPanel';
import SourceBar from './components/results/SourceBar';
import Documents from './components/documents/Documents';
import ProcessingCenter from './components/processing/ProcessingCenter';
import AdminDashboard from './components/admin/AdminDashboard';
import RoleManagementCenter from './components/roles/RoleManagementCenter';
import FilePreviewDrawer from './components/layout/FilePreviewDrawer';
import {
  authFetch,
  clearAccessToken,
  getAccessToken,
  hasPermission,
  isAdminUser,
  setAccessToken,
  type AuthUser,
} from './utils/auth';

type View = 'home' | 'result' | 'documents' | 'processing' | 'admin' | 'roles';
type AuthMode = 'login' | 'register';

function App() {
  const [view, setView] = useState<View>(() => {
    try {
      const saved = window.localStorage.getItem('czj_view');
      if (saved === 'home' || saved === 'result' || saved === 'documents' || saved === 'processing' || saved === 'admin' || saved === 'roles') {
        return saved;
      }
      return 'home';
    } catch {
      return 'home';
    }
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'Admin@123' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; citation: string; docId?: string } | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [complete, setComplete] = useState(false);
  const [sources, setSources] = useState<Array<{ id: string; title: string; summary: string; score: number; docId?: string; fileType?: string; pageStart?: number | null; pageEnd?: number | null }>>([]);
  const [docTitleMap, setDocTitleMap] = useState<Record<string, string>>({});
  const [processingFocusDocId, setProcessingFocusDocId] = useState<string | null>(null);

  const stripExtension = (name: string) => {
    if (!name) return name;
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(0, idx) : name;
  };

  useEffect(() => {
    try {
      window.localStorage.setItem('czj_view', view);
    } catch {
      // ignore
    }
  }, [view]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setAuthError('登录状态已失效，请重新登录。');
      setAuthMode('login');
      if (view === 'admin' || view === 'roles') {
        setView('home');
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [view]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const res = await authFetch('/api/v1/auth/me');
        if (!res.ok) {
          throw new Error('无法获取当前登录用户');
        }
        const user = await res.json();
        setCurrentUser(user);
      } catch {
        clearAccessToken();
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if ((view === 'admin' || view === 'roles') && !isAdminUser(currentUser)) {
      setView('home');
    }
  }, [currentUser, view]);

  const canUpload = useMemo(() => hasPermission(currentUser, 'kb.upload'), [currentUser]);
  const canReview = useMemo(() => hasPermission(currentUser, 'doc.review'), [currentUser]);
  const canManageKnowledge = useMemo(() => hasPermission(currentUser, 'kb.manage'), [currentUser]);

  const ensureDocTitleMap = async () => {
    if (Object.keys(docTitleMap).length > 0) return docTitleMap;
    try {
      const res = await authFetch('/api/v1/knowledge/documents?page=1&pageSize=100&includeHidden=true');
      if (!res.ok) return {};
      const data = await res.json();
      const map: Record<string, string> = {};
      (data.items || []).forEach((item: any) => {
        if (item.docId) {
          const raw = item.displayName || item.originalFilename || item.docId;
          map[item.docId] = stripExtension(raw);
        }
      });
      setDocTitleMap(map);
      return map;
    } catch {
      return {};
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setAuthError('');
    setRegisterSuccess('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || '登录失败');
      }
      setAccessToken(data.accessToken, rememberMe);
      setCurrentUser(data.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    setAuthError('');
    setRegisterSuccess('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterLoading(false);
      setAuthError('两次输入的密码不一致。');
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerForm.username,
          displayName: registerForm.displayName,
          email: registerForm.email || null,
          password: registerForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || '注册失败');
      }

      setRegisterForm({
        username: '',
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      setLoginForm((prev) => ({ ...prev, username: data.username || registerForm.username, password: '' }));
      setAuthMode('login');
      setRegisterSuccess('注册成功，请使用刚创建的账号登录。');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '注册失败');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    setCurrentUser(null);
    setDocTitleMap({});
    setPreviewDoc(null);
    setAnswer('');
    setComplete(false);
    setSources([]);
    setAuthMode('login');
      if (view === 'admin' || view === 'roles') {
        setView('home');
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
      const res = await authFetch('/api/v1/qa/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, topK: 6, useRerank })
      });
      if (!res.ok) throw new Error('检索失败');
      const data = await res.json();
      const results = data?.sources || [];
      const titleMap = await ensureDocTitleMap();

      const builtSources = results.map((item: any, idx: number) => {
        const rawTitle = titleMap[item.docId] || item.source || item.docId || '未知文档';
        const guessType = (() => {
          const text = (rawTitle || '').toString();
          const match = text.match(/\.([a-zA-Z0-9]+)$/);
          if (match) return match[1].toUpperCase();
          return item?.source?.toString().split('.').pop()?.toUpperCase() || null;
        })();
        return {
          id: item.chunkIds?.[0] || `${item.docId || 'doc'}_${idx}`,
          docId: item.docId,
          title: stripExtension(rawTitle),
          summary: item.content || '',
          score: typeof item.score === 'number' ? item.score : 0,
          fileType: guessType || undefined,
          pageStart: item.pageStart ?? null,
          pageEnd: item.pageEnd ?? null
        };
      });
      setSources(builtSources);

      const answerText = data?.answer || '未生成有效答案。';
      setAnswer(answerText);
      setComplete(true);
    } catch {
      setAnswer('请求异常，请稍后重试。');
      setComplete(true);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center text-slate-600">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <Loader2 size={18} className="animate-spin" />
          <span>正在检查登录状态...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#eef2f7]">
        <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top_left,#1d4ed8,transparent_32%),radial-gradient(circle_at_80%_20%,#38bdf8,transparent_25%),linear-gradient(160deg,#071630_0%,#10274f_55%,#0f1f37_100%)] lg:flex">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />
            <div className="relative z-10 flex h-full w-full flex-col justify-between p-14 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12 backdrop-blur">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-wide">铸见</div>
                  <div className="text-xs uppercase tracking-[0.28em] text-blue-100/80">Industrial Knowledge Platform</div>
                </div>
              </div>

              <div className="max-w-xl">
                <div className="mb-6 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs tracking-[0.24em] text-blue-100 uppercase">
                  工业知识 · 文档处理 · 权限协同
                </div>
                <h1 className="text-5xl font-bold leading-tight">
                  铸见 · 洞悉工业
                </h1>
                <p className="mt-5 text-lg leading-8 text-blue-50/88">
                  让每一份工业文档，都能在关键时刻开口说话。把知识检索、文档处理、权限审批和知识库管理沉淀为一套真正可用的企业系统。
                </p>
                <div className="mt-10 grid grid-cols-3 gap-4">
                  {[
                    ['文档解析', '上传、审核、切片、向量化一体化流转'],
                    ['知识权限', '按知识库与角色控制访问范围'],
                    ['企业级可追踪', '审批记录、日志、规则配置全部留痕'],
                  ].map(([title, desc]) => (
                    <div key={title} className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="mt-2 text-xs leading-5 text-blue-100/75">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-blue-100/60">Industrial Knowledge Platform</div>
            </div>
          </div>

          <div className="relative flex items-center justify-center bg-white px-8 py-12 sm:px-14 lg:px-20">
            <div className="w-full max-w-md">
              <div className="mb-10 lg:hidden">
                <div className="text-sm uppercase tracking-[0.24em] text-blue-500">Industrial Knowledge Platform</div>
                <h1 className="mt-3 text-3xl font-bold text-slate-800">登录铸见工业知识库</h1>
                <p className="mt-2 text-sm text-slate-500">欢迎回来，请使用您的企业账号登录。</p>
              </div>

              <div>
                <div className="mb-10 hidden lg:block">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                    <LockKeyhole size={22} />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800">
                    {authMode === 'login' ? '登录铸见工业知识库' : '注册企业账号'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {authMode === 'login' ? '欢迎回来，请使用您的企业账号登录。' : '创建一个普通用户账号，后续可申请知识库查看与上传权限。'}
                  </p>
                </div>

                <div className="mb-6 inline-flex rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                    className={`rounded-2xl px-5 py-2 text-sm font-medium transition ${authMode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                      setRegisterSuccess('');
                    }}
                    className={`rounded-2xl px-5 py-2 text-sm font-medium transition ${authMode === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    注册
                  </button>
                </div>

                {authMode === 'login' ? (
                  <form onSubmit={handleLogin}>
                    <div className="space-y-4">
                      <Field
                        label="账号"
                        icon={<User size={16} />}
                        placeholder="请输入工号/邮箱"
                        value={loginForm.username}
                        onChange={(value) => setLoginForm((prev) => ({ ...prev, username: value }))}
                        hasError={!!authError}
                      />
                      <Field
                        label="密码"
                        icon={<LockKeyhole size={16} />}
                        placeholder="请输入密码"
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginForm.password}
                        onChange={(value) => setLoginForm((prev) => ({ ...prev, password: value }))}
                        hasError={!!authError}
                        suffix={
                          <button type="button" onClick={() => setShowLoginPassword((prev) => !prev)} className="text-slate-400 hover:text-slate-600">
                            {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 text-slate-500">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        7天内免登录
                      </label>
                      <button type="button" className="text-blue-600 hover:text-blue-700">
                        忘记密码？
                      </button>
                    </div>

                    {authError && (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {authError}
                      </div>
                    )}
                    {registerSuccess && (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                        {registerSuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      {loginLoading && <Loader2 size={16} className="animate-spin" />}
                      <span>{loginLoading ? '登录中...' : '登录'}</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister}>
                    <div className="space-y-4">
                      <Field
                        label="用户名"
                        icon={<User size={16} />}
                        placeholder="请输入登录用户名"
                        value={registerForm.username}
                        onChange={(value) => setRegisterForm((prev) => ({ ...prev, username: value }))}
                        hasError={!!authError}
                      />
                      <Field
                        label="显示名称"
                        icon={<ShieldCheck size={16} />}
                        placeholder="请输入姓名/昵称"
                        value={registerForm.displayName}
                        onChange={(value) => setRegisterForm((prev) => ({ ...prev, displayName: value }))}
                        hasError={!!authError}
                      />
                      <Field
                        label="邮箱"
                        icon={<Mail size={16} />}
                        placeholder="请输入企业邮箱"
                        value={registerForm.email}
                        onChange={(value) => setRegisterForm((prev) => ({ ...prev, email: value }))}
                        hasError={!!authError}
                      />
                      <Field
                        label="密码"
                        icon={<LockKeyhole size={16} />}
                        placeholder="请输入密码"
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={registerForm.password}
                        onChange={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
                        hasError={!!authError}
                        suffix={
                          <button type="button" onClick={() => setShowRegisterPassword((prev) => !prev)} className="text-slate-400 hover:text-slate-600">
                            {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                      <Field
                        label="确认密码"
                        icon={<LockKeyhole size={16} />}
                        placeholder="请再次输入密码"
                        type={showRegisterConfirmPassword ? 'text' : 'password'}
                        value={registerForm.confirmPassword}
                        onChange={(value) => setRegisterForm((prev) => ({ ...prev, confirmPassword: value }))}
                        hasError={!!authError}
                        suffix={
                          <button type="button" onClick={() => setShowRegisterConfirmPassword((prev) => !prev)} className="text-slate-400 hover:text-slate-600">
                            {showRegisterConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                    </div>

                    {authError && (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={registerLoading}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {registerLoading && <Loader2 size={16} className="animate-spin" />}
                      <span>{registerLoading ? '注册中...' : '注册并创建账号'}</span>
                    </button>
                  </form>
                )}

                <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  演示管理员账号：`admin / Admin@123`
                </div>
              </div>

              <div className="mt-12 text-center text-xs text-slate-400">
                v1.0.0 · Copyright © 2026 精诺瀚海数据科技有限公司
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-slate-900 bg-[#f0f2f5]">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
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

      <Navbar
        onNavigate={setView}
        activeView={view}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <motion.main
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-64px)] flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
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
              <div className="text-center mb-16">
                <h1 className="text-7xl font-bold mb-6 tracking-tight text-slate-800 drop-shadow-sm">
                  <span>铸见</span>
                  <span className="mx-3 text-slate-300 font-light text-5xl align-middle">·</span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-blue-700">洞悉工业</span>
                </h1>
                <h2 className="text-lg text-slate-600 font-medium tracking-[0.15em] leading-relaxed mb-8 uppercase">
                  让每一份工业文档都能在关键时刻开口说话
                </h2>
                <p className="text-base text-slate-500 max-w-xl mx-auto leading-relaxed tracking-wide font-normal">
                  面向工业场景的深度知识检索与问答系统
                  <br />
                  <span className="text-slate-400 text-sm mt-2 block">融合文档解析 / 语义检索 / 专业对话能力</span>
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
                <AIPanel
                  answer={answer}
                  loading={loading}
                  complete={complete}
                  sources={sources}
                  onCitationClick={(index) => {
                    const source = sources[index];
                    if (!source) return;
                    setPreviewDoc({
                      docId: source.docId,
                      title: source.title,
                      citation: source.summary
                    });
                  }}
                />

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
              <Documents
                onOpenPreview={(docId, title) => setPreviewDoc({ docId, title, citation: '' })}
                onOpenProcessing={(docId) => {
                  setProcessingFocusDocId(docId);
                  setView('processing');
                }}
                canUpload={canUpload}
                canReview={canReview}
                canManage={canManageKnowledge}
              />
            </motion.div>
          )}

          {view === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <ProcessingCenter
                focusDocId={processingFocusDocId}
                onConsumeFocus={() => setProcessingFocusDocId(null)}
              />
            </motion.div>
          )}

          {view === 'roles' && isAdminUser(currentUser) && (
            <motion.div
              key="roles"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <RoleManagementCenter />
            </motion.div>
          )}

          {view === 'admin' && isAdminUser(currentUser) && (
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

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
  suffix,
  hasError = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  suffix?: React.ReactNode;
  hasError?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <div className={`flex items-center rounded-2xl border px-4 py-3 transition ${hasError ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:bg-white'}`}>
        <div className="mr-3 text-slate-400">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
          placeholder={placeholder}
        />
        {suffix && <div className="ml-3">{suffix}</div>}
      </div>
    </label>
  );
}

export default App;
