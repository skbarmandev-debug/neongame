import React, { useState, useEffect } from 'react';
import { Trophy, ArrowLeft, Trash2, Globe, Monitor, RotateCw } from 'lucide-react';
import { GameState, HighScore } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface HighScoresProps {
  onNavigate: (state: GameState) => void;
  playClickSound: () => void;
}

export const HighScores: React.FC<HighScoresProps> = ({ onNavigate, playClickSound }) => {
  const [localScores, setLocalScores] = useState<HighScore[]>([]);
  const [globalScores, setGlobalScores] = useState<HighScore[]>([]);
  const [activeTab, setActiveTab] = useState<'global' | 'local'>('global');
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Load local scores from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('neonblast_highscores');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as HighScore[];
        setLocalScores(parsed.sort((a, b) => b.score - a.score).slice(0, 10));
      } catch (err) {
        console.error("Failed to load local scores", err);
      }
    } else {
      // Seed initial highscores if empty so user has standard targets
      const initial: HighScore[] = [
        { name: "Alpha_Bot", score: 1850, kd: "10 / 2", date: "2026-06-09" },
        { name: "LaserFury", score: 1450, kd: "8 / 3", date: "2026-06-08" },
        { name: "P1_Snipe", score: 1100, kd: "5 / 1", date: "2026-06-08" },
        { name: "NeonStriker", score: 850, kd: "4 / 4", date: "2026-06-07" },
        { name: "Cypher", score: 620, kd: "3 / 4", date: "2026-06-05" }
      ];
      localStorage.setItem('neonblast_highscores', JSON.stringify(initial));
      setLocalScores(initial);
    }
  }, []);

  // Fetch Global high scores from Firestore
  const fetchGlobalScores = async () => {
    setLoadingGlobal(true);
    setGlobalError(null);
    try {
      const q = query(
        collection(db, 'leaderboard'),
        orderBy('score', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const list: HighScore[] = [];
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        list.push({
          name: data.name || 'Anonymous',
          score: data.score || 0,
          kd: data.kd || '0 / 0',
          date: data.date || ''
        });
      });
      setGlobalScores(list);
    } catch (err) {
      console.error("Failed to fetch global scores", err);
      setGlobalError("Offline or Database rules restricting access");
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    fetchGlobalScores();
  }, []);

  const handleClearLocal = () => {
    playClickSound();
    localStorage.removeItem('neonblast_highscores');
    setLocalScores([]);
    setShowConfirm(false);
  };

  const handleBack = () => {
    playClickSound();
    onNavigate('menu');
  };

  const handleTabChange = (tab: 'global' | 'local') => {
    playClickSound();
    setActiveTab(tab);
  };

  const currentScores = activeTab === 'global' ? globalScores : localScores;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-radial from-[#0f0c1b] via-[#050409] to-[#010103] p-6 scanlines">
      <div className="w-full max-w-2xl bg-slate-950/80 border border-slate-800 p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-neon-yellow drop-shadow-[0_0_10px_rgba(255,215,64,0.4)]" />
            <h1 className="text-3xl font-bold font-display tracking-wider">LEADERBOARD</h1>
          </div>
          <button
            id="back-btn-scores"
            onClick={handleBack}
            className="flex items-center gap-2 text-[#a0a5cc] hover:text-white px-3 py-1.5 border border-slate-700 hover:border-slate-500 rounded bg-slate-900 transition-all text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-slate-955 border border-slate-900 rounded-lg">
          <button
            id="tab-btn-global"
            onClick={() => handleTabChange('global')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-mono tracking-wider uppercase rounded-md transition-all cursor-pointer ${
              activeTab === 'global'
                ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan scale-[1.02] shadow-[0_0_10px_rgba(0,229,255,0.15)] font-bold'
                : 'text-gray-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Global Sectors</span>
          </button>
          
          <button
            id="tab-btn-local"
            onClick={() => handleTabChange('local')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-mono tracking-wider uppercase rounded-md transition-all cursor-pointer ${
              activeTab === 'local'
                ? 'bg-[#69ff47]/20 border border-[#69ff47] text-[#69ff47] scale-[1.02] shadow-[0_0_10px_rgba(105,255,71,0.15)] font-bold'
                : 'text-gray-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Local Systems</span>
          </button>
        </div>

        {/* Scores Table */}
        <div className="overflow-x-auto min-h-[300px] border border-slate-900 rounded bg-slate-950/40 relative">
          {activeTab === 'global' && loadingGlobal ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 gap-3 z-20">
              <RotateCw className="w-8 h-8 text-neon-cyan animate-spin" />
              <span className="font-mono text-xs text-[#a0a5cc]">STREAMING DECK SCORES...</span>
            </div>
          ) : activeTab === 'global' && globalError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center gap-4 z-20">
              <span className="font-mono text-xs text-red-400 uppercase">CONNECTION STALLED: {globalError}</span>
              <button
                onClick={fetchGlobalScores}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-neon-cyan border border-neon-cyan hover:bg-neon-cyan/10 rounded font-mono transition-all cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>RETRY SYNC</span>
              </button>
            </div>
          ) : null}

          <table className="w-full font-sans text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-xs font-mono tracking-wider text-[#a0a5cc] uppercase">
                <th className="px-6 py-3.5 text-center">Rank</th>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5 text-center">Score</th>
                <th className="px-6 py-3.5 text-center">K / D Ratio</th>
                <th className="px-6 py-3.5 text-[#4b4e6d] text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {currentScores.map((score, index) => {
                const rankColor = index === 0 ? 'text-neon-yellow font-bold' : index === 1 ? 'text-[#e0e0e0]' : index === 2 ? 'text-[#cd7f32]' : 'text-gray-400';
                return (
                  <tr key={index} className="border-b border-slate-900 hover:bg-slate-900/30 transition-colors">
                    <td className={`px-6 py-4 text-center font-display ${rankColor}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-gray-200">
                      {score.name}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-neon-cyan font-bold">
                      {score.score}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-gray-300">
                      {score.kd}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-[#a0a5cc]/60">
                      {score.date}
                    </td>
                  </tr>
                );
              })}
              {currentScores.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-[#a0a5cc] font-mono text-sm">
                    {activeTab === 'global' ? 'Global Leaderboard empty.' : 'No local records stored yet.'} Finish matches to establish real scores!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Danger zone / Reset controls (Only for Local Systems) */}
        {activeTab === 'local' && localScores.length > 0 && (
          <div className="mt-6 flex justify-end">
            {!showConfirm ? (
              <button
                id="scores-btn-clear-verify"
                onClick={() => { playClickSound(); setShowConfirm(true); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 border border-red-900 hover:border-red-600 rounded bg-red-950/20 hover:bg-red-950/30 transition-all font-mono cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>WIPE LOCAL LEADERBOARD</span>
              </button>
            ) : (
              <div className="flex items-center gap-4 bg-red-950/20 border border-red-900/60 p-3 rounded font-mono text-xs">
                <span className="text-red-300">Confirm wipe all local records?</span>
                <button
                  id="scores-btn-clear-yes"
                  onClick={handleClearLocal}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white font-bold transition-all cursor-pointer"
                >
                  Confirm wipe
                </button>
                <button
                  id="scores-btn-clear-no"
                  onClick={() => { playClickSound(); setShowConfirm(false); }}
                  className="px-3 py-1 bg-slate-900 border border-slate-700 rounded hover:bg-slate-800 transition-all text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
