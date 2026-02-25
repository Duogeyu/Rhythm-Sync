import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Shield, Check, ChevronDown, ChevronUp, X } from 'lucide-react';

// Apple-style non-linear animation settings
const iosEase: [number, number, number, number] = [0.36, 0.66, 0.04, 1];
const appleSpring = { type: "spring" as const, stiffness: 350, damping: 35, mass: 1 };

interface PrivacyModalProps {
    isOpen: boolean;
    onAccept: () => void;
    onDecline: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onAccept, onDecline }) => {
    const { t } = useTranslation();
    const [showFullPolicy, setShowFullPolicy] = useState(false);
    const [isChecked, setIsChecked] = useState(false);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* 背景遮罩 */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500]"
                        onClick={onDecline}
                    />

                    {/* 模态框 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.4, ease: iosEase }}
                        className="fixed inset-0 flex items-center justify-center z-[501] p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto">
                            {/* 头部 */}
                            <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-5">
                                <div className="absolute inset-0 bg-white/10 skew-x-12 transform translate-x-1/2" />
                                <div className="relative z-10 flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <Shield className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-tight">
                                            {t('privacy.title')}
                                        </h2>
                                        <p className="text-sm text-white/80 font-medium">
                                            {t('privacy.subtitle')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onDecline}
                                    className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>

                            {/* 内容区 */}
                            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
                                {/* 摘要 */}
                                <div className="mb-4">
                                    <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                                        {t('privacy.summary.title')}
                                    </h3>
                                    <ul className="space-y-2 text-sm text-slate-600">
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{t('privacy.summary.point1')}</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{t('privacy.summary.point2')}</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{t('privacy.summary.point3')}</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{t('privacy.summary.point4')}</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* 展开完整协议按钮 */}
                                <button
                                    onClick={() => setShowFullPolicy(!showFullPolicy)}
                                    className="w-full flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors mb-4"
                                >
                                    <span className="text-sm font-bold text-slate-600">
                                        {showFullPolicy ? t('privacy.hidePolicy') : t('privacy.showPolicy')}
                                    </span>
                                    {showFullPolicy ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </button>

                                {/* 完整协议 */}
                                <AnimatePresence>
                                    {showFullPolicy && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-4 mb-4 max-h-[30vh] overflow-y-auto">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 mb-2">{t('privacy.policy.section1.title')}</h4>
                                                    <p>{t('privacy.policy.section1.content')}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 mb-2">{t('privacy.policy.section2.title')}</h4>
                                                    <p>{t('privacy.policy.section2.content')}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 mb-2">{t('privacy.policy.section3.title')}</h4>
                                                    <p>{t('privacy.policy.section3.content')}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 mb-2">{t('privacy.policy.section4.title')}</h4>
                                                    <p>{t('privacy.policy.section4.content')}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 mb-2">{t('privacy.policy.section5.title')}</h4>
                                                    <p>{t('privacy.policy.section5.content')}</p>
                                                </div>
                                                <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                                                    {t('privacy.policy.lastUpdate')}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* 同意复选框 */}
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => setIsChecked(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <motion.div
                                            whileTap={{ scale: 0.9 }}
                                            transition={appleSpring}
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isChecked
                                                    ? 'bg-cyan-500 border-cyan-500'
                                                    : 'bg-white border-slate-300 group-hover:border-cyan-400'
                                                }`}
                                        >
                                            {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                        </motion.div>
                                    </div>
                                    <span className="text-sm text-slate-600 leading-tight">
                                        {t('privacy.agree')}
                                    </span>
                                </label>
                            </div>

                            {/* 底部按钮 */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button
                                    onClick={onDecline}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all active:scale-[0.98]"
                                >
                                    {t('privacy.decline')}
                                </button>
                                <motion.button
                                    whileHover={{ scale: isChecked ? 1.02 : 1 }}
                                    whileTap={{ scale: isChecked ? 0.98 : 1 }}
                                    onClick={() => isChecked && onAccept()}
                                    disabled={!isChecked}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${isChecked
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    {t('privacy.accept')}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default PrivacyModal;
