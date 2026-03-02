import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Cpu, Activity, FileText, CheckCircle, Database, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

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

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'system'>('upload');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'system') {
        fetchSystemStatus();
    }
  }, [activeTab]);

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

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-white rounded-2xl p-4 shadow-sm h-fit">
          <div className="text-xs font-bold text-slate-400 uppercase mb-4 px-2">管理控制台</div>
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('upload')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                activeTab === 'upload' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Upload size={18} />
              上传知识
            </button>
            <button 
              onClick={() => setActiveTab('files')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                activeTab === 'files' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText size={18} />
              文件治理
            </button>
            <div className="h-px bg-slate-100 my-2" />
            <button 
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                activeTab === 'system' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
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
                        支持 PDF, DOCX, TXT 格式。文件需小于 50MB。 <br/>系统会自动解析并存入向量数据库。
                    </p>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2">
                        <Upload size={18} /> 选择文件
                    </button>
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
                                        <Cpu size={20}/>
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
                                        <Database size={20}/>
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
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">文件名</th>
                                <th className="px-6 py-4">上传者</th>
                                <th className="px-6 py-4">时间</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[1,2,3].map(i => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-700">压铸工艺规范_V{i}.0.pdf</td>
                                    <td className="px-6 py-4 text-slate-500">Admin</td>
                                    <td className="px-6 py-4 text-slate-400">2024-02-2{i}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;