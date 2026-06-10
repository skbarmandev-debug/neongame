import React, { useState, useEffect } from 'react';
import { Settings, ArrowLeft, Volume2, VolumeX, Eye, Shield, Zap, RefreshCw } from 'lucide-react';
import { GameState, GameSettings } from '../types';

interface SettingsScreenProps {
  onNavigate: (state: GameState) => void;
  playClickSound: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onNavigate,
  playClickSound,
  settings,
  onUpdateSettings
}) => {
  const [localSettings, setLocalSettings] = useState<GameSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateField = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    playClickSound();
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleReset = () => {
    playClickSound();
    const defaults: GameSettings = {
      volume: 60,
      soundEffectsEnabled: true,
      particlesEnabled: true,
      screenShakeIntensity: 'high',
      friendlyFire: false,
      showFPS: true
    };
    setLocalSettings(defaults);
    onUpdateSettings(defaults);
  };

  const handleBack = () => {
    playClickSound();
    onNavigate('menu');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-radial from-[#0f0c1b] via-[#050409] to-[#010103] p-6 scanlines">
      <div className="w-full max-w-xl bg-slate-950/80 border border-slate-800 p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-neon-pink drop-shadow-[0_0_10px_rgba(255,102,178,0.4)]" />
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-wider">GAME SETTINGS</h1>
          </div>
          <button
            id="back-btn-settings"
            onClick={handleBack}
            className="flex items-center gap-2 text-[#a0a5cc] hover:text-white px-3 py-1.5 border border-slate-700 hover:border-slate-500 rounded bg-slate-900 transition-all text-sm font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU</span>
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-6 font-mono text-xs md:text-sm">
          
          {/* Master Volume */}
          <div className="bg-slate-900/40 border border-slate-900 p-4 rounded flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="font-bold flex items-center gap-2 text-gray-200">
                <Volume2 className="w-4 h-4 text-neon-cyan" />
                MASTER VOLUME ({localSettings.volume}%)
              </span>
              {localSettings.volume === 0 && <VolumeX className="w-4 h-4 text-red-500" />}
            </div>
            <input
              id="slider-volume"
              type="range"
              min="0"
              max="100"
              step="5"
              value={localSettings.volume}
              onChange={(e) => updateField('volume', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-neon-cyan focus:outline-none"
            />
          </div>

          {/* Sound FX */}
          <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-900 rounded">
            <span className="font-bold text-gray-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-neon-green" /> SOUND EFFECTS UNIT
            </span>
            <button
              id="btn-settings-sfx"
              onClick={() => updateField('soundEffectsEnabled', !localSettings.soundEffectsEnabled)}
              className={`px-4 py-1.5 text-xs rounded font-bold transition-all border ${
                localSettings.soundEffectsEnabled
                  ? 'bg-neon-green/10 border-neon-green text-neon-green shadow-[0_0_10px_rgba(105,255,71,0.2)]'
                  : 'bg-slate-900 border-slate-700 text-gray-400'
              }`}
            >
              {localSettings.soundEffectsEnabled ? 'ACTIVE' : 'MUTED'}
            </button>
          </div>

          {/* Graphics quality / particles */}
          <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-900 rounded">
            <span className="font-bold text-gray-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-neon-pink" /> SPARKLE & PARTICLE EFFECTS
            </span>
            <button
              id="btn-settings-particles"
              onClick={() => updateField('particlesEnabled', !localSettings.particlesEnabled)}
              className={`px-4 py-1.5 text-xs rounded font-bold transition-all border ${
                localSettings.particlesEnabled
                  ? 'bg-neon-pink/10 border-neon-pink text-neon-pink shadow-[0_0_10px_rgba(255,64,129,0.2)]'
                  : 'bg-slate-900 border-slate-700 text-gray-400'
              }`}
            >
              {localSettings.particlesEnabled ? 'MAX (60FPS)' : 'LOW QUALITY'}
            </button>
          </div>

          {/* Screen Shake */}
          <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-900 rounded">
            <span className="font-bold text-gray-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-neon-yellow animate-bounce" /> SHOOTING SCREEN SHAKE
            </span>
            <div className="flex gap-2">
              {(['off', 'low', 'high'] as const).map((level) => (
                <button
                  key={level}
                  id={`btn-shake-${level}`}
                  onClick={() => updateField('screenShakeIntensity', level)}
                  className={`px-3 py-1.5 text-xs rounded font-bold transition-all border uppercase ${
                    localSettings.screenShakeIntensity === level
                      ? 'bg-neon-yellow/10 border-neon-yellow text-neon-yellow shadow-[0_0_10px_rgba(255,215,64,0.2)]'
                      : 'bg-slate-900 border-slate-750 text-gray-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Friendly Fire */}
          <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-900 rounded">
            <span className="font-bold text-gray-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" /> BATTLE FRIENDLY FIRE
            </span>
            <button
              id="btn-settings-friendly"
              onClick={() => updateField('friendlyFire', !localSettings.friendlyFire)}
              className={`px-4 py-1.5 text-xs rounded font-bold transition-all border ${
                localSettings.friendlyFire
                  ? 'bg-orange-500/10 border-orange-500 text-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                  : 'bg-slate-900 border-slate-700 text-gray-400'
              }`}
            >
              {localSettings.friendlyFire ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Show FPS */}
          <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-900 rounded">
            <span className="font-bold text-gray-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" /> SHOW LIVE ENGINE FPS
            </span>
            <button
              id="btn-settings-fps"
              onClick={() => updateField('showFPS', !localSettings.showFPS)}
              className={`px-4 py-1.5 text-xs rounded font-bold transition-all border ${
                localSettings.showFPS
                  ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-900 border-slate-700 text-gray-400'
              }`}
            >
              {localSettings.showFPS ? 'SHOWING' : 'HIDDEN'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 pt-4 border-t border-slate-900 flex justify-between">
          <button
            id="btn-settings-reset"
            onClick={handleReset}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-gray-400 hover:text-white border border-slate-800 hover:border-slate-600 rounded transition-all font-mono"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESET TO DEFAULTS</span>
          </button>
          <button
            id="btn-settings-save-back"
            onClick={handleBack}
            className="px-5 py-1.5 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-xs font-bold text-neon-cyan border border-neon-cyan rounded transition-all font-mono"
          >
            APPLY & BACK
          </button>
        </div>
      </div>
    </div>
  );
};
