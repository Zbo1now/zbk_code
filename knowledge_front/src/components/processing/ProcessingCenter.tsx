import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock3,
  Eye,
  FileStack,
  FileText,
  Layers3,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  X,
} from 'lucide-react';

type DocStatus =
  | 'UPLOADED'
  | 'INDEXED'
  | 'FAILED'
  | 'PARSING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

interface DocumentItem {
  docId: string;
  originalFilename: string;
  displayName?: string;
  fileType?: string;
  status: DocStatus;
  createdAt: string;
  errorMessage?: string;
}

interface ProcessingResponse {
  docId: string;
  fileType: string;
  documentStatus: string;
  supported: boolean;
  currentStep?: string | null;
  currentStatus?: string | null;
  message?: string | null;
  updatedAt?: string | null;
  steps: Array<{
    step: string;
    status: string;
    message?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }>;
  chunkStats?: {
    totalChunks?: number | null;
    averageLength?: number | null;
    overlap?: number | null;
    chunkSize?: number | null;
  } | null;
  errorMessage?: string | null;
}

interface ChunkPreviewResponse {
  docId: string;
  supported: boolean;
  message?: string | null;
  chunkStats?: {
    totalChunks?: number | null;
    averageLength?: number | null;
    overlap?: number | null;
    chunkSize?: number | null;
  } | null;
  chunks: Array<{
    chunkId: string;
    chunkIndex?: number | null;
    pageNum?: number | null;
    length?: number | null;
    title?: string | null;
    content: string;
  }>;
}

interface ProcessingCenterProps {
  focusDocId?: string | null;
  onConsumeFocus?: () => void;
}

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

const formatDateTime = (value: string) => {
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

const docStatusMap: Record<string, { label: string; tone: string }> = {
  UPLOADED: { label: '已上传', tone: 'bg-sky-100 text-sky-700 border-sky-200' },
  INDEXED: { label: '已索引', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FAILED: { label: '失败', tone: 'bg-red-100 text-red-700 border-red-200' },
  PARSING: { label: '解析中', tone: 'bg-amber-100 text-amber-700 border-amber-200' },
  PENDING_REVIEW: { label: '待审核', tone: 'bg-violet-100 text-violet-700 border-violet-200' },
  APPROVED: { label: '已通过', tone: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  REJECTED: { label: '已拒绝', tone: 'bg-slate-200 text-slate-500 border-slate-300' },
};

const stepStatusMap: Record<string, { label: string; tone: string; dot: string }> = {
  PENDING: { label: '待执行', tone: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-300' },
  RUNNING: { label: '进行中', tone: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500 ring-4 ring-blue-100' },
  SUCCESS: { label: '已完成', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  FAILED: { label: '失败', tone: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  SKIPPED: { label: '暂不支持', tone: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

const stepLabelMap: Record<string, string> = {
  UPLOAD: '上传',
  REVIEW: '审核',
  PARSE: '解析',
  CHUNK: '切片',
  EMBED: '向量化',
  INDEX_ES: 'ES 入库',
  INDEX_QDRANT: 'Qdrant 入库',
  COMPLETE: '完成',
};

const getDisplayStepStatus = (
  stepStatus: string,
  hasFailedStep: boolean
) => {
  if (hasFailedStep && stepStatus === 'RUNNING') {
    return 'FAILED';
  }
  return stepStatus;
};

const ProcessingCenter = ({ focusDocId, onConsumeFocus }: ProcessingCenterProps) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(focusDocId || null);
  const [processing, setProcessing] = useState<ProcessingResponse | null>(null);
  const [chunkPreview, setChunkPreview] = useState<ChunkPreviewResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [detailChunk, setDetailChunk] = useState<ChunkPreviewResponse['chunks'][number] | null>(null);

  const selectedDoc = useMemo(
    () => docs.find((doc) => doc.docId === selectedDocId) || null,
    [docs, selectedDocId]
  );

  const previewChunks = chunkPreview?.chunks || [];
  const summaryStats = chunkPreview?.chunkStats || processing?.chunkStats;
  const hasFailedStep = (processing?.steps || []).some((step) => step.status === 'FAILED');

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/v1/knowledge/documents?page=1&pageSize=100&includeHidden=true');
      if (!res.ok) return;
      const data = await res.json();
      const items = ((data.items || []) as DocumentItem[]).sort(
        (a, b) => parseDateValue(b.createdAt).getTime() - parseDateValue(a.createdAt).getTime()
      );
      setDocs(items);
      setSelectedDocId((prev) => prev || items[0]?.docId || null);
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchDetail = async (docId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/v1/knowledge/documents/${docId}/processing`);
      if (!res.ok) return;
      const data = await res.json();
      setProcessing(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchChunkPreview = async (docId: string) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/v1/knowledge/documents/${docId}/chunk-preview`);
      if (!res.ok) return;
      const data = await res.json();
      setChunkPreview(data);
      setDetailChunk(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    if (focusDocId) {
      setSelectedDocId(focusDocId);
      onConsumeFocus?.();
    }
  }, [focusDocId, onConsumeFocus]);

  useEffect(() => {
    if (!selectedDocId) return;
    setDetailChunk(null);
    fetchDetail(selectedDocId);
    fetchChunkPreview(selectedDocId);
  }, [selectedDocId]);

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">文档处理</h1>
          <p className="text-slate-500">观察上传、审核、解析、切片和索引写入的完整流程，并查看当前切片结果。</p>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchDocs();
            if (selectedDocId) {
              fetchDetail(selectedDocId);
              fetchChunkPreview(selectedDocId);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 backdrop-blur border border-slate-200 text-slate-600 hover:bg-white shadow-sm"
        >
          <RefreshCcw size={16} />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <section className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 text-slate-700 font-semibold">
            <FileStack size={18} />
            处理任务
          </div>
          <div className="max-h-[760px] overflow-y-auto">
            {loadingDocs ? (
              <div className="py-16 flex justify-center text-slate-300">
                <Loader2 className="animate-spin" size={28} />
              </div>
            ) : docs.length === 0 ? (
              <div className="px-5 py-12 text-sm text-slate-400 text-center">暂无文档处理记录</div>
            ) : (
              docs.map((doc) => {
                const active = doc.docId === selectedDocId;
                const statusMeta = docStatusMap[doc.status] || docStatusMap.UPLOADED;
                const isWord = ['DOC', 'DOCX'].includes((doc.fileType || '').toUpperCase());
                return (
                  <button
                    key={doc.docId}
                    type="button"
                    onClick={() => setSelectedDocId(doc.docId)}
                    className={`w-full text-left px-5 py-4 border-b border-slate-50 transition-colors ${
                      active ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {doc.displayName || doc.originalFilename}
                        </div>
                        <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                          <span>{(doc.fileType || 'UNKNOWN').toUpperCase()}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span>{formatDateTime(doc.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-medium ${statusMeta.tone}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="mt-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${isWord ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isWord ? '支持切片预览' : '仅状态占位'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!selectedDoc ? (
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-dashed border-slate-200 py-20 text-center text-slate-400">
              请选择一份文档查看处理详情
            </div>
          ) : (
            <>
              <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="grid grid-cols-1 2xl:grid-cols-[0.9fr_1.15fr] gap-6 items-start">
                  <div>
                    <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-slate-400 mb-2 uppercase">
                      <Activity size={14} />
                      Processing
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {selectedDoc.displayName || selectedDoc.originalFilename}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge label={(processing?.fileType || selectedDoc.fileType || 'UNKNOWN').toUpperCase()} tone="bg-slate-100 text-slate-600 border-slate-200" />
                      <Badge
                        label={(docStatusMap[processing?.documentStatus || selectedDoc.status] || docStatusMap.UPLOADED).label}
                        tone={(docStatusMap[processing?.documentStatus || selectedDoc.status] || docStatusMap.UPLOADED).tone}
                      />
                      {!processing?.supported && (
                        <Badge label="当前仅状态占位" tone="bg-amber-50 text-amber-700 border-amber-200" />
                      )}
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-2 sm:grid-cols-4 gap-3 min-w-0 self-stretch">
                    <MetricCard icon={ShieldCheck} label="文档状态" value={(docStatusMap[processing?.documentStatus || selectedDoc.status] || docStatusMap.UPLOADED).label} />
                    <MetricCard icon={Layers3} label="切片数量" value={summaryStats?.totalChunks ?? '--'} />
                    <MetricCard icon={Activity} label="当前步骤" value={stepLabelMap[processing?.currentStep || ''] || '--'} />
                    <MetricCard icon={Clock3} label="最近更新" value={processing?.updatedAt ? formatShortTime(processing.updatedAt) : '--'} />
                  </div>
                </div>
                <div className="mt-5 text-sm text-slate-500">
                  {loadingDetail ? '正在刷新处理详情...' : processing?.message || '正在等待处理状态更新。'}
                </div>
                {processing?.errorMessage && (
                  <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {processing.errorMessage}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1.05fr] gap-6">
                <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold mb-6">
                    <Activity size={18} />
                    流程时间线
                  </div>
                  <div className="space-y-4">
                    {(processing?.steps || []).map((step, index) => {
                      const displayStatus = getDisplayStepStatus(step.status, hasFailedStep);
                      const statusMeta = stepStatusMap[displayStatus] || stepStatusMap.PENDING;
                      return (
                        <motion.div
                          key={`${step.step}-${index}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative pl-8"
                        >
                          <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ${statusMeta.dot}`} />
                          {index < (processing?.steps.length || 0) - 1 && (
                            <div className="absolute left-[5px] top-5 w-[2px] h-[calc(100%+8px)] bg-slate-100" />
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-800">{stepLabelMap[step.step] || step.step}</div>
                              <div className="text-sm text-slate-500 mt-1">{step.message || '等待执行'}</div>
                            </div>
                            <Badge label={statusMeta.label} tone={statusMeta.tone} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold mb-5">
                      <Layers3 size={18} />
                      切片统计
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCell label="总切片数" value={summaryStats?.totalChunks ?? '--'} />
                      <StatCell label="平均长度" value={summaryStats?.averageLength ?? '--'} />
                      <StatCell label="重叠长度" value={summaryStats?.overlap ?? '--'} />
                      <StatCell label="目标长度" value={summaryStats?.chunkSize ?? '--'} />
                    </div>
                    <div className="mt-4 text-sm text-slate-500">
                      {loadingPreview ? '正在刷新切片预览...' : chunkPreview?.message || '切片生成后会在这里展示统计信息。'}
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <FileText size={18} />
                        切片预览
                      </div>
                      <div className="text-xs text-slate-400">
                        {previewChunks.length > 0 ? `当前展示 ${previewChunks.length} / ${summaryStats?.totalChunks ?? previewChunks.length}` : '暂无切片'}
                      </div>
                    </div>
                    {!chunkPreview?.supported ? (
                      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        当前仅支持 Word 文档切片预览，PDF 先展示处理状态占位。
                      </div>
                    ) : previewChunks.length === 0 ? (
                      <div className="text-sm text-slate-400">暂无切片内容，请先完成处理后刷新。</div>
                    ) : (
                      <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                        {previewChunks.map((chunk) => (
                          <button
                            key={chunk.chunkId}
                            type="button"
                            onClick={() => setDetailChunk(chunk)}
                            className="w-full text-left rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-blue-50 hover:border-blue-100 p-4 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="font-medium text-slate-700 truncate">{chunk.chunkId}</div>
                              <div className="text-xs text-slate-400 shrink-0">
                                第 {typeof chunk.chunkIndex === 'number' ? chunk.chunkIndex + 1 : '--'} 片
                              </div>
                            </div>
                            <div className="text-sm text-slate-600 leading-6 whitespace-pre-wrap line-clamp-3">
                              {chunk.content}
                            </div>
                            <div className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600">
                              <Eye size={13} />
                              查看详情
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {detailChunk && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm"
            onClick={() => setDetailChunk(null)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-800 truncate">{detailChunk.chunkId}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    第 {typeof detailChunk.chunkIndex === 'number' ? detailChunk.chunkIndex + 1 : '--'} 片
                    {detailChunk.length ? ` · ${detailChunk.length} 字` : ''}
                    {typeof detailChunk.pageNum === 'number' ? ` · 页码 ${detailChunk.pageNum}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailChunk(null)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(88vh-74px)]">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 mb-4">
                  标题：{detailChunk.title || '未命名'}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {detailChunk.content}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Badge = ({ label, tone }: { label: string; tone: string }) => (
  <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full border text-xs font-medium ${tone}`}>{label}</span>
);

const MetricCard = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 min-w-0">
    <div className="mb-2 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-400">
      <Icon size={12} className="shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </div>
    <div className="whitespace-nowrap text-[15px] font-semibold leading-5 text-slate-700">{value}</div>
  </div>
);

const StatCell = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <div className="text-xs text-slate-400 mb-2">{label}</div>
    <div className="text-lg font-semibold text-slate-700">{value}</div>
  </div>
);

const formatShortTime = (value: string) => {
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export default ProcessingCenter;
