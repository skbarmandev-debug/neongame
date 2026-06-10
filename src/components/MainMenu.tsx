import React from 'react';
import { Play, Trophy, Settings, HelpCircle, Gamepad2 } from 'lucide-react';
import { GameState } from '../types';

interface MainMenuProps {
  onNavigate: (state: GameState) => void;
  playClickSound: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, playClickSound }) => {
  const handleBtnClick = (state: GameState) => {
    playClickSound();
    onNavigate(state);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-radial from-[#0f0c1b] via-[#050409] to-[#010103] p-6 relative overflow-hidden scanlines">
      {/* Background Neon Elements */}
      <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-[#00e5ff] opacity-5 blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#ff4081] opacity-5 blur-[140px] pointer-events-none animate-pulse"></div>

      <div className="z-10 text-center max-w-xl flex flex-col items-center">
        {/* Animated Accent Icon */}
        <div className="mb-6 relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full border border-neon-cyan opacity-25 animate-ping"></div>
          <div className="absolute w-16 h-16 rounded-full border border-neon-pink opacity-50 animate-pulse"></div>
          <Gamepad2 className="w-12 h-12 text-neon-cyan relative z-10" />
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold font-display tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-purple-400 to-neon-pink drop-shadow-[0_0_20px_rgba(0,229,255,0.4)] mb-2 select-none">
          NEONBLAST
        </h1>
        <p className="text-sm font-mono tracking-[0.3em] text-[#a0a5cc] uppercase mb-12">
          Arena Combat Simulator
        </p>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-4 w-full sm:w-[320px]">
          <button
            id="menu-btn-play"
            onClick={() => handleBtnClick('lobby')}
            className="group relative flex items-center justify-center gap-3 px-6 py-4 bg-transparent border-2 border-neon-cyan text-neon-cyan font-bold tracking-wider rounded-lg transition-all duration-300 transform hover:scale-105 hover:bg-neon-cyan/10 pulse-glow-cyan overflow-hidden"
          >
            <Play className="w-5 h-5 fill-neon-cyan text-neon-cyan group-hover:scale-110 duration-200" />
            <span>PLAY NOW</span>
          </button>

          <button
            id="menu-btn-settings"
            onClick={() => handleBtnClick('settings')}
            className="group flex items-center justify-center gap-3 px-6 py-3.5 bg-slate-900/60 border border-slate-700 hover:border-neon-pink text-gray-200 hover:text-white rounded-lg transition-all duration-300 hover:bg-neon-pink/10 hover:shadow-[0_0_15px_rgba(255,64,129,0.3)]"
          >
            <Settings className="w-4 h-4 text-neon-pink group-hover:rotate-45 duration-300" />
            <span className="font-semibold tracking-wide text-sm">GAME SETTINGS</span>
          </button>

          <button
            id="menu-btn-scores"
            onClick={() => handleBtnClick('scores')}
            className="group flex items-center justify-center gap-3 px-6 py-3.5 bg-slate-900/60 border border-slate-700 hover:border-[#69ff47] text-gray-200 hover:text-white rounded-lg transition-all duration-300 hover:bg-[#69ff47]/10 hover:shadow-[0_0_15px_rgba(105,255,71,0.3)]"
          >
            <Trophy className="w-4 h-4 text-neon-green" />
            <span className="font-semibold tracking-wide text-sm">ALL-TIME SCORES</span>
          </button>

          <button
            id="menu-btn-how"
            onClick={() => handleBtnClick('howtoplay')}
            className="group flex items-center justify-center gap-3 px-6 py-3.5 bg-slate-900/60 border border-slate-700 hover:border-neon-yellow text-gray-200 hover:text-white rounded-lg transition-all duration-300 hover:bg-neon-yellow/10 hover:shadow-[0_0_15px_rgba(255,215,64,0.3)]"
          >
            <HelpCircle className="w-4 h-4 text-neon-yellow" />
            <span className="font-semibold tracking-wide text-sm">HOW TO PLAY</span>
          </button>
        </div>

        <p className="mt-16 text-[11px] font-mono text-[#4b4e6d] select-none">
          LOCAL MULTIPLAYER • NO PLUGINS • HIGH REFRESH RATE
        </p>
      </div>
    </div>
  );
};
