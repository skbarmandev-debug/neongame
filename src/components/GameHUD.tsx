import React from 'react';
import { Shield, Zap, Target, Flame, Swords, Hourglass, Bot, User, Settings, Pause } from 'lucide-react';
import { PlayerStats, WeaponType } from '../types';

interface GameHUDProps {
  players: PlayerStats[];
  timeLimitSeconds: number;
  timeElapsedSeconds: number;
  winConditionKills: number;
  killFeed: { id: string; text: string; time: number }[];
  onPause: () => void;
  playClickSound: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  players,
  timeLimitSeconds,
  timeElapsedSeconds,
  winConditionKills,
  killFeed,
  onPause,
  playClickSound
}) => {
  const getWeaponIcon = (w: WeaponType) => {
    switch (w) {
      case 'pistol': return '🔫';
      case 'shotgun': return '🔴';
      case 'rifle': return '🟢';
      case 'sniper': return '🟣';
      case 'rocket': return '🚀';
      default: return '🔫';
    }
  };

  const getPowerUpIcon = (player: PlayerStats) => {
    const powerUps = [];
    if (player.speed_boost) powerUps.push({ icon: '⚡', label: 'Speed' });
    if (player.shield_active) powerUps.push({ icon: '🔮', label: 'Shield' });
    if (player.aim_assist) powerUps.push({ icon: '🎯', label: 'Aim' });
    return powerUps;
  };

  // Convert timer values
  const totalSecondsLeft = Math.max(0, timeLimitSeconds - timeElapsedSeconds);
  const mins = Math.floor(totalSecondsLeft / 60);
  const secs = totalSecondsLeft % 60;
  const timerStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const renderPlayerCard = (p: PlayerStats) => {
    const hpPct = Math.max(0, (p.health / p.maxHealth) * 100);
    const xpPct = (p.xp / p.xpToNext) * 100;
    
    // Choose health bar color
    let hpColor = 'bg-emerald-500';
    if (hpPct < 25) hpColor = 'bg-rose-600 animate-pulse';
    else if (hpPct < 55) hpColor = 'bg-amber-500';

    const pUps = getPowerUpIcon(p);

    return (
      <div
        key={p.id}
        className={`bg-slate-950/80 border p-3 rounded-lg font-mono text-xs shadow-md transition-all duration-300 flex flex-col justify-between ${
          p.alive ? 'opacity-100' : 'opacity-40 border-slate-900 bg-red-950/10'
        }`}
        style={{ borderColor: p.alive ? p.color : 'rgba(30,41,59,0.3)' }}
      >
        {/* Name and Status */}
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></span>
            <span className="font-bold text-white max-w-[80px] truncate uppercase">{p.name}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[#a0a5cc]">
            {p.isBot ? <Bot className="w-3 h-3 text-[#cd7f32]" /> : <User className="w-3 h-3 text-neon-cyan" />}
            <span>LV.{p.level}</span>
          </div>
        </div>

        {/* Health combined bar */}
        <div className="relative w-full h-3.5 bg-slate-900 rounded overflow-hidden mb-1.5 flex select-none">
          {/* Armor (Blue element) overlaying on core hp bar */}
          <div
            className={`h-full ${hpColor} transition-all duration-200`}
            style={{ width: `${hpPct}%` }}
          ></div>
          {p.armor > 0 && (
            <div
              className="absolute top-0 bottom-0 left-0 bg-[#3b82f6]/95 border-r border-[#60a5fa] transition-all duration-205 flex items-center justify-center"
              style={{ width: `${(p.armor / 50) * 100}%` }}
              title={`Shield Armor: ${p.armor}`}
            >
              <div className="text-[8px] leading-none text-white px-1 flex items-center justify-center gap-0.5">
                <Shield className="w-2 h-2" />
                <span>{p.armor}</span>
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {p.alive ? `${p.health} / ${p.maxHealth} HP` : 'SPAWNING...'}
          </div>
        </div>

        {/* Level XP Bar */}
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-purple-500 transition-all duration-150" style={{ width: `${xpPct}%` }}></div>
        </div>

        {/* Weapon & Ammo */}
        <div className="flex justify-between items-center text-[11px] text-gray-300">
          <div className="flex items-center gap-1 select-none">
            <span>{getWeaponIcon(p.weapon)}</span>
            <span className="text-gray-200 capitalize font-medium">{p.weapon}</span>
          </div>
          
          <div className="font-bold">
            {p.reloading ? (
              <span className="text-neon-pink text-[10px] animate-pulse">RELOADING...</span>
            ) : (
              <span>
                {p.weapon === 'pistol' ? `${p.ammo} / ∞` : `${p.ammo} / ${p.totalAmmo}`}
              </span>
            )}
          </div>
        </div>

        {/* Score & active power-ups */}
        <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-900 text-[10px] text-[#a0a5cc]">
          <span>Kills: <span className="text-white font-bold">{p.kills}</span></span>
          <div className="flex gap-1">
            {pUps.map((pu, index) => (
              <span
                key={index}
                className="inline-block px-1 pr-1.5 bg-slate-900 border border-slate-850 rounded-full text-[9px] text-[#ffd740] animate-bounce"
                title={pu.label}
              >
                {pu.icon}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 z-20">
      
      {/* Top Bar Roster */}
      <div className="flex flex-col gap-4 w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full pointer-events-auto">
          {players.map(renderPlayerCard)}
        </div>
      </div>

      {/* Center overlay, right aligned: Kill Feed */}
      <div className="absolute top-[140px] right-4 flex flex-col gap-1.5 max-w-[260px] text-right font-mono text-[11px] text-gray-100 z-30 select-none">
        {killFeed.map((feed) => (
          <div
            key={feed.id}
            className="bg-black/85 border border-slate-850 px-3 py-1.5 rounded shadow-lg animate-fade-in-left border-r-4 border-r-neon-pink"
          >
            <span>{feed.text}</span>
          </div>
        ))}
      </div>

      {/* Bottom control strip */}
      <div className="flex justify-between items-center w-full mt-auto pt-4 pointer-events-auto select-none">
        {/* Match Timer Info */}
        <div className="flex items-center gap-4 bg-slate-950/90 border border-slate-800 px-4 py-2.5 rounded-lg text-sm font-mono shadow-md">
          <Hourglass className="w-4.5 h-4.5 text-neon-cyan animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">TIME:</span>
            <span className="text-emerald-400 font-bold tracking-wider">{timerStr}</span>
          </div>
          <div className="h-4 w-px bg-slate-800"></div>
          <div className="flex items-center gap-1 text-xs">
            <Swords className="w-4 h-4 text-neon-pink" />
            <span className="text-gray-400">LIMIT:</span>
            <span className="text-white font-bold">{winConditionKills} KILLS</span>
          </div>
        </div>

        {/* Buttons to Pause */}
        <div className="flex gap-2">
          <button
            id="hud-pause-btn"
            onClick={() => { playClickSound(); onPause(); }}
            className="flex items-center gap-2 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-neon-pink text-[#a0a5cc] hover:text-white px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all shadow-md"
          >
            <Pause className="w-3.5 h-3.5 text-neon-pink fill-neon-pink" />
            <span>PAUSE BATTLE</span>
          </button>
        </div>
      </div>

    </div>
  );
};
