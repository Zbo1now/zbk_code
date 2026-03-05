import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface ActionDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  variant?: 'success' | 'warning' | 'error' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500 bg-emerald-50',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500 bg-amber-50',
    confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500 bg-red-50',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  info: {
    icon: AlertTriangle,
    iconClass: 'text-blue-500 bg-blue-50',
    confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

const ActionDialog: React.FC<ActionDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  showCancel = false,
  variant = 'info',
  onConfirm,
  onCancel,
}) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <div className="px-6 pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.iconClass}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-800">{title}</div>
                  {message && <div className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</div>}
                </div>
              </div>
            </div>
            <div className="px-6 py-5 flex justify-end gap-3">
              {showCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-xl shadow-sm transition-colors ${config.confirmClass}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActionDialog;
