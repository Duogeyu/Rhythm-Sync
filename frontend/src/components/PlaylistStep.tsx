import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { containerStagger, itemPop } from '../config/games';
import type { UserPlaylist } from '../services/api';

interface PlaylistStepProps {
    playlists: UserPlaylist[];
    onSelect: (playlist: UserPlaylist) => void;
    onBack: () => void;
    isLoading: boolean;
}

export default function PlaylistStep({ playlists, onSelect, onBack, isLoading }: PlaylistStepProps) {
    const { t } = useTranslation();

    return (
        <motion.div
            className="w-full h-full overflow-y-auto scroll-touch safe-area-bottom"
            variants={containerStagger}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
        >
            <div className="max-w-4xl mx-auto px-4 pt-4 pb-20 relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} disabled={isLoading} className="w-12 h-12 bg-white border-[3px] border-slate-200 rounded-full flex items-center justify-center hover:border-cyan-400 hover:text-cyan-500 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                        <ArrowLeft size={24} strokeWidth={3} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 italic uppercase">{t('playlist.title')}</h2>
                        <div className="h-1.5 w-20 bg-gradient-to-r from-cyan-400 to-transparent mt-1 rounded-full" />
                    </div>
                </div>

                {isLoading && (
                    <div className="flex justify-center py-12">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-[6px] border-slate-200 border-t-cyan-500 rounded-full animate-spin mb-4" />
                            <p className="text-slate-400 font-bold">{t('common.loading')}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playlists.map((playlist) => (
                        <motion.div
                            key={playlist.id}
                            variants={itemPop}
                            onClick={() => !isLoading && onSelect(playlist)}
                            className="group cursor-pointer bg-white relative overflow-hidden rounded-xl border-[3px] border-transparent hover:border-cyan-400 transition-all duration-200"
                        >
                            <div className="absolute inset-0 bg-slate-800 transform translate-x-1.5 translate-y-1.5 rounded-xl" />

                            <div className="relative bg-white border-[3px] border-slate-200 group-hover:border-cyan-400 rounded-xl p-3 flex items-center gap-4 transition-colors">
                                <div className="relative w-20 h-20 flex-shrink-0">
                                    <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover rounded-lg border-2 border-slate-100" />
                                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-white transform rotate-12">
                                        {playlist.trackCount}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg text-slate-800 truncate group-hover:text-cyan-600 transition-colors">{playlist.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold text-slate-400">{playlist.trackCount} {t('playlist.songs')}</span>
                                    </div>
                                </div>

                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-white transition-colors">
                                    <ChevronRight size={24} strokeWidth={3} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
