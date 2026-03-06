import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowUpRight, Layers } from 'lucide-react';

interface Source {
  id: string;
  title: string;
  summary: string;
  score: number;
  docId?: string;
  fileType?: string;
  pageStart?: number | null;
  pageEnd?: number | null;
}

interface SourceBarProps {
  sources: Source[];
  onOpenPreview: (docId: string | undefined, docTitle: string, citation: string) => void;
}

const SourceBar: React.FC<SourceBarProps> = ({ sources, onOpenPreview }) => {
  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div className="text-sm text-slate-500 font-medium mb-2 pl-1 sticky left-0 z-10 flex items-center gap-2">
        <Layers size={14} className="text-blue-500" />
        证据来源 ({sources.length})
      </div>
      <div className="flex gap-4 min-w-max px-1">
        {sources.map((source, index) => (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onOpenPreview(source.docId, source.title, source.summary)}
            className="w-64 glass-card p-4 hover:shadow-xl hover:scale-105 transition-all cursor-pointer group flex flex-col justify-between h-40 border-l-4 border-l-blue-400/50 bg-white/60"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText size={16} />
                </div>
                <div className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  [{index + 1}] {(source.score * 100).toFixed(0)}%
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {source.fileType || 'DOC'}
                </span>
                {source.pageStart != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    P.{source.pageStart}{source.pageEnd && source.pageEnd !== source.pageStart ? `-${source.pageEnd}` : ''}
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
                {source.title}
              </h4>
            </div>
            
            <div className="mt-3 flex items-end justify-between">
              <span className="text-xs text-slate-400 line-clamp-1">
                {source.pageStart != null ? `P.${source.pageStart}` : '命中片段'}
              </span>
              <ArrowUpRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </motion.div>
        ))}
        
        {/* 查看全部卡片 */}
        <div className="w-32 flex items-center justify-center glass-card border-dashed border-2 border-slate-300 hover:border-blue-400 cursor-pointer text-slate-400 hover:text-blue-500 transition-all group">
          <div className="text-center">
            <span className="block text-sm font-medium group-hover:scale-110 transition-transform">查看全部</span>
            <span className="text-xs text-slate-300">+{sources.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceBar;
