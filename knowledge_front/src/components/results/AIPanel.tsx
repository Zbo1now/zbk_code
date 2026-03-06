import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, CheckCircle2, Copy, AlertTriangle, FileQuestion } from 'lucide-react';

interface AIPanelProps {
  answer: string;
  loading: boolean;
  complete: boolean;
  sources: Array<{ id: string; title: string; summary: string; score: number; docId?: string }>;
  onCitationClick?: (index: number) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ answer, loading, complete, sources, onCitationClick }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  // 严格检查“无答案”场景
  const isNoAnswer = answer.includes('未找到相关对策') || answer.includes('未找到相关内容');

  // 如果答案完全改变，清除效果
  useEffect(() => {
    if (loading) {
      setDisplayedText('');
    } else if (complete) {
      setDisplayedText(answer); // 如果完成，显示全文
    } else {
        // 模拟流式打字（但这里可能只是更改全文）
        let i = 0;
        const interval = setInterval(() => {
          setDisplayedText(prev => {
            if (i < answer.length) {
              i++;
              return answer.substring(0, i);
            }
            clearInterval(interval);
            return prev;
          });
        }, 30); // 速度
        return () => clearInterval(interval);
    }
  }, [answer, loading, complete]);

  const renderAnswerWithCitations = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const source = sources[num - 1];
        return (
          <button
            key={`cite-${index}`}
            type="button"
            className="ml-1 inline-flex items-center rounded-full bg-blue-50 text-blue-600 text-xs px-2 py-0.5 hover:bg-blue-100 transition-colors"
            title={source ? source.title : '未匹配到来源'}
            onClick={() => onCitationClick && onCitationClick(num - 1)}
          >
            [{num}]
          </button>
        );
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  if (isNoAnswer && complete && !loading) {
      return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 border-l-4 border-l-amber-400 relative overflow-hidden"
        >
             <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-50 rounded-full text-amber-500 shrink-0">
                    <FileQuestion size={24} />
                </div>
                <div>
                     <h3 className="text-lg font-bold text-slate-800 mb-2">未找到相关对策</h3>
                     <p className="text-slate-600 leading-relaxed mb-4">
                        知识库中似乎没有包含与您问题直接相关的文档。
                     </p>
                     <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                        <p className="text-sm font-semibold text-amber-800 mb-2">建议您尝试：</p>
                        <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                            <li>精简搜索关键词（例如：将“详细的压铸模具热处理工艺流程”简化为“模具热处理”）</li>
                            <li>检查是否有错别字</li>
                            <li>确认相关技术文档是否已上传并建立索引</li>
                        </ul>
                     </div>
                </div>
             </div>
        </motion.div>
      )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 md:p-8 relative overflow-hidden group"
    >
      {/* 装饰性渐变背景 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/50 to-purple-100/30 rounded-bl-full pointer-events-none -mr-16 -mt-16"></div>

      {/* 头部 */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 rounded-lg bg-blue-100 text-blue-600 shadow-sm ring-1 ring-blue-200">
          <Lightbulb size={20} className={loading ? "animate-pulse" : ""} />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">
          {loading ? "AI 正在思考..." : "智能综述"}
        </h2>
        
        {!loading && (
          <div className="ml-auto flex gap-2">
            <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
              <Copy size={16} />
            </button>
            <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <CheckCircle2 size={12} />
              已完成
            </div>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="prose prose-slate prose-lg max-w-none relative z-10 min-h-[200px]">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-600 leading-relaxed whitespace-pre-wrap"
            >
              {renderAnswerWithCitations(displayedText)}
              <motion.span 
                animate={{ opacity: [0, 1, 0] }} 
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="inline-block w-2 h-4 bg-blue-500 ml-1 align-middle"
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* 引用页脚（模拟） */}
      {!loading && (
        <div className="mt-8 pt-6 border-t border-slate-100 flex gap-2 flex-wrap text-sm text-slate-500">
          <span className="font-medium mr-2">参考来源:</span>
          {sources.slice(0, 6).map((source, idx) => (
            <button
              key={source.id}
              type="button"
              onClick={() => onCitationClick && onCitationClick(idx)}
              className="px-2 py-1 bg-slate-100 rounded text-xs text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
              title={source.title}
            >
              [{idx + 1}] {source.title}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AIPanel;
