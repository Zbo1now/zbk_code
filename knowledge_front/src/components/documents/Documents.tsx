import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Tag, Clock, ChevronRight, Upload, Trash2, FileCheck, FileWarning, Loader2, CheckCircle, XCircle } from 'lucide-react';
import ActionDialog from '../ui/ActionDialog';

interface DocumentItem {
  docId: string;
  originalFilename: string;
  displayName?: string;
  hidden?: boolean;
  fileSize?: number;
  fileType?: string;
  status: 'UPLOADED' | 'INDEXED' | 'FAILED' | 'PARSING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  createdAt: string; // ISO 格式时间字符串
  errorMessage?: string;
}

const statusColors = {
  UPLOADED: 'bg-blue-100 text-blue-700',
  PARSING: 'bg-amber-100 text-amber-700',
  INDEXED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING_REVIEW: 'bg-purple-100 text-purple-700', 
  APPROVED: 'bg-indigo-100 text-indigo-700',
  REJECTED: 'bg-gray-200 text-gray-500 line-through'
};

const statusLabels = {
  UPLOADED: '已上传',
  PARSING: '解析中',
  INDEXED: '已索引',
  FAILED: '解析失败',
  PENDING_REVIEW: '待审核',
  APPROVED: '审核通过',
  REJECTED: '已拒绝'
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '未知';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

interface DocCardProps {
  doc: DocumentItem;
  coverColor: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onReview: (docId: string, action: 'APPROVE' | 'REJECT') => void;
}

const DocCard: React.FC<DocCardProps> = ({ doc, coverColor, onClick, onDelete, onReview }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -5 }}
    onClick={onClick}
    className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden cursor-pointer"
  >
    <div className="absolute top-2 right-2 z-10 flex gap-2">
       {/* 审核操作 */}
       {doc.status === 'PENDING_REVIEW' && (
         <div className="flex gap-1 bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onReview(doc.docId, 'APPROVE'); }}
              className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded transition-colors"
              title="通过审核"
            >
              <CheckCircle size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onReview(doc.docId, 'REJECT'); }}
              className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors"
              title="拒绝"
            >
              <XCircle size={16} />
            </button>
         </div>
       )}

       <button 
        onClick={onDelete}
        className="p-1.5 bg-white/80 backdrop-blur-sm hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        title="删除文档"
       >
         <Trash2 size={16} />
       </button>
    </div>

    {/* 封面预览区域 */}
    <div className={`h-28 ${coverColor} relative p-4 flex flex-col justify-end`}>
       <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[doc.status] || 'bg-slate-100 text-slate-500'}`}>
          {statusLabels[doc.status] || doc.status}
       </div>
      <FileText className="text-white/50 absolute top-4 left-4 w-12 h-12" />
      <div className="text-white/80 text-xs font-mono absolute bottom-2 right-4">
        {doc.fileType || 'UNK'} · {formatSize(doc.fileSize)}
      </div>
    </div>

    {/* 内容区域 */}
    <div className="p-4">
      <h3 className="font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors text-sm h-10" title={doc.displayName || doc.originalFilename}>
        {doc.displayName || doc.originalFilename}
      </h3>
      
      {doc.errorMessage && (
        <div className="text-[10px] text-red-500 mb-2 truncate" title={doc.errorMessage}>
          Err: {doc.errorMessage}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400 mt-2 border-t border-slate-50 pt-2">
        <span className="flex items-center gap-1">
          <Clock size={10} /> {new Date(doc.createdAt).toLocaleDateString()}
        </span>
        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-blue-500" />
      </div>
    </div>
  </motion.div>
);

interface DocumentsProps {
  onOpenPreview: (docId: string, docTitle: string) => void;
}

const Documents: React.FC<DocumentsProps> = ({ onOpenPreview }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [total, setTotal] = useState(0);
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
    try {
      const res = await fetch('/api/v1/knowledge/documents?page=1&pageSize=50');
      if (res.ok) {
        const data = await res.json();
        setDocs(data.items);
        setTotal(data.total);
      }
    } catch (e) {
      console.error("Failed to fetch docs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    const interval = setInterval(fetchDocs, 5000); // 自动刷新状态
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify({ source: 'web_upload' }));

    setUploading(true);
    try {
      const res = await fetch('/api/v1/knowledge/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        // 刷新列表
        await fetchDocs();
        setDialog({
          title: '上传成功',
          message: `"${file.name}" 已上传，正在进入处理流程。`,
          variant: 'success',
          confirmLabel: '好的'
        });
      } else {
        setDialog({
          title: '上传失败',
          message: '请稍后再试或检查文件格式。',
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
      setUploading(false);
    }
  };

  const handleReview = async (docId: string, action: 'APPROVE' | 'REJECT') => {
    try {
        const res = await fetch(`/api/v1/knowledge/documents/${docId}/review?action=${action}`, { method: 'POST' });
        if (res.ok) {
            setDialog({
              title: action === 'APPROVE' ? '审核通过' : '已拒绝',
              message: action === 'APPROVE' ? '系统已开始解析与入库流程。' : '该文档已被拒绝并标记。',
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
  };

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    setDialog({
      title: '确认移除文档',
      message: '将从文档中心隐藏，但在审核/管理列表仍可查看。',
      variant: 'warning',
      showCancel: true,
      confirmLabel: '确认移除',
      cancelLabel: '取消',
      onConfirm: async () => {
        try {
          await fetch(`/api/v1/knowledge/documents/${docId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: true })
          });
          setDocs(prev => prev.filter(d => d.docId !== docId));
          setDialog({
            title: '已从文档中心移除',
            message: '文档已隐藏，如需恢复请在管理端操作。',
            variant: 'success',
            confirmLabel: '好的'
          });
        } catch (error) {
          console.error(error);
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

  // 静态渐变色以增加视觉变化
  const gradients = [
    "bg-gradient-to-br from-red-400 to-orange-500",
    "bg-gradient-to-br from-blue-400 to-indigo-500",
    "bg-gradient-to-br from-emerald-400 to-teal-500",
    "bg-gradient-to-br from-purple-400 to-pink-500",
    "bg-gradient-to-br from-amber-400 to-yellow-500",
    "bg-gradient-to-br from-slate-500 to-slate-700",
  ];

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen">
      
      {/* 头部和搜索栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">文档知识库</h1>
          <p className="text-slate-500">已收录 {total} 份技术文档，支持 PDF / Word / JSONL 上传</p>
        </div>

        <div className="flex gap-4">
            <div className='relative'>
                <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    onChange={handleUpload}
                    disabled={uploading}
                />
                <label 
                    htmlFor="file-upload" 
                    className={`flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 cursor-pointer transition-all ${uploading ? 'opacity-70 pointer-events-none' : ''}`}
                >
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                    <span>{uploading ? '上传中...' : '上传文档'}</span>
                </label>
            </div>

            {/* 毛玻璃效果搜索栏 */}
            <div className="relative group w-full md:w-80">
            <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:bg-white/80 transition-all">
                <Search className="text-slate-400 mr-3" size={20} />
                <input 
                type="text" 
                placeholder="搜索文档..." 
                className="bg-transparent border-none outline-none w-full text-slate-700 placeholder:text-slate-400"
                />
            </div>
            </div>
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

      {loading ? (
          <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-slate-300" size={48} />
          </div>
      ) : docs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FileWarning size={48} className="mx-auto mb-4 opacity-50" />
              <p>知识库暂无文档，请点击右上角上传</p>
          </div>
      ) : (
        /* 文档网格 */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
            {docs.map((doc, idx) => (
                <DocCard 
                    key={doc.docId} 
                    doc={doc} 
                    coverColor={gradients[idx % gradients.length]}
                    onClick={() => onOpenPreview(doc.docId, doc.displayName || doc.originalFilename)} 
                    onDelete={(e) => handleDelete(e, doc.docId)}
                    onReview={handleReview}
                />
            ))}
            </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Documents;