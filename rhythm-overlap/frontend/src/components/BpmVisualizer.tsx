import { motion } from 'framer-motion';

interface BpmVisualizerProps {
    bpm: number;
}

export default function BpmVisualizer({ bpm }: BpmVisualizerProps) {
    // 限制 BPM 范围
    const safeBpm = Math.max(60, Math.min(bpm, 300));
    // 单次摆动时间 (每拍摆动一次，左右摆动)
    const duration = 60 / safeBpm;

    return (
        <div className="relative w-20 h-10 flex items-end justify-center shrink-0 overflow-hidden bg-slate-100 rounded-t-xl border-t border-x border-slate-200 shadow-inner">
            {/* 刻度盘背景 */}
            <div className="absolute inset-0 z-0">
                <svg viewBox="0 0 100 50" className="w-full h-full opacity-30">
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-400" />
                    <line x1="50" y1="50" x2="50" y2="10" stroke="currentColor" strokeWidth="0.5" className="text-slate-300" />
                    <line x1="50" y1="50" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" className="text-slate-300" />
                    <line x1="50" y1="50" x2="80" y2="20" stroke="currentColor" strokeWidth="0.5" className="text-slate-300" />
                </svg>
            </div>

            {/* 摆针容器 */}
            <div className="absolute bottom-0 left-1/2 w-0 h-0 z-10">
                <motion.div
                    className="origin-bottom w-1 h-12 bg-slate-800 rounded-full -translate-x-1/2 absolute bottom-[-4px]"
                    animate={{ rotate: [-35, 35] }}
                    transition={{
                        duration: duration,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                    }}
                    style={{
                        boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                    }}
                >
                    {/* 针头重锤感 */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-4 bg-cyan-500 rounded-sm shadow-sm" />
                    {/* 装饰点 */}
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/80 rounded-full" />
                </motion.div>
            </div>

            {/* 底部轴心 */}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 rounded-full z-20 border-2 border-white shadow-sm" />

            {/* BPM 数值显示 (浮在上方) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-b-md shadow-sm border border-slate-100 z-30 flex flex-col items-center leading-none">
                <span className="text-[7px] font-black text-slate-400 uppercase">BPM</span>
                <span className="text-xs font-black text-slate-900 font-mono">{bpm}</span>
            </div>
        </div>
    );
}
