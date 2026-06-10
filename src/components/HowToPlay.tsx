import React from 'react';
import { ArrowLeft, Gamepad2, Shield, Zap, Target, Flame, Swords, Key } from 'lucide-react';
import { GameState } from '../types';

interface HowToPlayProps {
  onNavigate: (state: GameState) => void;
  playClickSound: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onNavigate, playClickSound }) => {
  const handleBack = () => {
    playClickSound();
    onNavigate('menu');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-radial from-[#0f0c1b] via-[#050409] to-[#010103] p-4 font-sans select-none scanlines">
      <div className="w-full max-w-4xl bg-slate-950/80 border border-slate-800 p-6 md:p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-neon-cyan drop-shadow-[0_0_10px_rgba(0,229,255,0.4)]" />
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-wider">TRAINING HANDBOOK</h1>
          </div>
          <button
            id="back-btn-how-to-play"
            onClick={handleBack}
            className="flex items-center gap-2 text-[#a0a5cc] hover:text-white px-3 py-1.5 border border-slate-700 hover:border-slate-500 rounded bg-slate-900 transition-all text-sm font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU</span>
          </button>
        </div>

        {/* Section 1: Core Goal */}
        <div className="mb-8 p-4 bg-purple-950/20 border border-purple-900/40 rounded-lg">
          <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-pink to-purple-400 font-display mb-1 flex items-center gap-2">
            <Swords className="w-4 h-4 text-neon-pink" />
            MISSION BRIEFING
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed font-mono">
            Engage other players or bots in the combat arena on this local device. Pick up spawned firepower, gather performance boosts, level up your avatar, and stay as the last player standing to achieve dominion.
          </p>
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Controls table */}
          <div>
            <h3 className="text-md font-bold font-display text-neon-cyan mb-4 flex items-center gap-2 border-b border-slate-900 pb-1">
              <Key className="w-4 h-4" /> SPLIT-KEYBOARD CONTROLS
            </h3>
            
            <div className="flex flex-col gap-3 font-mono text-xs">
              {/* P1 */}
              <div className="bg-slate-900/60 p-3 rounded border-l-4 border-neon-cyan">
                <span className="font-bold text-neon-cyan text-sm">PLAYER 1 (Cyan)</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>Move: <span className="text-gray-300 font-bold">W / A / S / D</span></div>
                  <div>Fire: <span className="text-gray-300 font-bold">Space</span></div>
                  <div>Reload: <span className="text-gray-300 font-bold">Q</span></div>
                </div>
              </div>

              {/* P2 */}
              <div className="bg-slate-900/60 p-3 rounded border-l-4 border-neon-pink">
                <span className="font-bold text-neon-pink text-sm">PLAYER 2 (Pink)</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>Move: <span className="text-gray-300 font-bold">↑ ↓ ← →</span></div>
                  <div>Fire: <span className="text-gray-300 font-bold">Enter</span></div>
                  <div>Reload: <span className="text-gray-300 font-bold">R-Shift</span></div>
                </div>
              </div>

              {/* P3 */}
              <div className="bg-slate-900/60 p-3 rounded border-l-4 border-neon-green">
                <span className="font-bold text-neon-green text-sm">PLAYER 3 (Green)</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>Move: <span className="text-gray-300 font-bold">T / F / G / H</span></div>
                  <div>Fire: <span className="text-gray-300 font-bold">R</span></div>
                  <div>Reload: <span className="text-gray-300 font-bold">E</span></div>
                </div>
              </div>

              {/* P4 */}
              <div className="bg-slate-900/60 p-3 rounded border-l-4 border-neon-yellow">
                <span className="font-bold text-neon-yellow text-sm">PLAYER 4 (Yellow)</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>Move: <span className="text-gray-300 font-bold">I / J / K / L</span></div>
                  <div>Fire: <span className="text-gray-300 font-bold">O</span></div>
                  <div>Reload: <span className="text-gray-300 font-bold">U</span></div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-slate-900/30 rounded border border-slate-850 text-xs font-mono text-[#a0a5cc]">
              💡 <span className="font-bold text-white">Mobile Touch Info:</span> Drag visual joystick on left side of screen to move, tap Fire & Reload triggers on the right. Practice against AI bots!
            </div>
          </div>

          {/* Weapons Specifications */}
          <div>
            <h3 className="text-md font-bold font-display text-neon-pink mb-4 flex items-center gap-2 border-b border-slate-900 pb-1">
              💥 WEAPON SYSTEMS
            </h3>
            <div className="flex flex-col gap-2.5 font-mono text-xs">
              <div className="p-2.5 bg-slate-900/50 rounded border border-slate-800">
                <span className="font-bold text-white">🔫 NEON PISTOL</span> - Damage: 20 | Reload: 1.0s
                <p className="text-[11px] text-[#a0a5cc] mt-0.5">Infinite reserve ammo. Highly accurate. Starting weapon.</p>
              </div>
              <div className="p-2.5 bg-slate-900/50 rounded border border-slate-800">
                <span className="font-bold text-white font-semibold">🔴 PULSE SHOTGUN</span> - Damage: 13×5 | Reload: 1.8s
                <p className="text-[11px] text-[#a0a5cc] mt-0.5">Fires 5 wide-spreading pellets. High impact, devastating short range damage.</p>
              </div>
              <div className="p-2.5 bg-slate-900/50 rounded border border-slate-800">
                <span className="font-bold text-white text-neon-cyan">🟢 ASSAULT LASER</span> - Damage: 12 | Reload: 1.5s
                <p className="text-[11px] text-[#a0a5cc] mt-0.5">Rapid automatic laser rifle. Perfect for continuous cover fire.</p>
              </div>
              <div className="p-2.5 bg-slate-900/50 rounded border border-slate-800">
                <span className="font-bold text-white text-neon-pink">🟣 VORTEX SNIPER</span> - Damage: 80 | Reload: 2.5s
                <p className="text-[11px] text-[#a0a5cc] mt-0.5">Penetrates structures and opponents. One shot delivers extreme impact.</p>
              </div>
              <div className="p-2.5 bg-slate-900/50 rounded border border-slate-800">
                <span className="font-bold text-white text-neon-yellow">🟡 FUSION LAUNCHER</span> - Damage: 60 | Reload: 3.0s
                <p className="text-[11px] text-[#a0a5cc] mt-0.5">Slow rocket projectile. Blows up on target impact, creating massive explosive AoE splash damage.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Power Pickups */}
        <div className="border-t border-slate-900 pt-6">
          <h3 className="text-md font-bold font-display text-[#69ff47] mb-4 flex items-center gap-2">
            ⭐ ENERGETIC POWER TUNERS (Spawns on Floor Pads)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">❤️</span>
              <span className="font-bold text-white">Health Pack</span>
              <span className="text-[11px] text-gray-400 mt-1">+40 HP vital recovery</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🛡️</span>
              <span className="font-bold text-white font-semibold">Armor Alloy</span>
              <span className="text-[11px] text-gray-400 mt-1">+35 Armor (Blocks 50% blow)</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">⚡</span>
              <span className="font-bold text-white">Turbine Pack</span>
              <span className="text-[11px] text-gray-400 mt-1">+50% speed for 8 seconds</span>
            </div>
            <div className="bg-slate-950 p-3 rounded border border-slate-850 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🔮</span>
              <span className="font-bold text-white">Shield Dome</span>
              <span className="text-[11px] text-gray-400 mt-1">Blocks 1 hostile shot outright</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
