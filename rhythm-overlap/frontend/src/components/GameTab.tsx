import { GAMES } from '../config/games';

interface GameTabProps {
    game: typeof GAMES[0];
    isActive: boolean;
    onClick: () => void;
    count: number;
}

export default function GameTab({ game, isActive, onClick, count }: GameTabProps) {
    return (
        <button
            onClick={onClick}
            className="relative group outline-none focus:outline-none flex-shrink-0 flex flex-col items-center"
        >
            {/* 机台图片 - 紧贴 tab 上方，更大尺寸 */}
            <div className={`
                relative h-24 w-28 sm:h-28 sm:w-32 -mb-2 transition-all duration-300 z-10
                ${isActive ? 'scale-110' : 'scale-95 opacity-60 grayscale group-hover:opacity-80 group-hover:grayscale-0'}
            `}>
                <img 
                    src={game.cabinetUrl || game.logoUrl} 
                    alt=""
                    className="h-full w-full object-contain drop-shadow-lg"
                />
            </div>
            
            {/* Tab 标签 - 简化样式避免白线 */}
            <div className={`
                relative h-10 px-4 transform -skew-x-12 flex items-center justify-center transition-all duration-200 overflow-hidden rounded-sm
                ${isActive
                    ? 'bg-slate-800 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}
            `}>
                {/* 半透明 Logo 背景 - 居中显示 */}
                {game.logoUrl && (
                    <img 
                        src={game.logoUrl} 
                        alt=""
                        className={`
                            absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-auto object-contain transform skew-x-12
                            pointer-events-none select-none
                            ${isActive ? 'opacity-20' : 'opacity-15'}
                        `}
                    />
                )}
                
                {/* 前景文字 - 显示完整游戏名 */}
                <div className="transform skew-x-12 flex items-center gap-2 relative z-10">
                    <span className={`font-bold text-xs tracking-tight whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
                        {game.name}
                    </span>
                    {count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-cyan-500 text-slate-900' : 'bg-slate-300 text-slate-600'}`}>
                            {count}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}
