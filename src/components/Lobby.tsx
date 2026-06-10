import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, User, Bot, CircleSlash, RefreshCw, Dices, Copy, Check, Plus, Trash2 } from 'lucide-react';
import { GameState } from '../types';

interface LobbyProps {
  onNavigate: (state: GameState) => void;
  playClickSound: () => void;
  
  // Local match triggers
  onStartMatch: (config: {
    players: { id: number; name: string; isBot: boolean; color: string }[];
    winConditionKills: number;
    timeLimitSeconds: number;
    friendlyFire: boolean;
    mapSeed: number;
  }) => void;

  // Multiplayer attributes
  isMultiplayer: boolean;
  roomCode?: string;
  connectedPlayers?: { id: number; uid: string; name: string; color: string; isReady: boolean; isBot: boolean }[];
  isHost?: boolean;
  localPlayerUid?: string;
  isLocalReady?: boolean;
  onToggleReady?: () => void;
  onUpdateMultiplayerSettings?: (settings: {
    seed: number;
    friendlyFire: boolean;
    winConditionKills: number;
    timeLimitSeconds: number;
  }) => void;
  onAddBot?: () => void;
  onRemovePlayer?: (uid: string) => void;
  onStartMultiplayerMatch?: () => void;
  multiplayerSettings?: {
    seed: number;
    friendlyFire: boolean;
    winConditionKills: number;
    timeLimitSeconds: number;
  };
}

export const Lobby: React.FC<LobbyProps> = ({
  onNavigate,
  playClickSound,
  onStartMatch,

  // Multiplayer
  isMultiplayer,
  roomCode = '',
  connectedPlayers = [],
  isHost = false,
  localPlayerUid = '',
  isLocalReady = false,
  onToggleReady,
  onUpdateMultiplayerSettings,
  onAddBot,
  onRemovePlayer,
  onStartMultiplayerMatch,
  multiplayerSettings = { seed: 4321, friendlyFire: false, winConditionKills: 10, timeLimitSeconds: 180 }
}) => {
  // Local Player form state setup (used in local matching mode only)
  const [p1Name, setP1Name] = useState('P1_Neo');
  const [p2Name, setP2Name] = useState('P2_Glow');
  const [p3Name, setP3Name] = useState('P3_Specter');
  const [p4Name, setP4Name] = useState('P4_Amber');

  // Local matching Status: 'human' | 'bot' | 'off'
  const [p2Type, setP2Type] = useState<'human' | 'bot' | 'off'>('human');
  const [p3Type, setP3Type] = useState<'human' | 'bot' | 'off'>('bot');
  const [p4Type, setP4Type] = useState<'human' | 'bot' | 'off'>('off');

  // Matches configurations
  const [killLimit, setKillLimit] = useState<number>(10);
  const [timeLimit, setTimeLimit] = useState<number>(180); // 180 seconds (3 mins)
  const [friendlyFire, setFriendlyFire] = useState<boolean>(false);
  const [mapSeed, setMapSeed] = useState<number>(4321);

  const [copied, setCopied] = useState(false);

  // Sync settings when multiplayer loads new room updates
  useEffect(() => {
    if (isMultiplayer && multiplayerSettings) {
      setKillLimit(multiplayerSettings.winConditionKills);
      setTimeLimit(multiplayerSettings.timeLimitSeconds);
      setFriendlyFire(multiplayerSettings.friendlyFire);
      setMapSeed(multiplayerSettings.seed);
    }
  }, [isMultiplayer, multiplayerSettings]);

  const handleCopyLink = () => {
    playClickSound();
    const inviteLink = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const randomizeSeed = () => {
    playClickSound();
    const newSeed = Math.floor(Math.random() * 9000) + 1000;
    if (isMultiplayer && onUpdateMultiplayerSettings) {
      onUpdateMultiplayerSettings({
        seed: newSeed,
        friendlyFire,
        winConditionKills: killLimit,
        timeLimitSeconds: timeLimit
      });
    } else {
      setMapSeed(newSeed);
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    if (isMultiplayer) {
      if (!isHost || !onUpdateMultiplayerSettings) return;
      const updated = {
        seed: field === 'seed' ? value : mapSeed,
        friendlyFire: field === 'friendlyFire' ? value : friendlyFire,
        winConditionKills: field === 'killLimit' ? value : killLimit,
        timeLimitSeconds: field === 'timeLimit' ? value : timeLimit
      };
      onUpdateMultiplayerSettings(updated);
    } else {
      if (field === 'seed') setMapSeed(value);
      if (field === 'friendlyFire') setFriendlyFire(value);
      if (field === 'killLimit') setKillLimit(value);
      if (field === 'timeLimit') setTimeLimit(value);
    }
  };

  const handleStart = () => {
    playClickSound();

    if (isMultiplayer) {
      if (isHost && onStartMultiplayerMatch) {
        onStartMultiplayerMatch();
      }
      return;
    }

    // Collect active players for offline local match
    const playersToStart = [
      { id: 1, name: p1Name || 'Player 1', isBot: false, color: '#00e5ff' } // P1 is always active human
    ];

    if (p2Type !== 'off') {
      playersToStart.push({
        id: 2,
        name: p2Name || 'Player 2',
        isBot: p2Type === 'bot',
        color: '#ff4081'
      });
    }
    if (p3Type !== 'off') {
      playersToStart.push({
        id: 3,
        name: p3Name || 'Player 3',
        isBot: p3Type === 'bot',
        color: '#69ff47'
      });
    }
    if (p4Type !== 'off') {
      playersToStart.push({
        id: 4,
        name: p4Name || 'Player 4',
        isBot: p4Type === 'bot',
        color: '#ffd740'
      });
    }

    onStartMatch({
      players: playersToStart,
      winConditionKills: killLimit,
      timeLimitSeconds: timeLimit,
      friendlyFire,
      mapSeed
    });
  };

  const handleBack = () => {
    playClickSound();
    onNavigate('menu');
  };

  // Build grid of connected players (6 slots for multiplayer, 4 slots for local)
  const maxSlots = isMultiplayer ? 6 : 4;
  const lobbyBannerTitle = isMultiplayer ? `ONLINE COMBAT ARENA` : `COMBAT LOBBY`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white bg-radial from-[#0f0c1b] via-[#050409] to-[#010103] p-4 md:p-6 scanlines">
      <div className="w-full max-w-4xl bg-slate-950/80 border border-[#7c4dff]/25 p-6 md:p-8 rounded-xl shadow-[0_0_30px_rgba(124,77,255,0.15)] z-10 max-h-[96vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[#00e5ff] text-xl md:text-2xl font-bold font-display animate-pulse">⚡</span>
            <h1 className="text-xl md:text-3xl font-extrabold font-display tracking-wider">{lobbyBannerTitle}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {isMultiplayer && (
              <button
                id="btn-copy-invite"
                onClick={handleCopyLink}
                className="flex items-center gap-2 text-[#00e5ff] hover:text-white px-3 py-1.5 border border-[#00e5ff]/40 hover:border-[#00e5ff] rounded bg-slate-900 transition-all text-xs font-mono font-bold"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'COPIED LINK!' : 'SHARE INVITE'}</span>
              </button>
            )}

            <button
              id="back-btn-lobby"
              onClick={handleBack}
              className="flex items-center gap-2 text-[#a0a5cc] hover:text-white px-3 py-1.5 border border-slate-700 hover:border-slate-500 rounded bg-slate-900 transition-all text-xs font-mono"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
              <span>EXIT</span>
            </button>
          </div>
        </div>

        {/* Room information if multiplayer */}
        {isMultiplayer && (
          <div className="bg-[#1e1e2e]/70 border border-[#7c4dff]/20 px-4 py-3 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 text-xs font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-400">ROOM ID:</span>
              <span className="bg-[#7c4dff]/20 text-[#00e5ff] font-bold px-3 py-1 border border-[#00e5ff]/20 rounded tracking-wider text-sm">
                {roomCode}
              </span>
              <span className="text-gray-400 ml-2">MATCH LEVEL:</span>
              <span className="text-white font-bold">{connectedPlayers.length}/6 PARTICIPANTS</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-gray-400 font-bold uppercase text-[10px]">LOBBY SYNC ACTIVE</span>
            </div>
          </div>
        )}

        {/* Players setup roster */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          
          {isMultiplayer ? (
            // Multiplayer joined players cards (up to 6)
            Array.from({ length: 6 }).map((_, idx) => {
              const slotId = idx + 1;
              const player = connectedPlayers.find(p => p.id === slotId);

              // Unoccupied slot
              if (!player) {
                return (
                  <div key={`empty-slot-${slotId}`} className="bg-slate-950/20 border border-dashed border-slate-800 p-4 rounded-lg flex flex-col items-center justify-center min-h-[150px] opacity-60">
                    <span className="text-[10px] font-mono text-gray-600 mb-2">SLOT 0{slotId}</span>
                    <CircleSlash className="w-8 h-8 text-slate-800 mb-2" />
                    <span className="text-xs font-mono text-gray-500 tracking-wider">WAITING PLAYER</span>
                    {isHost && onAddBot && (
                      <button
                        id={`btn-add-bot-slot-${slotId}`}
                        onClick={() => { playClickSound(); onAddBot(); }}
                        className="mt-3 flex items-center gap-1 py-1 px-2.5 border border-[#69ff47]/30 hover:border-[#69ff47] bg-[#69ff47]/5 hover:bg-[#69ff47]/15 rounded text-[10px] font-mono font-bold text-[#69ff47] transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> ADD BOT
                      </button>
                    )}
                  </div>
                );
              }

              const isMe = player.uid === localPlayerUid;

              return (
                <div
                  key={`player-slot-${player.uid}`}
                  className="bg-slate-900/60 p-4 rounded-lg flex flex-col justify-between min-h-[150px] border transition-all"
                  style={{
                    borderColor: `${player.color}40`,
                    boxShadow: isMe ? `0 0 15px ${player.color}15` : 'none'
                  }}
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-mono text-[#a0a5cc]">SLOT 0{player.id}</span>
                      <span className="text-[10px] flex items-center gap-1 font-bold font-mono px-2 py-0.5 rounded uppercase"
                        style={{ backgroundColor: `${player.color}18`, color: player.color }}>
                        {player.isBot ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {player.isBot ? 'BOT' : isMe ? 'YOU' : 'CLIENT'}
                      </span>
                    </div>

                    <div className="font-display font-bold text-base truncate tracking-wide flex items-center gap-2" style={{ color: player.color }}>
                      <span className="text-xs select-none">▶</span> {player.name}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800/40 pt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: player.color }}></div>
                      <span className="text-[10px] font-mono text-gray-400 capitalize">Pistol</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {player.isReady ? (
                        <span className="text-[9px] font-mono font-black text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded tracking-widest uppercase">READY</span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded tracking-widest uppercase animate-pulse">SLEEP</span>
                      )}

                      {/* Let host kick bot or client */}
                      {isHost && (!isMe || player.isBot) && onRemovePlayer && (
                        <button
                          id={`kick-btn-${player.uid}`}
                          onClick={() => { playClickSound(); onRemovePlayer(player.uid); }}
                          title="Remove from Room"
                          className="p-1 hover:text-red-400 transition-colors text-gray-500 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // Offline local user setup (Slots 1 to 4)
            <>
              {/* Player 1 Card */}
              <div className="bg-slate-900/60 border border-[#00e5ff]/40 p-4 rounded-lg shadow-[0_0_15px_rgba(0,229,255,0.1)] flex flex-col justify-between min-h-[180px]">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-[#a0a5cc]">SLOT 01</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#00e5ff] font-mono tracking-widest bg-[#00e5ff]/10 px-2 py-0.5 rounded">
                      <User className="w-3 h-3" /> P1 HUMAN
                    </span>
                  </div>
                  <label className="block text-[11px] font-mono text-[#a0a5cc] uppercase tracking-wider mb-1">CALLSIGN</label>
                  <input
                    id="lobby-p1-name"
                    type="text"
                    maxLength={10}
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-[#00e5ff] text-[#00e5ff] font-display font-medium text-sm px-2.5 py-1.5 rounded outline-none"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></div>
                  <span className="text-xs font-mono text-gray-400">Weapon: Pistol</span>
                </div>
              </div>

              {/* Player 2 Card */}
              <div className={`p-4 rounded-lg flex flex-col justify-between min-h-[180px] border transition-all ${
                p2Type === 'off' ? 'bg-slate-950/20 border-slate-900 opacity-50' : p2Type === 'bot' ? 'bg-slate-900/40 border-purple-900/40' : 'bg-slate-900/60 border-[#ff4081]/40 shadow-[0_0_15px_rgba(255,64,129,0.1)]'
              }`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-[#a0a5cc]">SLOT 02</span>
                    <span className="text-[11px] flex items-center gap-1 font-bold font-mono text-[#ff4081] bg-[#ff4081]/10 px-2 py-0.5 rounded capitalize">
                      {p2Type === 'human' ? <User className="w-3 h-3" /> : p2Type === 'bot' ? <Bot className="w-3 h-3" /> : <CircleSlash className="w-3 h-3" />}
                      {p2Type}
                    </span>
                  </div>
                  <label className="block text-[11px] font-mono text-[#a0a5cc] uppercase tracking-wider mb-1">CALLSIGN</label>
                  <input
                    id="lobby-p2-name"
                    type="text"
                    maxLength={10}
                    value={p2Name}
                    disabled={p2Type === 'off'}
                    onChange={(e) => setP2Name(e.target.value)}
                    className="w-full bg-slate-950 disabled:bg-slate-900 disabled:text-gray-500 border border-slate-850 focus:border-[#ff4081] text-[#ff4081] font-display font-medium text-sm px-2.5 py-1.5 rounded outline-none"
                  />
                </div>
                
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex gap-1.5">
                    {(['human', 'bot', 'off'] as const).map((t) => (
                      <button
                        key={t}
                        id={`p2-type-${t}`}
                        onClick={() => { playClickSound(); setP2Type(t); }}
                        className={`flex-1 text-[10px] font-mono font-bold py-1 px-1 rounded uppercase border ${
                          p2Type === t ? 'border-[#ff4081] text-[#ff4081] bg-[#ff4081]/10' : 'border-slate-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player 3 Card */}
              <div className={`p-4 rounded-lg flex flex-col justify-between min-h-[180px] border transition-all ${
                p3Type === 'off' ? 'bg-slate-950/20 border-slate-900 opacity-50' : p3Type === 'bot' ? 'bg-slate-900/60 border-[#69ff47]/40 shadow-[0_0_15px_rgba(105,255,71,0.1)]' : 'bg-slate-900/60 border-[#69ff47]/40'
              }`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-[#a0a5cc]">SLOT 03</span>
                    <span className="text-[11px] flex items-center gap-1 font-bold font-mono text-[#69ff47] bg-[#69ff47]/10 px-2 py-0.5 rounded capitalize">
                      {p3Type === 'human' ? <User className="w-3 h-3" /> : p3Type === 'bot' ? <Bot className="w-3 h-3" /> : <CircleSlash className="w-3 h-3" />}
                      {p3Type}
                    </span>
                  </div>
                  <label className="block text-[11px] font-mono text-[#a0a5cc] uppercase tracking-wider mb-1">CALLSIGN</label>
                  <input
                    id="lobby-p3-name"
                    type="text"
                    maxLength={10}
                    value={p3Name}
                    disabled={p3Type === 'off'}
                    onChange={(e) => setP3Name(e.target.value)}
                    className="w-full bg-slate-950 disabled:bg-slate-900 disabled:text-gray-500 border border-slate-850 focus:border-[#69ff47] text-[#69ff47] font-display font-medium text-sm px-2.5 py-1.5 rounded outline-none"
                  />
                </div>
                
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex gap-1.5">
                    {(['human', 'bot', 'off'] as const).map((t) => (
                      <button
                        key={t}
                        id={`p3-type-${t}`}
                        onClick={() => { playClickSound(); setP3Type(t); }}
                        className={`flex-1 text-[10px] font-mono font-bold py-1 px-1 rounded uppercase border ${
                          p3Type === t ? 'border-[#69ff47] text-[#69ff47] bg-[#69ff47]/10' : 'border-slate-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player 4 Card */}
              <div className={`p-4 rounded-lg flex flex-col justify-between min-h-[180px] border transition-all ${
                p4Type === 'off' ? 'bg-slate-950/20 border-slate-900 opacity-50' : p4Type === 'bot' ? 'bg-slate-900/60 border-[#ffd740]/40 shadow-[0_0_15px_rgba(255,215,64,0.1)]' : 'bg-slate-900/60 border-[#ffd740]/40'
              }`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-[#a0a5cc]">SLOT 04</span>
                    <span className="text-[11px] flex items-center gap-1 font-bold font-mono text-[#ffd740] bg-[#ffd740]/10 px-2 py-0.5 rounded capitalize">
                      {p4Type === 'human' ? <User className="w-3 h-3" /> : p4Type === 'bot' ? <Bot className="w-3 h-3" /> : <CircleSlash className="w-3 h-3" />}
                      {p4Type}
                    </span>
                  </div>
                  <label className="block text-[11px] font-mono text-[#a0a5cc] uppercase tracking-wider mb-1">CALLSIGN</label>
                  <input
                    id="lobby-p4-name"
                    type="text"
                    maxLength={10}
                    value={p4Name}
                    disabled={p4Type === 'off'}
                    onChange={(e) => setP4Name(e.target.value)}
                    className="w-full bg-slate-950 disabled:bg-slate-900 disabled:text-gray-500 border border-slate-850 focus:border-[#ffd740] text-[#ffd740] font-display font-medium text-sm px-2.5 py-1.5 rounded outline-none"
                  />
                </div>
                
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex gap-1.5">
                    {(['human', 'bot', 'off'] as const).map((t) => (
                      <button
                        key={t}
                        id={`p4-type-${t}`}
                        onClick={() => { playClickSound(); setP4Type(t); }}
                        className={`flex-1 text-[10px] font-mono font-bold py-1 px-1 rounded uppercase border ${
                          p4Type === t ? 'border-[#ffd740] text-[#ffd740] bg-[#ffd740]/10' : 'border-slate-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Configurations Parameters Box */}
        <div className="bg-[#111118]/80 border border-slate-900 p-6 rounded-lg mb-8">
          <h2 className="text-xs font-bold font-mono text-[#a0a5cc] tracking-widest uppercase mb-4">MATCH DIRECTIVES</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs">
            
            {/* Win Condition - Kills */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-400">WIN THRESHOLD (KILLS)</label>
              <select
                id="lobby-kill-limit"
                value={killLimit}
                disabled={isMultiplayer && !isHost}
                onChange={(e) => handleConfigChange('killLimit', parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 disabled:bg-slate-900 disabled:text-gray-500 text-gray-200 px-3 py-2 rounded focus:outline-none focus:border-slate-600 cursor-pointer disabled:cursor-not-allowed"
              >
                <option value={5}>First to 5 Kills</option>
                <option value={10}>First to 10 Kills</option>
                <option value={15}>First to 15 Kills</option>
                <option value={20}>First to 20 Kills</option>
                <option value={25}>First to 25 Kills</option>
              </select>
            </div>

            {/* Time limit */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-400">ROUND TIME LIMIT</label>
              <select
                id="lobby-time-limit"
                value={timeLimit}
                disabled={isMultiplayer && !isHost}
                onChange={(e) => handleConfigChange('timeLimit', parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 disabled:bg-slate-900 disabled:text-gray-500 text-gray-200 px-3 py-2 rounded focus:outline-none cursor-pointer disabled:cursor-not-allowed"
              >
                <option value={60}>1 Minute (Fast Blitz)</option>
                <option value={180}>3 Minutes (Standard Match)</option>
                <option value={300}>5 Minutes (Extended Combat)</option>
                <option value={600}>10 Minutes (Durable Siege)</option>
              </select>
            </div>

            {/* Friendly Fire */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-400">FRIENDLY DAMAGE FIRE</label>
              <button
                id="btn-ff-toggle"
                disabled={isMultiplayer && !isHost}
                onClick={() => { playClickSound(); handleConfigChange('friendlyFire', !friendlyFire); }}
                className={`w-full py-2 px-3 border rounded text-center font-bold transition-all disabled:opacity-50 ${
                  friendlyFire
                    ? 'border-orange-500 text-orange-500 bg-orange-500/10'
                    : 'border-slate-800 text-gray-400 bg-slate-950 hover:text-white disabled:hover:text-gray-400'
                }`}
              >
                {friendlyFire ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Map Seed */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 flex justify-between">
                <span>MAP GENERATOR SEED</span>
                <span className="text-[#00e5ff] select-none">{mapSeed}</span>
              </label>
              <div className="flex gap-1">
                <input
                  id="lobby-map-seed"
                  type="number"
                  min={1}
                  max={99999}
                  value={mapSeed}
                  disabled={isMultiplayer && !isHost}
                  onChange={(e) => handleConfigChange('seed', Math.max(1, parseInt(e.target.value) || 1234))}
                  className="flex-1 bg-slate-950 border border-slate-800 disabled:bg-slate-900 disabled:text-gray-500 text-gray-200 px-2.5 py-1 rounded focus:outline-none"
                />
                <button
                  id="button-randomize-seed"
                  disabled={isMultiplayer && !isHost}
                  onClick={randomizeSeed}
                  title="Randomize Map Obstacles"
                  className="px-3 bg-slate-900 border border-slate-800 disabled:opacity-50 hover:border-slate-500 hover:bg-slate-850 rounded text-gray-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
                >
                  <Dices className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
          {isMultiplayer && (
            <button
              id="multiplayer-toggle-ready-btn"
              onClick={() => { playClickSound(); if (onToggleReady) onToggleReady(); }}
              className={`w-full sm:w-[240px] px-6 py-4 font-bold tracking-widest rounded-lg transform hover:scale-105 duration-300 border-2 transition-all cursor-pointer ${
                isLocalReady
                  ? 'border-green-500 text-green-400 hover:bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                  : 'border-[#ff4081] text-[#ff4081] hover:bg-[#ff4081]/10 shadow-[0_0_15px_rgba(255,64,129,0.2)]'
              }`}
            >
              {isLocalReady ? '✓ STATUS: READY' : '✗ MARK: READY NOW'}
            </button>
          )}

          {(!isMultiplayer || isHost) && (
            <button
              id="lobby-start-btn"
              disabled={isMultiplayer && connectedPlayers.some(p => !p.isReady && p.uid !== localPlayerUid)}
              onClick={handleStart}
              className="flex items-center justify-center gap-3 w-full sm:w-[320px] px-8 py-4 bg-transparent border-2 border-[#69ff47] text-[#69ff47] disabled:border-gray-800 disabled:text-gray-500 disabled:hover:scale-100 disabled:shadow-none hover:bg-[#69ff47]/10 font-bold tracking-widest rounded-lg transform hover:scale-105 duration-300 shadow-[0_0_20px_rgba(105,255,71,0.2)] hover:shadow-[0_0_30px_rgba(105,255,71,0.4)] cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {isMultiplayer 
                  ? connectedPlayers.some(p => !p.isReady && p.uid !== localPlayerUid) ? 'WAITING FOR READY' : 'LAUNCH SIMULATION' 
                  : 'LAUNCH SIMULATION'
                }
              </span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
