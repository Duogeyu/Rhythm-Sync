import { motion } from 'framer-motion';
import { useState } from 'react';

// 生成随机位置和动画延迟
const generateDecorations = (count: number) => {
    return Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: `${Math.random() * 80}%`, 
        left: `${Math.random() * 95}%`,
        // 随机选择素材类型
        type: [
            'diamond-pink', 'diamond-yellow', 'diamond-white',
            'star-white', 'star-yellow', 'star-yellow'
        ][Math.floor(Math.random() * 6)],
        // 随机缩放
        scale: 0.6 + Math.random() * 0.6,
        // 随机动画延迟
        delay: Math.random() * 5,
        // 随机动画时长
        duration: 3 + Math.random() * 2
    }));
};

export default function Background() {
    const [decorations] = useState(() => generateDecorations(20));

    return (
        <div className="prism-bg-container bg-slate-50">
            {/* Layer 1: 渐变背景 (官网动画: 10s linear infinite) */}
            <div className="prism-bg-gradient" />
            
            {/* Layer 2: 极光效果 (已移除) */}
            {/* <div className="prism-bg-aurora" /> */}

            {/* Layer 3: 背景云朵 (官网动画: 12-14s linear infinite) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 {/* bg_cloud_back_l */}
                 <motion.div 
                    animate={{ x: ['-10%', '10%'] }} 
                    transition={{ duration: 12, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute top-[10%] left-[5%] w-[60vw] md:w-[35vw] h-[25vh] bg-contain bg-no-repeat opacity-80"
                    style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_cloud_back_l.png')" }}
                 />
                 {/* bg_cloud_back_r */}
                 <motion.div 
                    animate={{ x: ['5%', '-5%'] }} 
                    transition={{ duration: 14, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute top-[15%] right-[5%] w-[65vw] md:w-[38vw] h-[28vh] bg-contain bg-no-repeat opacity-80"
                    style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_cloud_back_r.png')" }}
                 />
                 {/* bg_cloud_back_c */}
                 <motion.div 
                    animate={{ x: ['-5%', '5%'] }} 
                    transition={{ duration: 13, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute top-[5%] left-[30%] w-[70vw] md:w-[45vw] h-[30vh] bg-contain bg-no-repeat opacity-70"
                    style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_cloud_back_c.png')" }}
                 />
            </div>

            {/* Layer 4: 月亮 (官网动画: 6s linear alternate) */}
            <motion.div 
                className="prism-bg-moon w-[100px] h-[100px] absolute top-[8%] right-[12%] opacity-90 z-[2]"
                animate={{ y: [0, 20], rotate: [-5, 5] }}
                transition={{ duration: 6, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
            />

            {/* Layer 5: 闪光装饰 (混合模式叠加背景 + 独立粒子) */}
            {/* 静态大背景 Shine */}
            <div 
                className="prism-bg-shine absolute inset-0 opacity-40 mix-blend-overlay z-[3]" 
                style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_shines_pc.png')" }}
            />
            
            {/* 动态星星/菱形 (基于官网素材) */}
            {decorations.map((deco) => (
                <motion.div
                    key={deco.id}
                    className="absolute z-[4]"
                    style={{
                        top: deco.top,
                        left: deco.left,
                        width: '32px',
                        height: '32px',
                        backgroundImage: `url('/assets/backgrounds/prism/bg_${deco.type}.png')`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat'
                    }}
                    animate={
                        deco.type.includes('diamond') 
                        ? { 
                            opacity: [0.3, 1, 0.3], 
                            scale: [deco.scale * 0.8, deco.scale * 1.2, deco.scale * 0.8] 
                          }
                        : { 
                            opacity: [0.5, 1, 0.5], 
                            scale: [deco.scale, deco.scale * 1.3, deco.scale],
                            rotate: [0, 180, 360] 
                          }
                    }
                    transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        delay: deco.delay,
                        ease: "linear" 
                    }}
                />
            ))}

            {/* Layer 6: 彩虹底部 (官网动画: 2s ease forwards) */}
            <motion.div 
                className="prism-bg-rainbow absolute bottom-0 left-0 w-full h-[60%] bg-cover bg-bottom opacity-80 z-[5]"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 0.8, y: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
            />

            {/* Layer 7: 前景云朵 (官网动画: 18-20s linear infinite) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-[6]">
                 {/* bg_cloud_front_l */}
                 <motion.div 
                    animate={{ x: ['-8%', '8%'] }} 
                    transition={{ duration: 18, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute bottom-[-5%] left-[-5%] w-[70vw] md:w-[45vw] h-[35vh] bg-contain bg-no-repeat opacity-90"
                    style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_cloud_front_l.png')" }}
                 />
                 {/* bg_cloud_front_r */}
                 <motion.div 
                    animate={{ x: ['8%', '-8%'] }} 
                    transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute bottom-[-8%] right-[-5%] w-[75vw] md:w-[50vw] h-[40vh] bg-contain bg-no-repeat opacity-90"
                    style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_cloud_front_r.png')" }}
                 />
                 {/* bg_cloud_front_c */}
                 <motion.div 
                    animate={{ x: ['-4%', '4%'] }} 
                    transition={{ duration: 19, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                    className="absolute bottom-[-10%] left-[25%] w-[80vw] md:w-[55vw] h-[35vh] bg-contain bg-no-repeat opacity-85"
                    style={{ backgroundImage: "url('/assets/backgrounds/prism/bg_cloud_front_c.png')" }}
                 />
            </div>

            {/* 统一色调叠加层 - 稍微加一点灰色让背景沉下去 */}
            
            {/* 统一色调叠加层 - 稍微加一点灰色让背景沉下去 */}
            <div className="absolute inset-0 bg-slate-200/20 mix-blend-multiply pointer-events-none z-[7]" />
            
            {/* 全屏毛玻璃效果 (高斯模糊) - 增加模糊度 */}
            <div className="absolute inset-0 backdrop-blur-[6px] pointer-events-none z-[8]" />
            
            {/* 额外的光晕层，增加梦幻感 - 降低不透明度 */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-transparent pointer-events-none z-[9]" />
        </div>
    );
}
