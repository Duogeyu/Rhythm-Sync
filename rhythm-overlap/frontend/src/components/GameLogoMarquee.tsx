import { motion } from 'framer-motion';
import { GAMES } from '../config/games';

export default function GameLogoMarquee() {
    // 提取唯一的 Logo URL
    const uniqueGames = GAMES.reduce((acc, game) => {
        if (!acc.find(g => g.logoUrl === game.logoUrl)) {
            acc.push(game);
        }
        return acc;
    }, [] as typeof GAMES);

    return (
        <div 
            className="fixed bottom-4 md:bottom-6 left-0 right-0 overflow-hidden whitespace-nowrap pointer-events-none select-none z-[5]"
            style={{ 
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
            }}
        >
            <motion.div
                className="inline-flex items-center gap-10 md:gap-20 px-4"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
                {[...uniqueGames, ...uniqueGames, ...uniqueGames, ...uniqueGames].map((game, i) => (
                    <img
                        key={`${game.id}-${i}`}
                        src={game.logoUrl}
                        alt={game.name}
                        className="h-8 md:h-10 w-auto object-contain opacity-50"
                    />
                ))}
            </motion.div>
        </div>
    );
}
