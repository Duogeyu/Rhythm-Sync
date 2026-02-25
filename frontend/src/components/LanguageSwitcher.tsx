import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';

export default function LanguageSwitcher() {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const switchLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        localStorage.setItem('language', lang);
        setIsOpen(false);
    };

    return (
        <div className="relative z-[300]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white/80 hover:text-white transition-all text-sm"
            >
                <Globe className="w-4 h-4" />
                <span>{t(`language.${i18n.language}`)}</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* 点击外部关闭 */}
                        <div
                            className="fixed inset-0 z-[299]"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute right-0 mt-2 py-1 bg-slate-800 rounded-lg shadow-xl border border-white/10 overflow-hidden z-[300] min-w-[120px]"
                        >
                            {['zh-CN', 'en-US'].map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => switchLanguage(lang)}
                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${i18n.language === lang ? 'text-cyan-400' : 'text-white/80'
                                        }`}
                                >
                                    {t(`language.${lang}`)}
                                    {i18n.language === lang && <Check className="w-4 h-4" />}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
