import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Cpu, Activity, FileText, CheckCircle, Database, AlertCircle, Eye, EyeOff, Edit3, Folder } from 'lucide-react';
import { motion } from 'framer-motion';
import ActionDialog from '../ui/ActionDialog';

interface SystemStatus {
  elasticsearch: string;
  indexCount: number | null;
  nodeCount: number | null;
  latencyMs: number | null;
  qdrantCount: number | null;
  rerankerModel: string;
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'green':
      return '正常';
    case 'yellow':
      return '可用';
    case 'red':
      return '故障';
    case 'down':
      return '不可用';
    default:
      return '未知';
  }
};

const docStatusLabels: Record<string, string> = {
    UPLOADED: '已上传',
    PARSING: '解析中',
    INDEXED: '已索引',
    FAILED: '解析失败',
    PENDING_REVIEW: '待审核',
    APPROVED: '审核通过',
    REJECTED: '已拒绝'
};

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'manage' | 'system'>('upload');
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [dialog, setDialog] = useState<{
        title: string;
        message?: string;
        variant?: 'success' | 'warning' | 'error' | 'info';
        showCancel?: boolean;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
    } | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setIsUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify({ source: 'admin_upload', role: 'ADMIN' }));

        try {
            const res = await fetch('/api/v1/knowledge/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json().catch(() => null);
                const status = data?.status || 'PENDING_REVIEW';
                const message = status === 'APPROVED'
                    ? `"${file.name}" 上传成功，已自动进入解析流程。`
                    : `"${file.name}" 上传成功！状态设为待审核。`;
                setDialog({
                    title: '上传成功',
                    message,
                    variant: 'success',
                    confirmLabel: '好的'
                });
            } else {
                const err = await res.text();
                setDialog({
                    title: '上传失败',
                    message: err || '请稍后再试。',
                    variant: 'error',
                    confirmLabel: '知道了'
                });
            }
        } catch (error) {
            console.error(error);
            setDialog({
                title: '上传出错',
                message: '网络异常或服务不可用。',
                variant: 'error',
                confirmLabel: '知道了'
            });
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const fetchSystemStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/v1/system/status');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            setSystemStatus(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'system') {
            fetchSystemStatus();
        }
    }, [activeTab]);

    return (
        <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-white rounded-2xl p-4 shadow-sm h-fit">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-4 px-2">管理控制台</div>
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'upload' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <Upload size={18} />
                            上传知识
                        </button>
                        <button
                            onClick={() => setActiveTab('files')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'files' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <FileText size={18} />
                            文件治理
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'manage' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <Folder size={18} />
                            文档管理
                        </button>
                        <div className="h-px bg-slate-100 my-2" />
                        <button
                            onClick={() => setActiveTab('system')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'system' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <Activity size={18} />
                            系统监控
                        </button>
                    </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {activeTab === 'upload' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-8 shadow-sm border border-dashed border-slate-300 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6">
                                <Upload size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">拖拽文件至此上传</h3>
                            <p className="text-slate-500 mb-8 text-center max-w-md">
                                支持 PDF, DOCX, TXT, JSONL 格式。文件需小于 50MB。 <br />上传后默认进入“待审核”列表。
                            </p>
                            <div className='relative'>
                                <input
                                    type="file"
                                    id="admin-file-upload"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                />
                                <label
                                    htmlFor="admin-file-upload"
                                    className={`bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
                                >
                                    <Upload size={18} /> {isUploading ? '上传中...' : '选择文件'}
                                </label>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'system' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
                            {loading && <div className="col-span-2 text-center py-10 text-slate-500">正在检查系统状态...</div>}

                            {error && (
                                <div className="col-span-2 bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
                                    <AlertCircle size={20} />
                                    <span>连接后端服务失败: {error}</span>
                                </div>
                            )}

                            {!loading && systemStatus && (
                                <>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`p-2 rounded-lg ${systemStatus.elasticsearch === 'green' || systemStatus.elasticsearch === 'yellow' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                <Cpu size={20} />
                                            </div>
                                            <h3 className="font-bold text-slate-800">检索引擎</h3>
                                        </div>
                                        <div className={`flex items-center gap-2 font-medium ${systemStatus.elasticsearch === 'green' || systemStatus.elasticsearch === 'yellow' ? 'text-green-600' : 'text-red-500'}`}>
                                            <CheckCircle size={16} /> 状态: {statusLabel(systemStatus.elasticsearch)}
                                        </div>
                                        <div className="mt-4 text-xs text-slate-400 space-y-1">
                                            <div>索引数量: {typeof systemStatus.indexCount === 'number' ? systemStatus.indexCount.toLocaleString() : 'N/A'}</div>
                                            <div>节点数量: {typeof systemStatus.nodeCount === 'number' ? systemStatus.nodeCount.toLocaleString() : 'N/A'}</div>
                                            <div>响应延迟: {typeof systemStatus.latencyMs === 'number' ? `${systemStatus.latencyMs} ms` : 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                                <Database size={20} />
                                            </div>
                                            <h3 className="font-bold text-slate-800">向量库</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                                            <span className="text-2xl font-bold">{typeof systemStatus.qdrantCount === 'number' ? systemStatus.qdrantCount.toLocaleString() : 'N/A'}</span> <span className="text-sm text-slate-400 font-normal">向量数</span>
                                        </div>
                                        <div className="mt-4 text-xs text-slate-400">
                                            嵌入模型: bge-m3 <br />
                                            重排模型: {systemStatus.rerankerModel}
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'files' && (
                        <FileGovernanceTable />
                    )}

                    {activeTab === 'manage' && (
                        <DocumentManagement />
                    )}
                </div>
            </div>
            <ActionDialog
                open={!!dialog}
                title={dialog?.title || ''}
                message={dialog?.message}
                variant={dialog?.variant}
                showCancel={dialog?.showCancel}
                confirmLabel={dialog?.confirmLabel}
                cancelLabel={dialog?.cancelLabel}
                onCancel={() => setDialog(null)}
                onConfirm={() => {
                    const handler = dialog?.onConfirm;
                    setDialog(null);
                    if (handler) handler();
                }}
            />
        </div>
    );
};

// --- Sub Components ---

const FileGovernanceTable = () => {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState<{
        title: string;
        message?: string;
        variant?: 'success' | 'warning' | 'error' | 'info';
        showCancel?: boolean;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
    } | null>(null);

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/knowledge/documents?page=1&pageSize=100&includeHidden=true');
            if (res.ok) {
                const data = await res.json();
                const sorted = data.items.sort((a: any, b: any) => {
                    // Sort PENDING to top
                    const scoreA = a.status === 'PENDING_REVIEW' ? 2 : (a.status === 'REJECTED' ? 0 : 1);
                    const scoreB = b.status === 'PENDING_REVIEW' ? 2 : (b.status === 'REJECTED' ? 0 : 1);
                    if (scoreA !== scoreB) return scoreB - scoreA;
                    
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setDocs(sorted);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, []);

    const handleReview = async (docId: string, action: 'APPROVE' | 'REJECT') => {
        setDialog({
            title: action === 'APPROVE' ? '确认通过审核' : '确认拒绝文档',
            message: action === 'APPROVE' ? '通过后将开始解析入库。' : '拒绝后将删除源文件。',
            variant: action === 'APPROVE' ? 'info' : 'warning',
            showCancel: true,
            confirmLabel: action === 'APPROVE' ? '通过' : '拒绝',
            cancelLabel: '取消',
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/v1/knowledge/documents/${docId}/review?action=${action}`, { method: 'POST' });
                    if (res.ok) {
                        setDialog({
                            title: action === 'APPROVE' ? '审核通过' : '已拒绝',
                            message: action === 'APPROVE' ? '系统已开始解析入库。' : '已拒绝并清理源文件。',
                            variant: action === 'APPROVE' ? 'success' : 'warning',
                            confirmLabel: '好的'
                        });
                        fetchDocs();
                    } else {
                        setDialog({
                            title: '操作失败',
                            message: '请稍后再试。',
                            variant: 'error',
                            confirmLabel: '知道了'
                        });
                    }
                } catch (e) {
                    setDialog({
                        title: '网络错误',
                        message: '请检查网络连接。',
                        variant: 'error',
                        confirmLabel: '知道了'
                    });
                }
            }
        });
    };

    const handleDelete = async (docId: string) => {
        setDialog({
            title: '确认删除记录',
            message: '此操作将删除文档记录与索引数据。',
            variant: 'warning',
            showCancel: true,
            confirmLabel: '删除',
            cancelLabel: '取消',
            onConfirm: async () => {
                try {
                    await fetch(`/api/v1/knowledge/documents/${docId}`, { method: 'DELETE' });
                    fetchDocs();
                    setDialog({
                        title: '删除任务已提交',
                        message: '后台正在处理删除。',
                        variant: 'success',
                        confirmLabel: '好的'
                    });
                } catch (e) {
                    console.error(e);
                    setDialog({
                        title: '删除失败',
                        message: '请稍后再试。',
                        variant: 'error',
                        confirmLabel: '知道了'
                    });
                }
            }
        });
    };

    if (loading) return <div className="p-8 text-center text-slate-400">加载文档列表...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-700">文档审核列表</h3>
                <button onClick={fetchDocs} className="text-sm text-blue-600 hover:underline">刷新列表</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">文件名</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4">大小</th>
                            <th className="px-6 py-4">日期</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {docs.map(doc => (
                            <tr key={doc.docId} className={`hover:bg-slate-50 ${doc.status === 'PENDING_REVIEW' ? 'bg-blue-50/30' : ''}`}>
                                <td className="px-6 py-4 font-medium text-slate-700 max-w-xs truncate" title={doc.originalFilename}>
                                    {doc.originalFilename}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-xs font-bold 
                                        ${doc.status === 'PENDING_REVIEW' ? 'bg-blue-100 text-blue-700' :
                                                doc.status === 'INDEXED' ? 'bg-green-100 text-green-700' :
                                                    doc.status === 'REJECTED' ? 'bg-slate-100 text-slate-400 line-through' :
                                                        doc.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {docStatusLabels[doc.status] || doc.status}
                                        </span>
                                        {doc.errorMessage && (
                                            <span className="text-[10px] text-red-500 truncate" title={doc.errorMessage}>{doc.errorMessage}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{typeof doc.fileSize === 'number' ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '未知'}</td>
                                <td className="px-6 py-4 text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                    {doc.status === 'PENDING_REVIEW' && (
                                        <>
                                            <button onClick={() => handleReview(doc.docId, 'APPROVE')} className="px-3 py-1 bg-green-50 text-green-600 rounded border border-green-200 hover:bg-green-100 transition-colors">通过</button>
                                            <button onClick={() => handleReview(doc.docId, 'REJECT')} className="px-3 py-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors">拒绝</button>
                                        </>
                                    )}
                                    <button onClick={() => handleDelete(doc.docId)} className="p-2 text-slate-400 hover:text-red-500" title="删除记录"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                        {docs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">暂无文档</td></tr>}
                    </tbody>
                </table>
            </div>
            <ActionDialog
                open={!!dialog}
                title={dialog?.title || ''}
                message={dialog?.message}
                variant={dialog?.variant}
                showCancel={dialog?.showCancel}
                confirmLabel={dialog?.confirmLabel}
                cancelLabel={dialog?.cancelLabel}
                onCancel={() => setDialog(null)}
                onConfirm={() => {
                    const handler = dialog?.onConfirm;
                    setDialog(null);
                    if (handler) handler();
                }}
            />
        </div>
    );
};

interface ManagedDoc {
    docId: string;
    originalFilename: string;
    displayName?: string;
    description?: string;
    hidden?: boolean;
    fileSize?: number;
    fileType?: string;
    status: string;
    createdAt: string;
    errorMessage?: string;
}

const DocumentManagement = () => {
    const [docs, setDocs] = useState<ManagedDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [dialog, setDialog] = useState<{
        title: string;
        message?: string;
        variant?: 'success' | 'warning' | 'error' | 'info';
        showCancel?: boolean;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
    } | null>(null);
    const [editDoc, setEditDoc] = useState<ManagedDoc | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/knowledge/documents?page=1&pageSize=100&includeHidden=true');
            if (res.ok) {
                const data = await res.json();
                setDocs(data.items || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDocs(); }, []);

    const openEdit = (doc: ManagedDoc) => {
        setEditDoc(doc);
        setEditName(doc.displayName || doc.originalFilename);
        setEditDescription(doc.description || '');
    };

    const saveEdit = async () => {
        if (!editDoc) return;
        try {
            const res = await fetch(`/api/v1/knowledge/documents/${editDoc.docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: editName.trim() || null,
                    description: editDescription.trim() || null
                })
            });
            if (!res.ok) throw new Error('update failed');
            setDialog({
                title: '文档信息已更新',
                message: '修改已保存。',
                variant: 'success',
                confirmLabel: '好的'
            });
            setEditDoc(null);
            fetchDocs();
        } catch (e) {
            setDialog({
                title: '更新失败',
                message: '请稍后再试。',
                variant: 'error',
                confirmLabel: '知道了'
            });
        }
    };

    const toggleHidden = (doc: ManagedDoc) => {
        setDialog({
            title: doc.hidden ? '取消隐藏文档' : '隐藏文档',
            message: doc.hidden ? '文档将重新出现在用户端列表。' : '隐藏后用户端将不可见。',
            variant: doc.hidden ? 'info' : 'warning',
            showCancel: true,
            confirmLabel: doc.hidden ? '取消隐藏' : '确认隐藏',
            cancelLabel: '取消',
            onConfirm: async () => {
                try {
                    await fetch(`/api/v1/knowledge/documents/${doc.docId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hidden: !doc.hidden })
                    });
                    fetchDocs();
                    setDialog({
                        title: doc.hidden ? '已取消隐藏' : '已隐藏文档',
                        message: doc.hidden ? '文档已恢复显示。' : '文档已从用户端列表隐藏。',
                        variant: 'success',
                        confirmLabel: '好的'
                    });
                } catch (e) {
                    setDialog({
                        title: '操作失败',
                        message: '请稍后再试。',
                        variant: 'error',
                        confirmLabel: '知道了'
                    });
                }
            }
        });
    };

    const deleteDoc = (doc: ManagedDoc) => {
        setDialog({
            title: '删除文档',
            message: '该操作会删除索引与记录，无法恢复。',
            variant: 'warning',
            showCancel: true,
            confirmLabel: '删除',
            cancelLabel: '取消',
            onConfirm: async () => {
                try {
                    await fetch(`/api/v1/knowledge/documents/${doc.docId}`, { method: 'DELETE' });
                    setDocs(prev => prev.filter(item => item.docId !== doc.docId));
                    setDialog({
                        title: '删除任务已提交',
                        message: '后台正在处理删除。',
                        variant: 'success',
                        confirmLabel: '好的'
                    });
                } catch (e) {
                    setDialog({
                        title: '删除失败',
                        message: '请稍后再试。',
                        variant: 'error',
                        confirmLabel: '知道了'
                    });
                }
            }
        });
    };

    const filtered = docs.filter(doc => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return true;
        const name = (doc.displayName || doc.originalFilename || '').toLowerCase();
        return name.includes(keyword) || doc.docId.toLowerCase().includes(keyword);
    });

    if (loading) return <div className="p-8 text-center text-slate-400">加载文档数据...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
                <div>
                    <h3 className="font-bold text-slate-700">文档管理总览</h3>
                    <p className="text-xs text-slate-400">支持隐藏、删除与编辑文档信息</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索文档名称或ID"
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <button onClick={fetchDocs} className="text-sm text-blue-600 hover:underline">刷新列表</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">文档名称</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4">可见性</th>
                            <th className="px-6 py-4">更新时间</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(doc => (
                            <tr key={doc.docId} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-700" title={doc.displayName || doc.originalFilename}>
                                        {doc.displayName || doc.originalFilename}
                                    </div>
                                    <div className="text-xs text-slate-400">ID: {doc.docId}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                                            {docStatusLabels[doc.status] || doc.status}
                                        </span>
                                        {doc.errorMessage && (
                                            <span className="text-[10px] text-red-500 truncate" title={doc.errorMessage}>{doc.errorMessage}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${doc.hidden ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {doc.hidden ? '已隐藏' : '可见'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-400">{new Date(doc.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                    <button onClick={() => openEdit(doc)} className="p-2 text-slate-500 hover:text-blue-600" title="编辑信息">
                                        <Edit3 size={16} />
                                    </button>
                                    <button onClick={() => toggleHidden(doc)} className="p-2 text-slate-500 hover:text-amber-600" title={doc.hidden ? '取消隐藏' : '隐藏文档'}>
                                        {doc.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button onClick={() => deleteDoc(doc)} className="p-2 text-slate-500 hover:text-red-600" title="删除文档">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">暂无文档</td></tr>}
                    </tbody>
                </table>
            </div>

            {editDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setEditDoc(null)} />
                    <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 p-6">
                        <h4 className="text-lg font-bold text-slate-800 mb-4">编辑文档信息</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-500">展示名称</label>
                                <input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500">备注信息</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setEditDoc(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
                            <button onClick={saveEdit} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm">保存</button>
                        </div>
                    </div>
                </div>
            )}

            <ActionDialog
                open={!!dialog}
                title={dialog?.title || ''}
                message={dialog?.message}
                variant={dialog?.variant}
                showCancel={dialog?.showCancel}
                confirmLabel={dialog?.confirmLabel}
                cancelLabel={dialog?.cancelLabel}
                onCancel={() => setDialog(null)}
                onConfirm={() => {
                    const handler = dialog?.onConfirm;
                    setDialog(null);
                    if (handler) handler();
                }}
            />
        </div>
    );
};

export default AdminDashboard;
