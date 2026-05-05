import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  FileWarning,
  Loader2,
  Search,
  Trash2,
  Upload,
  Workflow,
  XCircle,
} from 'lucide-react';
import ActionDialog from '../ui/ActionDialog';

interface DocumentItem {
  docId: string;
  originalFilename: string;
  displayName?: string;
  hidden?: boolean;
  fileSize?: number;
  fileType?: string;
  status: 'UPLOADED' | 'INDEXED' | 'FAILED' | 'PARSING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  errorMessage?: string;
}

interface DocumentsProps {
  onOpenPreview: (docId: string, docTitle: string) => void;
  onOpenProcessing: (docId: string) => void;
}

interface ChunkSettingsResponse {
  chunkSize: number;
  overlap: number;
  defaultChunkSize: number;
  defaultOverlap: number;
}

const statusColors: Record<string, string> = {
  UPLOADED: 'bg-blue-100 text-blue-700',
  PARSING: 'bg-amber-100 text-amber-700',
  INDEXED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING_REVIEW: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-indigo-100 text-indigo-700',
  REJECTED: 'bg-gray-200 text-gray-500 line-through',
};

const statusLabels: Record<string, string> = {
  UPLOADED: '已上传',
  PARSING: '解析中',
  INDEXED: '已索引',
  FAILED: '处理失败',
  PENDING_REVIEW: '待审核',
  APPROVED: '审核通过',
  REJECTED: '已拒绝',
};

const gradients = [
  'bg-gradient-to-br from-red-400 to-orange-500',
  'bg-gradient-to-br from-blue-400 to-indigo-500',
  'bg-gradient-to-br from-emerald-400 to-teal-500',
  'bg-gradient-to-br from-purple-400 to-pink-500',
  'bg-gradient-to-br from-amber-400 to-yellow-500',
  'bg-gradient-to-br from-slate-500 to-slate-700',
];

const isVisibleDocument = (doc: DocumentItem) => doc.status !== 'FAILED';

const parseDateValue = (value: string) => {
  const normalized = value.trim();
  const localLike = normalized
    .replace('T', ' ')
    .replace(/\.\d+$/, '')
    .replace(/Z$/, '');
  const matched = localLike.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (matched) {
    const [, year, month, day, hour, minute, second = '0'] = matched;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct;
  return new Date(localLike.replace(' ', 'T'));
};

const formatCardTime = (value: string) => {
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-');
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isWord = (fileType?: string) => ['DOC', 'DOCX'].includes((fileType || '').toUpperCase());

const Documents: React.FC<DocumentsProps> = ({ onOpenPreview, onOpenProcessing }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [chunkSettings, setChunkSettings] = useState<ChunkSettingsResponse | null>(null);
  const [chunkSizeInput, setChunkSizeInput] = useState('500');
  const [overlapInput, setOverlapInput] = useState('75');
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
      if (!res.ok) return;
      const data = await res.json();
      const visible = (data.items || [])
        .filter(isVisibleDocument)
        .sort((a: DocumentItem, b: DocumentItem) => parseDateValue(b.createdAt).getTime() - parseDateValue(a.createdAt).getTime());
      setDocs(visible);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    const timer = window.setInterval(fetchDocs, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchChunkSettings = async () => {
    try {
      const res = await fetch('/api/v1/knowledge/chunk-settings');
      if (!res.ok) return;
      const data = await res.json();
      setChunkSettings(data);
      setChunkSizeInput(String(data.chunkSize));
      setOverlapInput(String(data.overlap));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchChunkSettings();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const chunkSize = Number(chunkSizeInput);
    const overlap = Number(overlapInput);
    if (Number.isNaN(chunkSize) || Number.isNaN(overlap) || chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
      setDialog({
        title: '切片规则无效',
        message: '请检查切片长度和重叠长度，要求切片长度大于 0，且重叠长度小于切片长度。',
        variant: 'warning',
        confirmLabel: '知道了',
      });
      e.target.value = '';
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'metadata',
      JSON.stringify({ source: 'web_upload', chunkSize, overlap })
    );

    setUploading(true);
    try {
      const settingsRes = await fetch('/api/v1/knowledge/chunk-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkSize, overlap }),
      });
      if (!settingsRes.ok) throw new Error('update chunk settings failed');
      const settingsData = await settingsRes.json().catch(() => null);
      if (settingsData) {
        setChunkSettings(settingsData);
      }
      const res = await fetch('/api/v1/knowledge/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      await fetchDocs();
      setDialog({
        title: '上传成功',
        message: `"${file.name}" 已进入处理流程，现在可以查看时间线和切片进度。`,
        variant: 'success',
        confirmLabel: '查看处理',
        onConfirm: () => data?.docId && onOpenProcessing(data.docId),
      });
    } catch (error) {
      console.error(error);
      setDialog({
        title: '上传失败',
        message: '请稍后重试，或检查文件格式是否受支持。',
        variant: 'error',
        confirmLabel: '知道了',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleReview = async (docId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/v1/knowledge/documents/${docId}/review?action=${action}`, { method: 'POST' });
      if (!res.ok) throw new Error('review failed');
      await fetchDocs();
      setDialog({
        title: action === 'APPROVE' ? '审核通过' : '已拒绝',
        message: action === 'APPROVE' ? '文档已开始处理。' : '文档已拒绝并保留处理记录。',
        variant: action === 'APPROVE' ? 'success' : 'warning',
        confirmLabel: action === 'APPROVE' ? '查看处理' : '好的',
        onConfirm: action === 'APPROVE' ? () => onOpenProcessing(docId) : undefined,
      });
    } catch (error) {
      console.error(error);
      setDialog({
        title: '操作失败',
        message: '请稍后再试。',
        variant: 'error',
        confirmLabel: '知道了',
      });
    }
  };

  const handleHide = (docId: string) => {
    setDialog({
      title: '确认移除文档',
      message: '这会将文档从文档中心隐藏，但处理记录仍会保留。',
      variant: 'warning',
      showCancel: true,
      confirmLabel: '确认移除',
      cancelLabel: '取消',
      onConfirm: async () => {
        try {
          await fetch(`/api/v1/knowledge/documents/${docId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hidden: true }),
          });
          setDocs((prev) => prev.filter((item) => item.docId !== docId));
        } catch (error) {
          console.error(error);
        }
      },
    });
  };

  const filteredDocs = docs.filter((doc) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    const name = (doc.displayName || doc.originalFilename || '').toLowerCase();
    return name.includes(keyword) || doc.docId.toLowerCase().includes(keyword);
  });

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">文档中心</h1>
          <p className="text-slate-500">已收录 {filteredDocs.length} 份文档，支持上传后进入文档处理模块观察流程。</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-[300px]">
            <div className="text-sm font-semibold text-slate-700 mb-3">上传时切片规则</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                <span className="block mb-1">切片长度</span>
                <input
                  value={chunkSizeInput}
                  onChange={(e) => setChunkSizeInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="text-xs text-slate-500">
                <span className="block mb-1">重叠长度</span>
                <input
                  value={overlapInput}
                  onChange={(e) => setOverlapInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              当前系统值：{chunkSettings ? `${chunkSettings.chunkSize} / ${chunkSettings.overlap}` : '--'}
            </div>
            <div className="mt-3 relative">
              <input type="file" id="file-upload" className="hidden" onChange={handleUpload} disabled={uploading} />
              <label
                htmlFor="file-upload"
                className={`flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 cursor-pointer transition-all ${
                  uploading ? 'opacity-70 pointer-events-none' : ''
                }`}
              >
                {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                <span>{uploading ? '上传中...' : '上传文档'}</span>
              </label>
            </div>
          </div>

          <div className="relative group w-full md:w-80">
            <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:bg-white/80 transition-all">
              <Search className="text-slate-400 mr-3" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
          handler?.();
        }}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-slate-300" size={48} />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <FileWarning size={48} className="mx-auto mb-4 opacity-50" />
          <p>当前没有可展示的文档。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredDocs.map((doc, idx) => (
              <motion.div
                key={doc.docId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden"
              >
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  {doc.status === 'PENDING_REVIEW' && (
                    <>
                      <button
                        onClick={() => handleReview(doc.docId, 'APPROVE')}
                        className="p-1.5 bg-white/90 hover:bg-emerald-50 text-emerald-600 rounded-lg shadow-sm"
                        title="通过审核"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => handleReview(doc.docId, 'REJECT')}
                        className="p-1.5 bg-white/90 hover:bg-red-50 text-red-500 rounded-lg shadow-sm"
                        title="拒绝"
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleHide(doc.docId)}
                    className="p-1.5 bg-white/80 backdrop-blur-sm hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="移除文档"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <button type="button" onClick={() => onOpenPreview(doc.docId, doc.displayName || doc.originalFilename)} className="w-full text-left">
                  <div className={`h-28 ${gradients[idx % gradients.length]} relative p-4 flex flex-col justify-end`}>
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[doc.status] || 'bg-slate-100 text-slate-500'}`}>
                      {statusLabels[doc.status] || doc.status}
                    </div>
                    <FileText className="text-white/50 absolute top-4 left-4 w-12 h-12" />
                    <div className="text-white/80 text-xs font-mono absolute bottom-2 right-4">
                      {doc.fileType || 'UNK'} · {formatSize(doc.fileSize)}
                    </div>
                  </div>
                </button>

                <div className="p-4">
                  <h3
                    className="font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors text-sm h-10"
                    title={doc.displayName || doc.originalFilename}
                  >
                    {doc.displayName || doc.originalFilename}
                  </h3>

                  {doc.errorMessage && (
                    <div className="text-[10px] text-red-500 mb-2 truncate" title={doc.errorMessage}>
                      Err: {doc.errorMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 border-t border-slate-50 pt-2">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {formatCardTime(doc.createdAt)}
                    </span>
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-blue-500" />
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenProcessing(doc.docId)}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-colors"
                  >
                    <Workflow size={16} />
                    {isWord(doc.fileType) ? '查看处理与切片' : '查看处理状态'}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Documents;
