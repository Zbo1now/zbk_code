import React from 'react';
import { motion } from 'framer-motion';
import { Search, FileText, Tag, Clock, ChevronRight } from 'lucide-react';

interface DocCardProps {
  title: string;
  category: string;
  date: string;
  tags: string[];
  coverColor: string;
}

const DocCard: React.FC<DocCardProps & { onClick: () => void }> = ({ title, category, date, tags, coverColor, onClick }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    onClick={onClick}
    className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden cursor-pointer"
  >
    {/* Cover Preview Area */}
    <div className={`h-32 ${coverColor} relative p-4 flex flex-col justify-end`}>
      <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-medium">
        {category}
      </div>
      <FileText className="text-white/50 absolute top-4 left-4 w-16 h-16" />
    </div>

    {/* Content Area */}
    <div className="p-4">
      <h3 className="font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
        {title}
      </h3>
      
      <div className="flex flex-wrap gap-1 mb-3">
        {tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border border-slate-200 flex items-center gap-1">
            <Tag size={8} /> {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 mt-2 border-t border-slate-50 pt-2">
        <span className="flex items-center gap-1">
          <Clock size={10} /> {date}
        </span>
        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-blue-500" />
      </div>
    </div>
  </motion.div>
);

interface DocumentsProps {
  onOpenPreview: (docTitle: string) => void;
}

const Documents: React.FC<DocumentsProps> = ({ onOpenPreview }) => {
    // Mock Data
    const docs = [
        { title: "压铸车间安全操作规程_2024版.pdf", category: "安全规范", date: "2024-02-15", tags: ["安全", "车间"], coverColor: "bg-gradient-to-br from-red-400 to-orange-500" },
        { title: "H13模具钢热处理工艺参数表.pdf", category: "工艺参数", date: "2023-11-20", tags: ["热处理", "H13"], coverColor: "bg-gradient-to-br from-blue-400 to-indigo-500" },
        { title: "DCC280压铸机维护保养手册.pdf", category: "设备维护", date: "2023-10-05", tags: ["设备", "保养"], coverColor: "bg-gradient-to-br from-emerald-400 to-teal-500" },
        { title: "铝合金压铸件常见缺陷分析与对策.pdf", category: "质量控制", date: "2024-01-10", tags: ["缺陷", "质量"], coverColor: "bg-gradient-to-br from-purple-400 to-pink-500" },
        { title: "由铸造向智能制造转型的路径探索.pdf", category: "行业趋势", date: "2023-12-01", tags: ["智能制造", "转型"], coverColor: "bg-gradient-to-br from-slate-500 to-slate-700" },
        { title: "新型镁合金材料在汽车轻量化中的应用.pdf", category: "新材料", date: "2024-03-01", tags: ["镁合金", "轻量化"], coverColor: "bg-gradient-to-br from-amber-400 to-yellow-500" },
        { title: "熔炼工段作业指导书.pdf", category: "工艺参数", date: "2024-01-20", tags: ["熔炼", "作业指导"], coverColor: "bg-gradient-to-br from-blue-400 to-indigo-500" },
        { title: "压铸岛机器人自动化集成方案.pdf", category: "设备维护", date: "2023-11-15", tags: ["自动化", "机器人"], coverColor: "bg-gradient-to-br from-emerald-400 to-teal-500" }
    ];

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">文档中心</h1>
          <p className="text-slate-500">已收录 3,420 份技术文档，覆盖工艺、设备、质量等 12 个领域</p>
        </div>

        {/* Glassmorphism Search Bar */}
        <div className="relative group w-full md:w-96">
          <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:bg-white/80 transition-all">
            <Search className="text-slate-400 mr-3" size={20} />
            <input 
              type="text" 
              placeholder="搜索文档名称、编号..." 
              className="bg-transparent border-none outline-none w-full text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Tabs / Filters (Optional for now) */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {["全部", "安全规范", "工艺参数", "设备维护", "质量控制", "行业趋势"].map((tab, i) => (
          <button 
            key={tab}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
              i === 0 
              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/30' 
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Document Grid (Waterfall-ish) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {docs.map((doc, idx) => (
            <DocCard key={idx} {...doc} onClick={() => onOpenPreview(doc.title)} />
        ))}
      </div>
    </div>
  );
};

export default Documents;