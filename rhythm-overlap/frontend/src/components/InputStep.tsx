import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Music, ChevronRight, Link2, FileText } from 'lucide-react';
import { iosEase, appleSpring } from '../config/games';
import { parseInput, type ParsedInput, type PlatformType } from '../services/api';

// 平台配置
const PLATFORM_CONFIG: Record<string, { 
    color: string; 
    bgColor: string; 
    borderColor: string;
    icon: React.ReactNode;
    gradient: string;
    logoUrl?: string;
}> = {
    netease: {
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        gradient: 'from-red-400 to-red-600',
        logoUrl: '/logos/platforms/netease.svg',
        icon: <img src="/logos/platforms/netease.svg" alt="网易云音乐" className="w-5 h-5" />
    },
    qqmusic: {
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        gradient: 'from-green-400 to-green-600',
        logoUrl: '/logos/platforms/qqmusic.svg',
        icon: <img src="/logos/platforms/qqmusic.svg" alt="QQ音乐" className="w-5 h-5" />
    },
    bilibili: {
        color: 'text-pink-500',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-300',
        gradient: 'from-pink-400 to-pink-600',
        logoUrl: '/logos/platforms/bilibili.svg',
        icon: <img src="/logos/platforms/bilibili.svg" alt="Bilibili" className="w-5 h-5" />
    },
    text: {
        color: 'text-slate-500',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
        gradient: 'from-slate-400 to-slate-600',
        icon: <FileText className="w-5 h-5" />
    }
};

interface InputStepProps {
    onSearch: (uid: string, platform?: PlatformType, parsedData?: ParsedInput) => void;
    isLoading: boolean;
}

export default function InputStep({ onSearch, isLoading }: InputStepProps) {
    const [input, setInput] = useState('');
    const [parsedResult, setParsedResult] = useState<ParsedInput | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isMultiline, setIsMultiline] = useState(false);
    const { t } = useTranslation();
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 防抖解析输入
    const debouncedParse = useCallback((value: string) => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        
        if (!value.trim()) {
            setParsedResult(null);
            return;
        }
        
        debounceTimer.current = setTimeout(async () => {
            setIsParsing(true);
            try {
                const result = await parseInput(value);
                setParsedResult(result);
                // 检测是否是多行输入
                setIsMultiline(value.includes('\n') || result.platform === 'text');
            } catch (e) {
                console.error('Parse error:', e);
                setParsedResult(null);
            } finally {
                setIsParsing(false);
            }
        }, 300);
    }, []);

    useEffect(() => {
        debouncedParse(input);
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [input, debouncedParse]);

    const handleSubmit = () => {
        if (!input.trim() || isLoading) return;
        onSearch(parsedResult?.id || input, parsedResult?.platform, parsedResult || undefined);
    };

    const platformConfig = parsedResult ? PLATFORM_CONFIG[parsedResult.platform] : null;

    return (
        <motion.div
            className="flex flex-col items-center justify-center min-h-[70vh] md:min-h-[75vh] w-full px-4 md:px-6 relative z-10 safe-area-bottom"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
            transition={{ duration: 0.5, ease: iosEase }}
        >
            {/* Logo 区域 */}
            <div className="relative mb-6 md:mb-10 group">
                <div className="absolute inset-0 bg-cyan-400 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
                <motion.div
                    className="relative z-10 w-24 h-24 md:w-36 md:h-36 bg-white/90 backdrop-blur-xl border-[4px] md:border-[5px] border-cyan-400 rounded-full flex items-center justify-center shadow-2xl shadow-cyan-400/30"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    transition={appleSpring}
                >
                    <div className="absolute inset-2 border-4 border-dashed border-slate-200 rounded-full animate-spin-slow" />
                    <Music className="text-cyan-500 transform -rotate-12 w-10 h-10 md:w-14 md:h-14" />
                </motion.div>
            </div>

            {/* 标题 */}
            <h1 className="text-xl md:text-3xl font-black text-slate-800 mb-1 md:mb-2 italic tracking-tighter drop-shadow-sm text-center">
                {t('app.titleMain')}<span className="text-cyan-500">{t('app.titleAccent')}</span>
            </h1>
            <p className="text-slate-500 font-bold mb-4 md:mb-6 uppercase tracking-widest text-[9px] md:text-xs text-center">
                {t('app.subtitle')}
            </p>

            {/* 智能输入框 */}
            <div className="w-full max-w-[340px] md:max-w-md relative">
                {/* 平台识别提示 */}
                <AnimatePresence mode="wait">
                    {parsedResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg ${platformConfig?.bgColor} ${platformConfig?.borderColor} border`}
                        >
                            <span className={platformConfig?.color}>
                                {platformConfig?.icon}
                            </span>
                            <span className={`text-sm font-medium ${platformConfig?.color}`}>
                                {parsedResult.displayName}
                            </span>
                            <span className={`text-xs ml-auto ${parsedResult.error ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                                {parsedResult.error ? parsedResult.error : (
                                    <>
                                        {parsedResult.type === 'user' && t('input.typeUser')}
                                        {parsedResult.type === 'playlist' && t('input.typePlaylist')}
                                        {parsedResult.type === 'favlist' && t('input.typeFavlist')}
                                        {parsedResult.type === 'songlist' && `${parsedResult.songs?.length || 0} ${t('input.typeSongs')}`}
                                    </>
                                )}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 输入框容器 */}
                <div className="relative">
                    <div className="absolute inset-0 bg-slate-800 rounded-xl transform translate-x-1 translate-y-1" />
                    <div className={`relative bg-white border-[3px] border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all ${isMultiline ? 'min-h-[120px]' : ''}`}>
                        {isMultiline ? (
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={t('input.placeholderMulti')}
                                className="w-full px-4 py-3 md:px-5 md:py-4 text-base md:text-lg font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:bg-cyan-50/50 transition-colors resize-none min-h-[100px]"
                                rows={4}
                            />
                        ) : (
                            <div className="flex">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={t('input.placeholderSmart')}
                                        className="w-full px-4 py-3 md:px-5 md:py-4 text-base md:text-lg font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:bg-cyan-50/50 transition-colors pr-10"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    />
                                    {isParsing && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!input.trim() || isLoading}
                                    className={`px-4 md:px-6 flex items-center justify-center border-l-[3px] border-slate-800 transition-colors ${
                                        platformConfig 
                                            ? `bg-gradient-to-r ${platformConfig.gradient} hover:opacity-90` 
                                            : 'bg-cyan-400 hover:bg-cyan-300'
                                    } active:opacity-80 disabled:opacity-50`}
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <ChevronRight className="text-white drop-shadow-md w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* 多行模式提交按钮 */}
                    {isMultiline && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={handleSubmit}
                            disabled={!input.trim() || isLoading}
                            className={`absolute -bottom-3 right-4 px-4 py-2 rounded-full font-bold text-white shadow-lg transition-all ${
                                platformConfig 
                                    ? `bg-gradient-to-r ${platformConfig.gradient}` 
                                    : 'bg-cyan-500'
                            } hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                t('input.submit')
                            )}
                        </motion.button>
                    )}
                </div>

                {/* 切换输入模式 */}
                <div className="mt-4 flex justify-center gap-4">
                    <button
                        onClick={() => setIsMultiline(false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            !isMultiline ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        <Link2 className="w-3.5 h-3.5" />
                        {t('input.modeLink')}
                    </button>
                    <button
                        onClick={() => setIsMultiline(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            isMultiline ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        {t('input.modeText')}
                    </button>
                </div>

                {/* 支持的平台提示 */}
                <div className="mt-6 text-center">
                    <p className="text-slate-400 text-xs mb-2">{t('input.supportedPlatforms')}</p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        {Object.entries(PLATFORM_CONFIG).filter(([k]) => k !== 'text').map(([key, config]) => (
                            <div 
                                key={key} 
                                className={`flex items-center gap-1 px-2 py-1 rounded-md ${config.bgColor} ${config.color}`}
                            >
                                {config.icon}
                                <span className="text-xs font-medium">
                                    {key === 'netease' && '网易云'}
                                    {key === 'qqmusic' && 'QQ音乐'}
                                    {key === 'bilibili' && 'B站'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 装饰点 */}
            <div className="mt-6 flex gap-2">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-cyan-400 animate-bounce" />
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-pink-400 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-400 animate-bounce delay-200" />
            </div>
        </motion.div>
    );
}
