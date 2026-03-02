import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ChevronLeft, ChevronRight, FileText, Download, Share2, AlertCircle } from 'lucide-react';

interface FilePreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fileTitle: string;
  citationText?: string; // The text that was cited by AI
}

const FilePreviewDrawer: React.FC<FilePreviewDrawerProps> = ({ isOpen, onClose, fileTitle, citationText }) => {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(12);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[90%] md:w-[75%] lg:w-[60%] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 line-clamp-1">{fileTitle}</h2>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span>版本: v2.4</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>更新时间: 2024-02-10</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="下载">
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

            {/* Main Content Area (Split View) */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left: PDF Viewer (Mock) */}
              <div className="flex-1 bg-slate-100 overflow-y-auto p-8 flex justify-center">
                <div className="bg-white shadow-lg w-full max-w-3xl min-h-[1000px] rounded-sm relative p-12 text-slate-800 font-serif leading-relaxed">
                  {/* Mock Page Content */}
                  <h1 className="text-3xl font-bold mb-8 text-center border-b pb-4">{fileTitle.replace('.pdf', '')}</h1>
                  <p className="mb-4 text-justify">
                    1. 目的<br/>
                    本规程旨在规范压铸车间的安全操作，预防事故发生，保障员工的人身安全和设备的正常运行。
                  </p>
                  <p className="mb-4 text-justify">
                    2. 适用范围<br/>
                    本规程适用于所有进入压铸车间工作的人员，包括操作工、维修工、管理人员及外来访客。
                  </p>
                  
                  {/* Highlighted Section (Simulating AI Citation) */}
                  <div className="relative my-8 group">
                    <div className="absolute -left-6 top-0 bottom-0 w-1 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)] animate-pulse" />
                    <mark className="bg-yellow-100 text-slate-900 px-1 py-0.5 rounded">
                      3.1 设备启动前检查<br/>
                      开机前必须检查油温、油压是否在正常范围内（油温35-55℃，系统压力14-16MPa）。检查安全门限位开关是否灵敏可靠，急停按钮是否复位。
                    </mark>
                    <div className="absolute -right-32 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity arrow-left">
                        AI 引用来源于此
                    </div>
                  </div>

                  <p className="mb-4 text-justify">
                    3.2 运行中注意事项<br/>
                    设备运行时，严禁将头、手伸入模具分型面区域。取件时必须使用专用夹具或机器人，禁止徒手取件。如遇卡模，必须停机并挂牌“维修中”后方可处理。
                  </p>
                  
                  {/* Lorem Ipusm simulation for length */}
                  {Array.from({ length: 10 }).map((_, i) => (
                    <p key={i} className="mb-4 text-slate-300 blur-[1px]">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                    </p>
                  ))}
                </div>
              </div>

              {/* Right: Metadata & Navigation */}
              <div className="w-80 bg-white border-l border-slate-100 flex flex-col hidden lg:flex">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <AlertCircle size={16} className="text-blue-500"/> 
                        相关故障案例
                    </h3>
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <div className="font-medium text-slate-700 mb-1">案例 #2023-019</div>
                            <p className="text-slate-500">操作工未确认急停复位导致模具撞损。</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <div className="font-medium text-slate-700 mb-1">案例 #2022-104</div>
                            <p className="text-slate-500">油温过高导致密封件失效漏油。</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">元数据</h3>
                    <div className="space-y-4 text-xs">
                        <div>
                            <span className="block text-slate-400 mb-1">所属部门</span>
                            <span className="font-medium">生产部 / 压铸一车间</span>
                        </div>
                        <div>
                            <span className="block text-slate-400 mb-1">文档状态</span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded-full">现行有效</span>
                        </div>
                         <div>
                            <span className="block text-slate-400 mb-1">标签</span>
                            <div className="flex flex-wrap gap-1">
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border">安全</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border">操作规程</span>
                            </div>
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