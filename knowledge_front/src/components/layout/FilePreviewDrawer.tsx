import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Download, Share2, AlertCircle } from 'lucide-react';

interface FilePreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fileTitle: string;
  citationText?: string; // AI 引用的文本
  docId?: string;
}

const FilePreviewDrawer: React.FC<FilePreviewDrawerProps> = ({ isOpen, onClose, fileTitle, citationText, docId }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    fileType?: string | null;
    status?: string | null;
    fileSize?: number | null;
    createdAt?: string | null;
    hidden?: boolean | null;
    checksum?: string | null;
    displayName?: string | null;
    description?: string | null;
    originalFilename?: string | null;
  } | null>(null);

  const statusLabel = (value?: string | null) => {
    switch (value) {
      case 'PENDING_REVIEW':
        return '待审核';
      case 'APPROVED':
        return '审核通过';
      case 'PARSING':
        return '解析中';
      case 'INDEXED':
        return '已索引';
      case 'FAILED':
        return '解析失败';
      case 'REJECTED':
        return '已拒绝';
      case 'UPLOADED':
        return '已上传';
      default:
        return value || '未知';
    }
  };

  useEffect(() => {
    if (!isOpen || !docId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/knowledge/documents/${docId}/preview`)
      .then(async (res) => {
        if (!res.ok) throw new Error('预览加载失败');
        return res.json();
      })
      .then((data) => {
        setContent(data?.content || '');
        setPreviewMeta({
          fileType: data?.fileType || null,
          status: data?.status || null,
          fileSize: typeof data?.fileSize === 'number' ? data.fileSize : null,
          createdAt: data?.createdAt || null,
          hidden: typeof data?.hidden === 'boolean' ? data.hidden : null,
          checksum: data?.checksum || null,
          displayName: data?.displayName || null,
          description: data?.description || null,
          originalFilename: data?.originalFilename || null,
        });
        if (data?.errorMessage) {
          setError(data.errorMessage);
        }
      })
      .catch((err) => {
        setError(err.message || '预览加载失败');
      })
      .finally(() => setLoading(false));
  }, [isOpen, docId]);

  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setError(null);
      setPreviewMeta(null);
    }
  }, [isOpen]);

  // 当内容和引用文本准备好时，确保在抽屉动画完毕并且 DOM 稳定后精准滚动
  useEffect(() => {
    if (!loading && content && citationText && highlightRef.current) {
      // 延迟确保侧边栏划出动画（通常 300-500ms）完成后再进行计算和滚动，避免动画过程中的坐标错位
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400); 
      return () => clearTimeout(timer);
    }
  }, [loading, content, citationText]);

  // 高亮处理逻辑
  const renderContent = () => {
    if (!content) return '暂无可预览内容';
    if (!citationText) return content;

    let index = content.indexOf(citationText);
    let matchedText = citationText;

    // 严苛的完全匹配如果失败，尝试忽略空白符、换行符的容错正则匹配
    if (index === -1) {
      try {
        const trimmedCitation = citationText.trim();
        if (trimmedCitation.length > 2) {
          // 将普通文本中的各种连续空白、换行符替换为正则的 \s+
          const regexStr = trimmedCitation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
          const regex = new RegExp(regexStr, 'i');
          const match = content.match(regex);
          if (match && match.index !== undefined) {
            index = match.index;
            matchedText = match[0];
          } else {
             // 二次退保：只取一小段开头（比如前 20 个字符）进行精准匹配，防止末尾被大模型截断或增添字符
             const shortCitation = trimmedCitation.substring(0, Math.min(20, trimmedCitation.length));
             const shortRegexStr = shortCitation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
             const shortRegex = new RegExp(shortRegexStr, 'i');
             const shortMatch = content.match(shortRegex);
             if (shortMatch && shortMatch.index !== undefined) {
                index = shortMatch.index;
                matchedText = shortMatch[0];
             }
          }
        }
      } catch (e) {
        console.error("高亮正则匹配发生错误", e);
      }
    }

    if (index === -1) return content;

    const before = content.substring(0, index);
    const after = content.substring(index + matchedText.length);

    return (
      <>
        {before}
        <span ref={highlightRef} className="bg-yellow-200 text-slate-900 px-1 rounded-sm ring-2 ring-yellow-400 font-medium transition-colors duration-500">
          {matchedText}
        </span>
        {after}
      </>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
          />

          {/* 抽屉容器 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[90%] md:w-[75%] lg:w-[60%] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-200"
          >
            {/* 头部 */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 line-clamp-1">{fileTitle}</h2>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    {previewMeta?.fileType && <span>格式: {previewMeta.fileType}</span>}
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>状态: {statusLabel(previewMeta?.status)}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                  title="下载"
                  onClick={() => {
                    if (docId) window.open(`/api/v1/knowledge/documents/${docId}/download`, '_blank');
                  }}
                >
                  <Download size={18} />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="分享">
                  <Share2 size={18} />
                </button>
                <div className="w-px h-6 bg-slate-200 mx-2" />
                <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 主要内容区域（分栏视图） */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* 左侧：阅读器 */}
              <div ref={scrollContainerRef} className="flex-1 bg-white overflow-y-auto border-r border-slate-100 scroll-smooth">
                <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 lg:px-10 py-8">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 lg:p-10 text-slate-800 leading-relaxed">
                    <h1 className="text-xl sm:text-2xl font-bold mb-6 text-center border-b pb-3">{previewMeta?.displayName || fileTitle}</h1>
                  {loading && (
                    <div className="text-sm text-slate-400 italic">正在加载文档内容...</div>
                  )}
                  {error && (
                    <div className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle size={14} /> 预览失败: {error}
                    </div>
                  )}
                  {!loading && !error && (
                    <pre className="whitespace-pre-wrap text-[13px] sm:text-sm leading-7 text-slate-700 font-sans tracking-wide">
                      {renderContent()}
                    </pre>
                  )}
                  {citationText && (
                    <div className="mt-8 p-5 bg-blue-50/50 border border-blue-100 rounded-xl text-sm text-slate-700 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />
                      <div className="font-bold text-blue-700 mb-2 flex items-center gap-2">
                        <Share2 size={14} /> AI 引用片段溯源
                      </div>
                      <div className="whitespace-pre-wrap text-slate-600 text-xs leading-5 italic bg-white/50 p-3 rounded-lg border border-blue-50">
                        {citationText}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>

                {/* 右侧：真实元数据 */}
                <div className="w-80 bg-white border-l border-slate-100 flex flex-col hidden lg:flex">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertCircle size={16} className="text-blue-500"/> 
                    文档概览
                  </h3>
                  {previewMeta?.description ? (
                    <div className="text-xs text-slate-600 leading-6 bg-slate-50 border border-slate-100 rounded-lg p-3">
                    {previewMeta.description}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">暂无文档备注</div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">文档信息</h3>
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="block text-slate-400 mb-1">文档ID</span>
                      <span className="font-medium text-slate-700 break-all">{docId || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-1">原始文件名</span>
                      <span className="font-medium text-slate-700 break-all">{previewMeta?.originalFilename || fileTitle}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-1">文件大小</span>
                      <span className="font-medium text-slate-700">
                        {typeof previewMeta?.fileSize === 'number'
                        ? previewMeta.fileSize < 1024 * 1024
                          ? `${(previewMeta.fileSize / 1024).toFixed(1)} KB`
                          : `${(previewMeta.fileSize / (1024 * 1024)).toFixed(1)} MB`
                        : '未知'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-1">上传时间</span>
                      <span className="font-medium text-slate-700">
                        {previewMeta?.createdAt ? new Date(previewMeta.createdAt).toLocaleString() : '未知'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-1">状态</span>
                      <span className="inline-flex w-fit px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {statusLabel(previewMeta?.status)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-1">可见性</span>
                      <span className={`inline-flex w-fit px-2 py-0.5 rounded-full ${previewMeta?.hidden ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {previewMeta?.hidden ? '已隐藏' : '可见'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 mb-1">校验和</span>
                      <span className="font-medium text-slate-700 break-all">{previewMeta?.checksum || '未知'}</span>
                    </div>
                  </div>
                </div>
                </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FilePreviewDrawer;