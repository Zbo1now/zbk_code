import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  FileWarning,
  Loader2,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Workflow,
  X,
  XCircle,
} from 'lucide-react';
import ActionDialog from '../ui/ActionDialog';
import { authFetch } from '../../utils/auth';

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

interface PermissionRequestItem {
  id: number;
  permissionCode: string;
  status: string;
  resourceType: string;
  resourceId?: string | null;
  reason?: string | null;
  createdAt?: string | null;
}

interface DocumentsProps {
  onOpenPreview: (docId: string, docTitle: string) => void;
  onOpenProcessing: (docId: string) => void;
  canUpload?: boolean;
  canReview?: boolean;
  canManage?: boolean;
}

const statusColors: Record<string, string> = {
  UPLOADED: 'bg-blue-100 text-blue-700',
  PARSING: 'bg-amber-100 text-amber-700',
  INDEXED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING_REVIEW: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-indigo-100 text-indigo-700',
  REJECTED: 'bg-slate-200 text-slate-500 line-through',
};

const statusLabels: Record<string, string> = {
  UPLOADED: '已上传',
  PARSING: '解析中',
  INDEXED: '已入库',
  FAILED: '处理失败',
  PENDING_REVIEW: '待审核',
  APPROVED: '审核通过',
  REJECTED: '已拒绝',
};

const requestStatusStyles: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
};

const permissionLabelMap: Record<string, string> = {
  'kb.view': '知识库查看',
  'kb.upload': '知识上传',
  'kb.manage': '知识库管理',
  'doc.review': '文档审批',
};

const requestStatusLabelMap: Record<string, string> = {
  PENDING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

const resourceTypeLabelMap: Record<string, string> = {
  GLOBAL: '全局',
  KNOWLEDGE_BASE: '知识库',
  CATEGORY: '分类',
  DOCUMENT: '文档',
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
const isWord = (fileType?: string) => ['DOC', 'DOCX'].includes((fileType || '').toUpperCase());
const formatPermissionLabel = (code: string) => permissionLabelMap[code] || code;
const formatRequestStatusLabel = (status: string) => requestStatusLabelMap[status] || status;
const formatResourceTypeLabel = (type: string) => resourceTypeLabelMap[type] || type;

const parseDateValue = (value: string) => {
  const normalized = value.trim();
  const localLike = normalized.replace('T', ' ').replace(/\.\d+$/, '').replace(/Z$/, '');
  const matched = localLike.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (matched) {
    const [, year, month, day, hour, minute, second = '0'] = matched;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct;
  return new Date(localLike.replace(' ', 'T'));
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
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

const Documents: React.FC<DocumentsProps> = ({
  onOpenPreview,
  onOpenProcessing,
  canUpload = false,
  canReview = false,
  canManage = false,
}) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [query, setQuery] = useState('');
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestItem[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestListOpen, setRequestListOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState('500');
  const [overlap, setOverlap] = useState('75');
  const [requestReason, setRequestReason] = useState('');
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
      const res = await authFetch('/api/v1/knowledge/documents?page=1&pageSize=50');
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

  const fetchPermissionRequests = async () => {
    try {
      const res = await authFetch('/api/v1/auth/permission-requests/my');
      if (!res.ok) return;
      const data = await res.json();
      setPermissionRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    void Promise.all([fetchDocs(), fetchPermissionRequests()]);
    const timer = window.setInterval(fetchDocs, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const pendingUploadRequest = useMemo(
    () => permissionRequests.some((item) => item.permissionCode === 'kb.upload' && item.status === 'PENDING'),
    [permissionRequests]
  );

  const approvedUploadRequest = useMemo(
    () => permissionRequests.some((item) => item.permissionCode === 'kb.upload' && item.status === 'APPROVED'),
    [permissionRequests]
  );

  const latestUploadRequest = useMemo(
    () => permissionRequests.find((item) => item.permissionCode === 'kb.upload'),
    [permissionRequests]
  );

  const filteredDocs = docs.filter((doc) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    const name = (doc.displayName || doc.originalFilename || '').toLowerCase();
    return name.includes(keyword) || doc.docId.toLowerCase().includes(keyword);
  });

  const requestSummaryText = useMemo(() => {
    if (permissionRequests.length === 0) {
      return '查看你提交过的权限申请记录';
    }
    if (latestUploadRequest) {
      return `最近一次知识上传申请：${formatRequestStatusLabel(latestUploadRequest.status)}`;
    }
    return `共 ${permissionRequests.length} 条申请记录`;
  }, [permissionRequests, latestUploadRequest]);

  const resetUploadForm = () => {
    setSelectedFile(null);
    setChunkSize('500');
    setOverlap('75');
  };

  const openUploadFlow = () => {
    setUploadModalOpen(true);
    setRequestListOpen(false);
  };

  const handleOpenPrimaryAction = () => {
    if (canUpload) {
      openUploadFlow();
      return;
    }
    if (pendingUploadRequest) {
      setDialog({
        title: '上传权限审批中',
        message: '你已经提交过上传权限申请，请等待管理员审批后再上传知识文档。',
        variant: 'info',
        confirmLabel: '知道了',
      });
      return;
    }
    setRequestModalOpen(true);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setDialog({ title: '请选择文件', message: '请先选择要上传的知识文档。', variant: 'warning', confirmLabel: '知道了' });
      return;
    }

    const parsedChunkSize = Number(chunkSize);
    const parsedOverlap = Number(overlap);
    if (Number.isNaN(parsedChunkSize) || Number.isNaN(parsedOverlap) || parsedChunkSize <= 0 || parsedOverlap < 0 || parsedOverlap >= parsedChunkSize) {
      setDialog({
        title: '切片规则无效',
        message: '请确认切片长度大于 0，且重叠长度不能小于 0 或大于等于切片长度。',
        variant: 'warning',
        confirmLabel: '知道了',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append(
      'metadata',
      JSON.stringify({
        source: 'web_upload',
        chunkSettings: {
          chunkSize: parsedChunkSize,
          overlap: parsedOverlap,
        },
      })
    );

    setUploading(true);
    try {
      const res = await authFetch('/api/v1/knowledge/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || (res.status === 403 ? '当前账号没有上传权限，请先申请。' : '上传失败'));
      }

      setUploadModalOpen(false);
      resetUploadForm();
      await fetchDocs();
      setDialog({
        title: '上传成功',
        message: `"${selectedFile.name}" 已进入处理流程，现在可以查看处理进度和切片结果。`,
        variant: 'success',
        confirmLabel: '查看处理',
        onConfirm: () => data?.docId && onOpenProcessing(data.docId),
      });
    } catch (error) {
      setDialog({
        title: '上传失败',
        message: error instanceof Error ? error.message : '请稍后重试，或检查当前账号的上传权限。',
        variant: 'error',
        confirmLabel: '知道了',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApplyUploadPermission = async () => {
    setApplying(true);
    try {
      const res = await authFetch('/api/v1/auth/permission-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissionCode: 'kb.upload',
          resourceType: 'GLOBAL',
          resourceId: null,
          reason: requestReason.trim() || '申请知识库上传权限',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || '提交权限申请失败');
      }

      setRequestModalOpen(false);
      setRequestReason('');
      await fetchPermissionRequests();
      setDialog({
        title: '申请已提交',
        message: '上传权限申请已经提交给管理员，审批通过后你就可以上传知识文档。',
        variant: 'success',
        confirmLabel: '知道了',
      });
    } catch (error) {
      setDialog({
        title: '提交失败',
        message: error instanceof Error ? error.message : '请稍后重试。',
        variant: 'error',
        confirmLabel: '知道了',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleReview = async (docId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await authFetch(`/api/v1/knowledge/documents/${docId}/review?action=${action}`, { method: 'POST' });
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
          await authFetch(`/api/v1/knowledge/documents/${docId}`, {
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

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-6 pt-24 pb-12">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-800">文档中心</h1>
          <p className="text-slate-500">
            当前收录 {filteredDocs.length} 份文档。所有登录用户可查看知识库内容，上传知识需要先申请上传权限。
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 sm:flex-row md:w-auto">
          <button
            type="button"
            onClick={handleOpenPrimaryAction}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition ${
              canUpload
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700'
                : pendingUploadRequest
                  ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {canUpload ? <Upload size={18} /> : <ShieldAlert size={18} />}
            <span>{canUpload ? '上传知识' : pendingUploadRequest ? '上传权限审批中' : '申请上传权限'}</span>
          </button>

          <div className="group relative w-full md:w-80">
            <div className="absolute inset-0 rounded-xl bg-blue-500/20 blur-lg opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center rounded-xl border border-white/50 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-xl transition-all focus-within:bg-white/80 focus-within:ring-2 focus-within:ring-blue-500/50">
              <Search className="mr-3 text-slate-400" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文档..."
                className="w-full border-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRequestListOpen(true)}
        className="mb-8 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
      >
        <div>
          <div className="text-lg font-semibold text-slate-800">我的权限申请记录</div>
          <div className="mt-1 text-sm text-slate-500">{requestSummaryText}</div>
        </div>
        <div className="flex items-center gap-3">
          {approvedUploadRequest && !canUpload && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              上传权限已通过
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            共 {permissionRequests.length} 条
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </div>
      </button>

      <RequestHistoryModal
        open={requestListOpen}
        requests={permissionRequests}
        showUploadAction={approvedUploadRequest && !canUpload}
        onClose={() => setRequestListOpen(false)}
        onOpenUpload={openUploadFlow}
      />

      <UploadKnowledgeModal
        open={uploadModalOpen}
        uploading={uploading}
        selectedFile={selectedFile}
        chunkSize={chunkSize}
        overlap={overlap}
        onClose={() => {
          if (uploading) return;
          setUploadModalOpen(false);
          resetUploadForm();
        }}
        onFileChange={setSelectedFile}
        onChunkSizeChange={setChunkSize}
        onOverlapChange={setOverlap}
        onSubmit={() => void handleUploadSubmit()}
      />

      <PermissionRequestModal
        open={requestModalOpen}
        applying={applying}
        reason={requestReason}
        onReasonChange={setRequestReason}
        onClose={() => {
          if (applying) return;
          setRequestModalOpen(false);
          setRequestReason('');
        }}
        onSubmit={() => void handleApplyUploadPermission()}
      />

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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
          <FileWarning size={48} className="mx-auto mb-4 opacity-50" />
          <p>当前没有可展示的文档。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filteredDocs.map((doc, idx) => (
              <motion.div
                key={doc.docId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-xl"
              >
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  {canReview && doc.status === 'PENDING_REVIEW' && (
                    <>
                      <button
                        onClick={() => void handleReview(doc.docId, 'APPROVE')}
                        className="rounded-lg bg-white/90 p-1.5 text-emerald-600 shadow-sm hover:bg-emerald-50"
                        title="通过审核"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => void handleReview(doc.docId, 'REJECT')}
                        className="rounded-lg bg-white/90 p-1.5 text-red-500 shadow-sm hover:bg-red-50"
                        title="拒绝"
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleHide(doc.docId)}
                      className="rounded-lg bg-white/80 p-1.5 text-slate-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      title="移除文档"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <button type="button" onClick={() => onOpenPreview(doc.docId, doc.displayName || doc.originalFilename)} className="w-full text-left">
                  <div className={`relative flex h-28 flex-col justify-end p-4 ${gradients[idx % gradients.length]}`}>
                    <div className={`absolute top-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold ${statusColors[doc.status] || 'bg-slate-100 text-slate-500'}`}>
                      {statusLabels[doc.status] || doc.status}
                    </div>
                    <FileText className="absolute top-4 left-4 h-12 w-12 text-white/50" />
                    <div className="absolute right-4 bottom-2 text-xs font-mono text-white/80">
                      {doc.fileType || 'UNK'} / {formatSize(doc.fileSize)}
                    </div>
                  </div>
                </button>

                <div className="p-4">
                  <h3
                    className="mb-2 h-10 line-clamp-2 text-sm font-bold text-slate-800 transition-colors group-hover:text-blue-600"
                    title={doc.displayName || doc.originalFilename}
                  >
                    {doc.displayName || doc.originalFilename}
                  </h3>

                  {doc.errorMessage && (
                    <div className="mb-2 truncate text-[10px] text-red-500" title={doc.errorMessage}>
                      Err: {doc.errorMessage}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between border-t border-slate-50 pt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {formatDateTime(doc.createdAt)}
                    </span>
                    <ChevronRight size={14} className="-translate-x-2 text-blue-500 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenProcessing(doc.docId)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-600 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
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

function RequestHistoryModal({
  open,
  requests,
  showUploadAction,
  onClose,
  onOpenUpload,
}: {
  open: boolean;
  requests: PermissionRequestItem[];
  showUploadAction: boolean;
  onClose: () => void;
  onOpenUpload: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">我的权限申请记录</h3>
            <p className="mt-1 text-sm text-slate-500">这里集中查看你提交过的权限申请与审批状态。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {showUploadAction && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-emerald-800">知识上传申请已通过</div>
              <div className="mt-1 text-xs text-emerald-700">管理员已经批准你的上传权限，现在可以直接去上传知识文档。</div>
            </div>
            <button
              type="button"
              onClick={onOpenUpload}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              去上传
            </button>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
            你还没有提交过任何权限申请。
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {requests.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{formatPermissionLabel(item.permissionCode)}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      资源范围：{formatResourceTypeLabel(item.resourceType)}
                      {item.resourceId ? ` / ${item.resourceId}` : ''}
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{item.reason?.trim() || '未填写申请说明'}</div>
                  </div>
                  <div className="md:text-right">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium ${
                        requestStatusStyles[item.status] || 'border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                    >
                      {formatRequestStatusLabel(item.status)}
                    </span>
                    <div className="mt-2 text-xs text-slate-400">提交时间：{formatDateTime(item.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadKnowledgeModal({
  open,
  uploading,
  selectedFile,
  chunkSize,
  overlap,
  onClose,
  onFileChange,
  onChunkSizeChange,
  onOverlapChange,
  onSubmit,
}: {
  open: boolean;
  uploading: boolean;
  selectedFile: File | null;
  chunkSize: string;
  overlap: string;
  onClose: () => void;
  onFileChange: (file: File | null) => void;
  onChunkSizeChange: (value: string) => void;
  onOverlapChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">上传知识</h3>
            <p className="mt-1 text-sm text-slate-500">这次上传可以单独调整切片规则，只对当前文档生效，不会改动系统全局配置。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-slate-600">切片长度</div>
              <input
                value={chunkSize}
                onChange={(e) => onChunkSizeChange(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="例如 500"
              />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-medium text-slate-600">重叠长度</div>
              <input
                value={overlap}
                onChange={(e) => onOverlapChange(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                placeholder="例如 75"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-600">上传文档</div>
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5">
              <input
                type="file"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
              />
              <div className="mt-3 text-xs text-slate-400">
                {selectedFile ? `已选择：${selectedFile.name}` : '支持上传 Word、PDF、JSONL 等知识文档。'}
              </div>
            </div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {uploading && <Loader2 size={16} className="animate-spin" />}
            {uploading ? '上传中...' : '开始上传'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionRequestModal({
  open,
  applying,
  reason,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  applying: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800">申请上传权限</h3>
            <p className="mt-1 text-sm text-slate-500">当前账号默认只有知识库查看权限。提交申请后，管理员审批通过即可上传知识文档。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <label className="block">
          <div className="mb-2 text-sm font-medium text-slate-600">申请说明</div>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={5}
            placeholder="例如：需要负责工艺文档的日常入库与维护。"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={applying}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {applying && <Loader2 size={16} className="animate-spin" />}
            {applying ? '提交中...' : '提交申请'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Documents;
