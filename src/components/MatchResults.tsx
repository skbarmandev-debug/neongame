import React, { useEffect, useState } from 'react';
import { Trophy, Home, RefreshCw, Settings, Swords, Skull, Zap, Crosshair } from 'lucide-react';
import { GameState, PlayerStats, HighScore } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface MatchResultsProps {
  players: PlayerStats[];
  onNavigate: (state: GameState) => void;
  playClickSound: () => void;
  onRematch: () => void;
}

export const MatchResults: React.FC<MatchResultsProps> = ({
  players,
  onNavigate,
  playClickSound,
  onRematch
}) => {
  const [sortedPlayers, setSortedPlayers] = useState<PlayerStats[]>([]);
  const [mvp, setMvp] = useState<PlayerStats | null>(null);
  const [bestStreak, setBestStreak] = useState<{ name: string; streak: number }>({ name: 'None', streak: 0 });
  const [bestAccuracy, setBestAccuracy] = useState<{ name: string; pct: number }>({ name: 'None', pct: 0 });

  useEffect(() => {
    // Sort by Kills (primary) and Score (secondary)
    const sorted = [...players].sort((a, b) => {
      if (b.kills !== a.kills) {
        return b.kills - a.kills;
      }
      return b.score - a.score;
    });
    setSortedPlayers(sorted);

    // MVP is 1st ranked player if they have at least 1 kill
    if (sorted.length > 0 && sorted[0].kills > 0) {
      setMvp(sorted[0]);
    }

    // Determine highest streak
    let streakWinner = 'None';
    let maxStreak = 0;
    players.forEach(p => {
      if (p.bestStreak > maxStreak) {
        maxStreak = p.bestStreak;
        streakWinner = p.name;
      }
    });
    setBestStreak({ name: streakWinner, streak: maxStreak });

    // Determine highest headshot ratio (at least 5 shots fired)
    let accuracyWinner = 'None';
    let maxPct = 0;
    players.forEach(p => {
      if (p.shotsFired >= 5) {
        const pct = Math.round((p.headshots / p.shotsFired) * 100);
        if (pct > maxPct) {
          maxPct = pct;
          accuracyWinner = p.name;
        }
      }
    });
    setBestAccuracy({ name: accuracyWinner, pct: maxPct });

    // Save Top Score of human player to LocalStorage highscores and Firebase Firestore global leaderboards
    const humans = players.filter(p => !p.isBot);
    if (humans.length > 0) {
      const topHuman = humans.sort((a, b) => b.score - a.score)[0];
      if (topHuman.score > 0) {
        const dateStr = new Date().toISOString().split('T')[0];
        const newRecord: HighScore = {
          name: topHuman.name,
          score: topHuman.score,
          kd: `${topHuman.kills} / ${topHuman.deaths}`,
          date: dateStr
        };

        const existingRaw = localStorage.getItem('neonblast_highscores');
        let list: HighScore[] = [];
        if (existingRaw) {
          try {
            list = JSON.parse(existingRaw);
          } catch (e) {
            list = [];
          }
        }
        list.push(newRecord);
        // Sort and slice top 10
        list = list.sort((a, b) => b.score - a.score).slice(0, 10);
        localStorage.setItem('neonblast_highscores', JSON.stringify(list));

        // Submit to global Firestore leaderboard concurrently
        const scoreID = `score_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const uploadGlobalScore = async () => {
          try {
            await setDoc(doc(db, 'leaderboard', scoreID), {
              name: topHuman.name,
              score: topHuman.score,
              kd: `${topHuman.kills} / ${topHuman.deaths}`,
              date: dateStr,
              createdAt: serverTimestamp()
            });
            console.log(`Global score deposited successfully: ${scoreID}`);
          } catch (err) {
            console.error("Failed to upload score to Firestore", err);
            try {
              handleFirestoreError(err, OperationType.CREATE, `leaderboard/${scoreID}`);
            } catch (fsErr) {
              console.error(fsErr);
            }
          }
        };
        uploadGlobalScore();
      }
    }
  }, [players]);

  const handleRematch = () => {
    playClickSound();
    onRematch();
  };

  const handleSettings = () => {
    playClickSound();
    onNavigate('lobby');
  };

  const handleMenu = () => {
    playClickSound();
    onNavigate('menu');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-radial from-[#0f0c1b] via-[#050409] to-[#010103] p-4 md:p-6 scanlines">
      <div className="w-full max-w-3xl bg-slate-950/80 border border-slate-800 p-6 md:p-8 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] z-10 max-h-[96vh] overflow-y-auto">
        
        {/* Trophy Header */}
        <div className="text-center mb-8 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-neon-yellow opacity-5 blur-[80px] pointer-events-none"></div>
          <Trophy className="w-16 h-16 text-neon-yellow mx-auto mb-3 drop-shadow-[0_0_15px_rgba(255,215,64,0.4)] animate-bounce" />
          <h1 className="text-4xl font-bold font-display tracking-widest text-[#ffd740]">COMBAT ENGAGEMENT COMPLETE</h1>
          <p className="text-xs font-mono tracking-wider text-gray-400 mt-1 uppercase">Final Match Statistics</p>
        </div>

        {/* High ranks showcase of winners */}
        {sortedPlayers.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/25 p-5 rounded-lg text-center mb-8">
            <span className="text-[11px] font-mono tracking-widest text-[#ffd740] uppercase font-bold">MATCH CHAMPION</span>
            <h2 className="text-3xl font-bold font-display tracking-wider text-white mt-1 uppercase" style={{ color: sortedPlayers[0].color }}>
              🥇 {sortedPlayers[0].name}
            </h2>
            <p className="text-xs font-mono text-gray-400 mt-1.5">
              Accumulated <span className="text-neon-cyan font-bold">{sortedPlayers[0].kills} kills</span> with a score of <span className="text-[#69ff47] font-bold">{sortedPlayers[0].score} points</span>!
            </p>
          </div>
        )}

        {/* Players Standings Table */}
        <div className="overflow-x-auto min-h-[140px] border border-slate-900 rounded bg-slate-950/40 mb-8">
          <table className="w-full font-mono text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-[#a0a5cc] tracking-wider uppercase">
                <th className="px-5 py-3 text-center">Rank</th>
                <th className="px-5 py-3">Callsign</th>
                <th className="px-5 py-3 text-center">Type</th>
                <th className="px-5 py-3 text-center text-neon-cyan">Kills</th>
                <th className="px-5 py-3 text-center text-red-400">Deaths</th>
                <th className="px-5 py-3 text-center text-[#69ff47]">Final Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((p, index) => {
                const colors = ['text-[#ffd740] font-bold', 'text-gray-300', 'text-[#cd7f32]', 'text-gray-500'];
                return (
                  <tr key={p.id} className="border-b border-slate-900 hover:bg-slate-900/10">
                    <td className={`px-5 py-3.5 text-center font-display ${colors[index] || 'text-gray-500'}`}>
                      {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`}
                    </td>
                    <td className="px-5 py-3.5 font-bold uppercase" style={{ color: p.color }}>
                      {p.name}
                    </td>
                    <td className="px-5 py-3.5 text-center text-gray-400">
                      {p.isBot ? '🤖 AI Bot' : '👤 Human'}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-white">
                      {p.kills}
                    </td>
                    <td className="px-5 py-3.5 text-center text-gray-400">
                      {p.deaths}
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-[#69ff47]">
                      {p.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* MVP and statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          
          {/* MVP Card */}
          <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-lg flex flex-col items-center text-center">
            <Swords className="w-5 h-5 text-neon-cyan mb-1.5" />
            <span className="text-[10px] font-mono tracking-widest text-[#a0a5cc] uppercase">COMBAT MVP</span>
            <span className="font-bold text-gray-200 mt-1 uppercase truncate w-full">
              {mvp ? mvp.name : 'No Kills'}
            </span>
            <span className="text-[11px] text-gray-400 mt-1">First Place Shooter</span>
          </div>

          {/* Commendation 1: Best Streak */}
          <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-lg flex flex-col items-center text-center">
            <Zap className="w-5 h-5 text-neon-pink mb-1.5 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-[#a0a5cc] uppercase">BEST STREAK</span>
            <span className="font-bold text-gray-200 mt-1 uppercase truncate w-full">
              {bestStreak.streak > 0 ? `${bestStreak.name} (${bestStreak.streak})` : 'None'}
            </span>
            <span className="text-[11px] text-gray-400 mt-1">Apex Streak Multiplier</span>
          </div>

          {/* Commendation 2: Accuracy */}
          <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-lg flex flex-col items-center text-center">
            <Crosshair className="w-5 h-5 text-neon-green mb-1.5" />
            <span className="text-[10px] font-mono tracking-widest text-[#a0a5cc] uppercase">HEADSHOT % CHAMP</span>
            <span className="font-bold text-gray-200 mt-1 uppercase truncate w-full">
              {bestAccuracy.pct > 0 ? `${bestAccuracy.name} (${bestAccuracy.pct}%)` : 'None'}
            </span>
            <span className="text-[11px] text-gray-400 mt-1">Marksman Targeting Unit</span>
          </div>

        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-900 justify-center">
          <button
            id="results-btn-rematch"
            onClick={handleRematch}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan font-bold rounded transiton-all border border-neon-cyan text-sm"
          >
            <RefreshCw className="w-4 h-4 animate-spin-reverse" />
            <span>PLAY AGAIN</span>
          </button>
          
          <button
            id="results-btn-lobby"
            onClick={handleSettings}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-gray-300 hover:text-white font-bold rounded border border-slate-800 hover:border-slate-600 transition-all text-sm"
          >
            <Settings className="w-4 h-4" />
            <span>CHANGE LOBBY</span>
          </button>

          <button
            id="results-btn-menu"
            onClick={handleMenu}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-gray-300 hover:text-white font-bold rounded border border-slate-800 hover:border-slate-600 transition-all text-sm"
          >
            <Home className="w-4 h-4" />
            <span>MAIN MENU</span>
          </button>
        </div>

      </div>
    </div>
  );
};
