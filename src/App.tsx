import React, { useState, useEffect, useRef } from 'react';
import { GameState, PlayerStats, Bullet, Particle, FloatingText, Pickup, Obstacle, GameSettings } from './types';
import { MainMenu } from './components/MainMenu';
import { HighScores } from './components/HighScores';
import { HowToPlay } from './components/HowToPlay';
import { SettingsScreen } from './components/SettingsScreen';
import { Lobby } from './components/Lobby';
import { GameHUD } from './components/GameHUD';
import { MatchResults } from './components/MatchResults';
import { playSound } from './utils/audio';
import { generateObstacles, getSpawnPosition } from './utils/mapGenerator';
import { WEAPON_REGISTRY, LEVEL_UP_XP } from './utils/weaponsData';

// Icons used in Pause screen and overlays
import { RotateCcw, Home, Play, Settings, Copy, Check, LogIn, Swords, User } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');

  // Online Multiplayer States
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('');
  const [connectedPlayers, setConnectedPlayers] = useState<any[]>([]);
  const [assignedPlayerId, setAssignedPlayerId] = useState<number | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isLocalReady, setIsLocalReady] = useState<boolean>(false);
  const [playerNameInput, setPlayerNameInput] = useState<string>(() => {
    return localStorage.getItem('neonblast_callsign') || `AGENT_${Math.floor(Math.random() * 900) + 100}`;
  });
  const [showPlaySelector, setShowPlaySelector] = useState<boolean>(false);
  const [showJoinCodeModal, setShowJoinCodeModal] = useState<boolean>(false);
  const [tempJoinCode, setTempJoinCode] = useState<string>('');

  const socketRef = useRef<WebSocket | null>(null);
  const assignedPlayerIdRef = useRef<number | null>(null);
  const localPlayerUidRef = useRef<string>(() => {
    let uid = sessionStorage.getItem('neonblast_uid');
    if (!uid) {
      uid = 'uid_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('neonblast_uid', uid);
    }
    return uid;
  });

  // Master Settings state
  const [settings, setSettings] = useState<GameSettings>({
    volume: 60,
    soundEffectsEnabled: true,
    particlesEnabled: true,
    screenShakeIntensity: 'high',
    friendlyFire: false,
    showFPS: true
  });

  // Lobby matching attributes
  const [lobbyPlayers, setLobbyPlayers] = useState<{ id: number; name: string; isBot: boolean; color: string }[]>([]);
  const [winConditionKills, setWinConditionKills] = useState<number>(10);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(180);
  const [friendlyFire, setFriendlyFire] = useState<boolean>(false);
  const [mapSeed, setMapSeed] = useState<number>(4321);

  // Active playing mirror state to update standard DOM HUD elements without blocking canvas loops
  const [hudPlayersDisplay, setHudPlayersDisplay] = useState<PlayerStats[]>([]);
  const [timeElapsedSeconds, setTimeElapsedSeconds] = useState<number>(0);
  const [killFeed, setKillFeed] = useState<{ id: string; text: string; time: number }[]>([]);
  const [measuredFPS, setMeasuredFPS] = useState<number>(60);

  // Post match statistics placeholder
  const [finalMatchPlayers, setFinalMatchPlayers] = useState<PlayerStats[]>([]);

  // Centered large combo announcements (e.g., "DOUBLE KILL!", "RAMPAGE!")
  const [combatAnnouncement, setCombatAnnouncement] = useState<{ text: string; subtext: string; timeActive: number } | null>(null);

  // Canvas-related React refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playersRef = useRef<PlayerStats[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const pressedKeysRef = useRef<Record<string, boolean>>({});

  // Screen shake and dynamic metrics refs
  const screenShakeRef = useRef<number>(0);
  const timeLimitRef = useRef<number>(180);
  const timeElapsedRef = useRef<number>(0);
  const winConditionKillsRef = useRef<number>(10);
  const friendlyFireRef = useRef<boolean>(false);
  const mapSeedRef = useRef<number>(4321);
  const gameActiveRef = useRef<boolean>(false);
  const sfxEnabledRef = useRef<boolean>(true);
  const volumeValueRef = useRef<number>(60);
  const particlesEnabledRef = useRef<boolean>(true);

  // Mobile controller coordinates
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number } | null>(null);
  const [joystickCenter, setJoystickCenter] = useState<{ x: number; y: number } | null>(null);
  const [mobileMoveVector, setMobileMoveVector] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync settings with refs to keep 60fps physics looped code safe
  useEffect(() => {
    sfxEnabledRef.current = settings.soundEffectsEnabled;
    volumeValueRef.current = settings.volume;
    particlesEnabledRef.current = settings.particlesEnabled;
  }, [settings]);

  // Handle localStorage auto-loads
  useEffect(() => {
    const rawSettings = localStorage.getItem('neonblast_settings');
    if (rawSettings) {
      try {
        setSettings(JSON.parse(rawSettings));
      } catch (e) {
        console.warn("Unable to load saved settings", e);
      }
    }

    // Check if client is mobile
    const handleResize = () => {
      setIsMobile(window.innerWidth < 800 || 'ontouchstart' in window);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // URL Room code join sharing detection
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      const targetRoom = urlRoom.trim().toUpperCase();
      setRoomCode(targetRoom);
      setTempJoinCode(targetRoom);
      setIsMultiplayer(true);
      setShowJoinCodeModal(true);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('neonblast_settings', JSON.stringify(newSettings));
    } catch (e) {}
  };

  const playClickSound = () => {
    playSound('click', settings.volume, settings.soundEffectsEnabled);
  };

  // Connect to the synchronized room codes WS server
  const connectToMultiplayer = (selectedRoomCode: string, nameToUse: string) => {
    const cleanCode = selectedRoomCode.trim().toUpperCase();
    setRoomCode(cleanCode);
    setIsMultiplayer(true);
    setIsLocalReady(false);

    // Force append room query to url safely without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('room', cleanCode);
    window.history.replaceState({}, '', url.toString());

    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join_room",
        roomId: cleanCode,
        uid: localPlayerUidRef.current,
        name: nameToUse
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "join_accepted": {
            assignedPlayerIdRef.current = data.player.id;
            setAssignedPlayerId(data.player.id);
            setFriendlyFire(data.settings.friendlyFire);
            setMapSeed(data.settings.seed);
            setWinConditionKills(data.settings.winConditionKills);
            setTimeLimitSeconds(data.settings.timeLimitSeconds);
            
            friendlyFireRef.current = data.settings.friendlyFire;
            mapSeedRef.current = data.settings.seed;
            winConditionKillsRef.current = data.settings.winConditionKills;
            timeLimitRef.current = data.settings.timeLimitSeconds;
            
            setGameState('lobby');
            break;
          }
          case "join_rejected": {
            alert(`Join Rejected: ${data.reason}`);
            ws.close();
            setGameState('menu');
            break;
          }
          case "room_players_update": {
            setConnectedPlayers(data.players);
            const activeHumans = data.players.filter((p: any) => !p.isBot);
            const isMeHost = activeHumans.sort((a: any, b: any) => a.id - b.id)[0]?.uid === localPlayerUidRef.current;
            setIsHost(isMeHost);
            break;
          }
          case "settings_updated": {
            const { seed, friendlyFire, winConditionKills, timeLimitSeconds } = data.settings;
            setFriendlyFire(friendlyFire);
            setMapSeed(seed);
            setWinConditionKills(winConditionKills);
            setTimeLimitSeconds(timeLimitSeconds);
            
            friendlyFireRef.current = friendlyFire;
            mapSeedRef.current = seed;
            winConditionKillsRef.current = winConditionKills;
            timeLimitRef.current = timeLimitSeconds;
            break;
          }
          case "game_started": {
            const matchPlayers = data.players.map((p: any) => ({
              id: p.id,
              name: p.name,
              isBot: p.isBot,
              color: p.color
            }));
            
            handleStartMatch({
              players: matchPlayers,
              winConditionKills: winConditionKillsRef.current,
              timeLimitSeconds: timeLimitRef.current,
              friendlyFire: friendlyFireRef.current,
              mapSeed: mapSeedRef.current
            });
            break;
          }
          case "server_player_update": {
            const state = data.playerState;
            if (state.id !== assignedPlayerIdRef.current) {
              const playerToUpdate = playersRef.current.find(p => p.id === state.id);
              if (playerToUpdate) {
                playerToUpdate.x = state.x;
                playerToUpdate.y = state.y;
                playerToUpdate.angle = state.angle;
                playerToUpdate.speed = state.speed;
                playerToUpdate.health = state.health;
                playerToUpdate.maxHealth = state.maxHealth;
                playerToUpdate.armor = state.armor;
                playerToUpdate.ammo = state.ammo;
                playerToUpdate.maxAmmo = state.maxAmmo;
                playerToUpdate.totalAmmo = state.totalAmmo;
                playerToUpdate.reloading = state.reloading;
                playerToUpdate.reloadProgress = state.reloadProgress;
                playerToUpdate.weapon = state.weapon;
                playerToUpdate.kills = state.kills;
                playerToUpdate.deaths = state.deaths;
                playerToUpdate.score = state.score;
                playerToUpdate.alive = state.alive;
                playerToUpdate.respawnTimeLeft = state.respawnTimeLeft;
                playerToUpdate.invincible = state.invincible;
                playerToUpdate.level = state.level;
                playerToUpdate.xp = state.xp;
                playerToUpdate.xpToNext = state.xpToNext;
                playerToUpdate.speed_boost = state.speed_boost;
                playerToUpdate.shield_active = state.shield_active;
                playerToUpdate.aim_assist = state.aim_assist;
              }
            }
            break;
          }
          case "server_spawn_bullet": {
            bulletsRef.current.push({
              id: data.bullet.id,
              x: data.bullet.x,
              y: data.bullet.y,
              vx: data.bullet.vx,
              vy: data.bullet.vy,
              damage: data.bullet.damage,
              ownerId: data.bullet.ownerId,
              weapon: data.bullet.weapon,
              piercing: data.bullet.weapon === 'sniper',
              explosive: data.bullet.weapon === 'rocket',
              radius: data.bullet.weapon === 'rocket' ? 6 : data.bullet.weapon === 'sniper' ? 5 : 4,
              color: data.bullet.color,
              trail: [],
              alive: true,
              isHeadshotPossibility: true
            });
            playSound(data.bullet.weapon === 'rocket' ? 'explosion' : 'hit_wall', volumeValueRef.current, sfxEnabledRef.current);
            break;
          }
          case "server_bullet_hit": {
            const { targetId, damage, killerId, isHeadshot } = data.hit;
            const target = playersRef.current.find(p => p.id === targetId);
            if (target && target.alive) {
              if (target.shield_active) {
                target.shield_active = false;
                floatingTextsRef.current.push({
                  id: `dmg-text-${Date.now()}-${Math.random()}`,
                  x: target.x,
                  y: target.y - 25,
                  text: '🛡️ SHIELD BLOCKED!',
                  color: '#38bdf8',
                  size: 11,
                  vy: -1.2,
                  life: 1.0
                });
                spawnSparksBurst(target.x, target.y, '#38bdf8', 'star', 10);
              } else {
                if (target.armor > 0) {
                  const absorbed = Math.round(damage * 0.5);
                  const unabsorbed = damage - absorbed;
                  target.armor = Math.max(0, target.armor - absorbed);
                  target.health -= unabsorbed;
                } else {
                  target.health -= damage;
                }
                spawnSparksBurst(target.x, target.y, target.color, 'spark', 12);
                playSound('hit_player', volumeValueRef.current, sfxEnabledRef.current);
                
                floatingTextsRef.current.push({
                  id: `dmg-text-${Date.now()}-${Math.random()}`,
                  x: target.x,
                  y: target.y - 20,
                  text: isHeadshot ? `💥 HEADSHOT! -${damage}` : `-${damage}`,
                  color: isHeadshot ? '#ff1744' : '#ffea00',
                  size: isHeadshot ? 15 : 12,
                  vy: -1.5,
                  life: 1.2
                });
              }

              if (target.health <= 0 && target.alive) {
                const isMyCasualty = targetId === assignedPlayerIdRef.current;
                const isMyBotCasualty = target.isBot && isHost;
                if (isMyCasualty || isMyBotCasualty) {
                  ws.send(JSON.stringify({
                    type: "player_kill",
                    victimId: target.id,
                    killerId: killerId,
                    weapon: playersRef.current.find(x => x.id === killerId)?.weapon || 'pistol'
                  }));
                }
              }
            }
            break;
          }
          case "server_grab_pickup": {
            const { pickupId, grabberId } = data;
            const pu = pickupsRef.current.find(p => p.id === pickupId);
            const grabber = playersRef.current.find(p => p.id === grabberId);
            if (pu && pu.active && grabber) {
              pu.active = false;
              pu.cooldownLeft = 14500;
              playSound('pickup', volumeValueRef.current, sfxEnabledRef.current);
              spawnSparksBurst(pu.x, pu.y, '#69ff47', 'star', 14);
              triggerPickupReward(grabber, pu);
            }
            break;
          }
          case "server_player_kill": {
            const { victimId, killerId, weapon } = data;
            const victim = playersRef.current.find(p => p.id === victimId);
            const killer = playersRef.current.find(p => p.id === killerId);
            if (victim && victim.alive) {
              victim.health = 0;
              victim.alive = false;
              victim.respawnTimeLeft = 3000;
              victim.deaths++;
              
              const victName = victim.name;
              const killName = killer ? killer.name : 'The Void';
              const victColor = victim.color;

              if (killer) {
                killer.kills++;
                killer.score += 100;
                killer.streak++;
                if (killer.streak > killer.bestStreak) killer.bestStreak = killer.streak;
                killer.xp += 50;
                checkLevelUp(killer);
              }

              setKillFeed(prev => [
                {
                  id: `feed-${Date.now()}-${Math.random()}`,
                  text: `${killName.toUpperCase()} 💀 ${victName.toUpperCase()} (${weapon.toUpperCase()})`,
                  time: Date.now()
                },
                ...prev.slice(0, 4)
              ]);

              spawnSparksBurst(victim.x, victim.y, victColor, 'debris', 25);
              playSound('death', volumeValueRef.current, sfxEnabledRef.current);

              if (killer && killer.kills >= winConditionKillsRef.current) {
                triggerGameOver();
              }
            }
            break;
          }
          case "server_announcement": {
            setCombatAnnouncement({ text: data.text, subtext: data.subtext, timeActive: 1500 });
            break;
          }
        }
      } catch (e) {
        console.error("Websocket parsing error", e);
      }
    };

    ws.onerror = (err) => {
      console.error("Multiplayer server connection error", err);
    };

    ws.onclose = () => {
      setIsMultiplayer(false);
      setGameState('menu');
    };
  };

  const handleUpdateMultiplayerSettings = (settingsSync: {
    seed: number;
    friendlyFire: boolean;
    winConditionKills: number;
    timeLimitSeconds: number;
  }) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && isHost) {
      socketRef.current.send(JSON.stringify({
        type: "update_settings",
        ...settingsSync
      }));
    }
  };

  const handleToggleReady = () => {
    const nextReady = !isLocalReady;
    setIsLocalReady(nextReady);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "toggle_ready",
        isReady: nextReady
      }));
    }
  };

  const handleAddBotMultiplayer = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN && isHost) {
      socketRef.current.send(JSON.stringify({
        type: "add_bot"
      }));
    }
  };

  const handleRemovePlayerMultiplayer = (uid: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && isHost) {
      socketRef.current.send(JSON.stringify({
        type: "remove_player",
        uidToRemove: uid
      }));
    }
  };

  const handleStartMultiplayerMatch = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN && isHost) {
      socketRef.current.send(JSON.stringify({
        type: "start_game"
      }));
    }
  };

  // Pre-game config launcher
  const handleStartMatch = (config: {
    players: { id: number; name: string; isBot: boolean; color: string }[];
    winConditionKills: number;
    timeLimitSeconds: number;
    friendlyFire: boolean;
    mapSeed: number;
  }) => {
    setLobbyPlayers(config.players);
    setWinConditionKills(config.winConditionKills);
    setTimeLimitSeconds(config.timeLimitSeconds);
    setFriendlyFire(config.friendlyFire);
    setMapSeed(config.mapSeed);

    timeLimitRef.current = config.timeLimitSeconds;
    timeElapsedRef.current = 0;
    winConditionKillsRef.current = config.winConditionKills;
    friendlyFireRef.current = config.friendlyFire;
    mapSeedRef.current = config.mapSeed;

    // Build the participants list
    const parsedPlayers: PlayerStats[] = config.players.map((p) => {
      const spawn = getSpawnPosition(p.id, 900, 600);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        x: spawn.x,
        y: spawn.y,
        angle: 0,
        speed: 3.4,
        health: 100,
        maxHealth: 100,
        armor: 0,
        ammo: 12,
        maxAmmo: 12,
        totalAmmo: 99999, // Infinite reserve for pistol
        reloading: false,
        reloadProgress: 0,
        lastShotTime: 0,
        weapon: 'pistol',
        kills: 0,
        deaths: 0,
        score: 0,
        alive: true,
        respawnTimeLeft: 0,
        invincible: true,
        invincibleTimeLeft: 3000, // 3s shielding on spawn
        level: 1,
        xp: 0,
        xpToNext: LEVEL_UP_XP[0],
        speed_boost: false,
        speedBoostTimeLeft: 0,
        shield_active: false,
        aim_assist: false,
        aimAssistTimeLeft: 0,
        streak: 0,
        bestStreak: 0,
        shotsFired: 0,
        shotsHit: 0,
        headshots: 0,
        isBot: p.isBot
      };
    });

    playersRef.current = parsedPlayers;
    bulletsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];

    // Pre-populate static obstacles
    obstaclesRef.current = generateObstacles(config.mapSeed, 900, 600);

    // Populate pickups pads
    const pickupLocations = [
      { x: 180, y: 300 },
      { x: 720, y: 300 },
      { x: 450, y: 150 },
      { x: 450, y: 450 }
    ];

    const types: ('health' | 'armor' | 'speed' | 'shield' | 'aim' | 'weapon' | 'ammo' | 'star')[] = [
      'health', 'armor', 'speed', 'shield', 'aim', 'weapon', 'ammo', 'star'
    ];
    const weaponPool: ('shotgun' | 'rifle' | 'sniper' | 'rocket')[] = ['shotgun', 'rifle', 'sniper', 'rocket'];

    pickupsRef.current = pickupLocations.map((loc, idx) => {
      const type = types[idx % types.length];
      const isW = type === 'weapon';
      return {
        id: `pickup-${idx}`,
        x: loc.x,
        y: loc.y,
        type,
        weaponName: isW ? weaponPool[idx % weaponPool.length] : undefined,
        pulseTimer: 0,
        active: true,
        cooldownLeft: 0
      };
    });

    setKillFeed([{ id: 'init', text: "🏟️ ARENA SIMULATOR ONLINE", time: Date.now() }]);
    setCombatAnnouncement(null);
    gameActiveRef.current = true;
    setGameState('playing');
  };

  // Keyboard mapping bindings helper checks
  const getKeysForMove = (playerId: number) => {
    switch (playerId) {
      case 1:
        return { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', shoot: 'Space', reload: 'KeyQ' };
      case 2:
        return { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shoot: 'Enter', reload: 'ShiftRight' };
      case 3:
        return { up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH', shoot: 'KeyR', reload: 'KeyE' };
      case 4:
        return { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', shoot: 'KeyO', reload: 'KeyU' };
      default:
        return { up: '', down: '', left: '', right: '', shoot: '', reload: '' };
    }
  };

  // Dynamic frame loop
  useEffect(() => {
    if (gameState !== 'playing' || !gameActiveRef.current) return;

    // Track active key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      pressedKeysRef.current[e.code] = true;
      
      // Let P2 also reload with Left-Shift if Right-Shift feels awkward
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        pressedKeysRef.current['ShiftRight'] = true;
      }

      // Quick tab prevention focus losses
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        pressedKeysRef.current['ShiftRight'] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastFrameTime = performance.now();
    let secondTracker = 0;
    let frameCounter = 0;
    let timerAccumulator = 0;
    let animationFrameId: number;

    const gameLoop = (timestamp: number) => {
      const dt = timestamp - lastFrameTime;
      lastFrameTime = timestamp;

      // Track frame rates
      frameCounter++;
      secondTracker += dt;
      if (secondTracker >= 1000) {
        setMeasuredFPS(frameCounter);
        frameCounter = 0;
        secondTracker = 0;
      }

      // Progress global game clock (1s interval)
      timerAccumulator += dt;
      if (timerAccumulator >= 1000) {
        timeElapsedRef.current += 1;
        setTimeElapsedSeconds(timeElapsedRef.current);
        timerAccumulator = 0;

        // Verify bounds of time limits
        if (timeElapsedRef.current >= timeLimitRef.current) {
          triggerGameOver();
          return;
        }
      }

      // Physics + Logic Update
      updateEnginePhysics(dt);

      // Rendering Screen Calls
      renderCanvas();

      if (gameActiveRef.current && gameState === 'playing') {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  // Main combat engine logic
  const updateEnginePhysics = (dt: number) => {
    const players = playersRef.current;
    const bullets = bulletsRef.current;
    const particles = particlesRef.current;
    const floatingTexts = floatingTextsRef.current;
    const pickups = pickupsRef.current;
    const obstacles = obstaclesRef.current;
    const keys = pressedKeysRef.current;
    const now = Date.now();

    // 1. Particle life cycles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * (dt / 16.6);
      p.y += p.vy * (dt / 16.6);
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // 2. Clear out far-faded damage texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * (dt / 16.6);
      ft.life -= dt / 1000;
      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
      }
    }

    // 3. Screen shake decay
    if (screenShakeRef.current > 0) {
      screenShakeRef.current -= 0.4 * (dt / 16.6);
      if (screenShakeRef.current < 0) screenShakeRef.current = 0;
    }

    // 4. Update spawned pickups and pads
    pickups.forEach((pu) => {
      pu.pulseTimer += 0.05 * (dt / 16.6);
      if (!pu.active) {
        pu.cooldownLeft -= dt;
        if (pu.cooldownLeft <= 0) {
          pu.active = true;
          pu.cooldownLeft = 0;
          // Randomize weapon pickups types on respawn
          if (pu.type === 'weapon') {
            const list: ('shotgun' | 'rifle' | 'sniper' | 'rocket')[] = ['shotgun', 'rifle', 'sniper', 'rocket'];
            pu.weaponName = list[Math.floor(Math.random() * list.length)];
          }
        }
      }
    });

    // 5. Update each player
    players.forEach((p) => {
      if (!p.alive) {
        p.respawnTimeLeft -= dt;
        if (p.respawnTimeLeft <= 0) {
          // Trigger respawn at dedicated coordinates!
          const spawn = getSpawnPosition(p.id, 900, 600);
          p.x = spawn.x;
          p.y = spawn.y;
          p.health = p.maxHealth;
          p.armor = 0;
          p.ammo = WEAPON_REGISTRY.pistol.maxAmmo;
          p.totalAmmo = 99999;
          p.weapon = 'pistol';
          p.reloading = false;
          p.alive = true;
          p.invincible = true;
          p.invincibleTimeLeft = 3000;
          p.speed_boost = false;
          p.shield_active = false;
          p.aim_assist = false;
          p.streak = 0;

          // Splash spawn visual smoke
          spawnSparksBurst(p.x, p.y, p.color, 'star', 12);
          playSound('pickup', volumeValueRef.current, sfxEnabledRef.current);
        }
        return;
      }

      // Spawn protection flash tracking
      if (p.invincible) {
        p.invincibleTimeLeft -= dt;
        if (p.invincibleTimeLeft <= 0) {
          p.invincible = false;
        }
      }

      // Speed boost timer
      if (p.speed_boost) {
        p.speedBoostTimeLeft -= dt;
        if (p.speedBoostTimeLeft <= 0) p.speed_boost = false;
      }

      // Aim helper timer
      if (p.aim_assist) {
        p.aimAssistTimeLeft -= dt;
        if (p.aimAssistTimeLeft <= 0) p.aim_assist = false;
      }

      // Reloading speed factors
      const activeSpeed = p.speed_boost ? p.speed * 1.5 : p.speed;

      // MOVEMENT LOGIC
      let dx = 0;
      let dy = 0;

      const isMe = !isMultiplayer || p.id === assignedPlayerIdRef.current;

      if (!p.isBot) {
        if (isMe) {
          // Human input bindings
          const binds = getKeysForMove(p.id);
          if (keys[binds.up]) dy -= 1;
          if (keys[binds.down]) dy += 1;
          if (keys[binds.left]) dx -= 1;
          if (keys[binds.right]) dx += 1;

          // Apply fallback mouse/mobile joystick vector if Player 1 on mobile
          if (p.id === assignedPlayerIdRef.current && isMobile) {
            dx = mobileMoveVector.x;
            dy = mobileMoveVector.y;
          }

          // Apply standard scaling displacement
          if (dx !== 0 || dy !== 0) {
            const length = Math.hypot(dx, dy);
            const moveMultiplier = dt / 15;
            p.x += (dx / length) * activeSpeed * moveMultiplier;
            p.y += (dy / length) * activeSpeed * moveMultiplier;
            p.angle = Math.atan2(dy, dx);

            // Spawn footprint smoke trail
            if (Math.random() < 0.12 && particlesEnabledRef.current) {
              particles.push({
                x: p.x - Math.cos(p.angle) * 10,
                y: p.y - Math.sin(p.angle) * 10,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                color: '#1e1e2e',
                radius: Math.random() * 2 + 1,
                life: 250,
                maxLife: 250,
                decay: 1,
                alpha: 0.4,
                type: 'smoke'
              });
            }
          }
        }
      } else {
        // AI BOT PRACTICE LOGIC
        const runAI = !isMultiplayer || isHost;
        if (runAI) {
          // Locate closest target human/enemy
          let bestTarget: PlayerStats | null = null;
          let bestTargetDist = 999999;
          players.forEach((other) => {
            if (other.id !== p.id && other.alive) {
              const dist = Math.hypot(other.x - p.x, other.y - p.y);
              if (dist < bestTargetDist) {
                bestTargetDist = dist;
                bestTarget = other;
              }
            }
          });

          // Search closest pickups if extremely low on hp or ammo
          let chasePickup: Pickup | null = null;
          if (p.health < 40 || p.ammo === 0) {
            let bestPdist = 400;
            pickups.forEach(pu => {
              if (pu.active) {
                const d = Math.hypot(pu.x - p.x, pu.y - p.y);
                if (d < bestPdist) {
                  bestPdist = d;
                  chasePickup = pu;
                }
              }
            });
          }

          // Decide travel vector
          let targetX = p.x;
          let targetY = p.y;
          let runMovement = false;

          if (chasePickup) {
            targetX = chasePickup.x;
            targetY = chasePickup.y;
            runMovement = true;
          } else if (bestTarget) {
            targetX = bestTarget.x;
            targetY = bestTarget.y;
            runMovement = true;
          }

          if (runMovement) {
            const angleToTarget = Math.atan2(targetY - p.y, targetX - p.x);
            
            // Bots choose ideal weapons engagement distances
            const wep = WEAPON_REGISTRY[p.weapon];
            const rangeLimit = wep.type === 'shotgun' ? 120 : wep.type === 'sniper' ? 380 : 220;

            // Apply path routing
            let travelAngle = angleToTarget;
            if (bestTarget && !chasePickup && bestTargetDist < rangeLimit - 40) {
              // Circle or step back
              travelAngle = angleToTarget + Math.PI / 2; // Strafe path
            }

            const moveMultiplier = dt / 15;
            p.x += Math.cos(travelAngle) * activeSpeed * moveMultiplier;
            p.y += Math.sin(travelAngle) * activeSpeed * moveMultiplier;
            p.angle = angleToTarget; // Face target directly
          }

          // Firing Logic for Bots
          if (bestTarget && bestTargetDist < 450 && p.ammo > 0 && !p.reloading) {
            const wDef = WEAPON_REGISTRY[p.weapon];
            if (now - p.lastShotTime > wDef.fireRate) {
              shootPlayerWeapon(p, p.angle);
            }
          }

          // Reload trigger for Bots
          if (p.ammo === 0 && !p.reloading) {
            triggerPlayerReload(p);
          }
        }
      }

      // CLAMP IN BOUNDARY WALLS (20px thickness padding all around 900x600 layout)
      const rad = 16; // player size
      const boundX = 20;
      const boundY = 20;
      if (p.x < boundX + rad) p.x = boundX + rad;
      if (p.x > 900 - boundX - rad) p.x = 900 - boundX - rad;
      if (p.y < boundY + rad) p.y = boundY + rad;
      if (p.y > 600 - boundY - rad) p.y = 600 - boundY - rad;

      // RESOLVE STATIC INTERIOR RECTANGULAR OBSTACLES COLLISIONS
      obstacles.forEach((obs) => {
        // Circle-AABB collision detection
        const cx = p.x;
        const cy = p.y;
        const rx = obs.x;
        const ry = obs.y;
        const rw = obs.w;
        const rh = obs.h;

        const nearestX = Math.max(rx, Math.min(cx, rx + rw));
        const nearestY = Math.max(ry, Math.min(cy, ry + rh));

        const distX = cx - nearestX;
        const distY = cy - nearestY;
        const distance = Math.hypot(distX, distY);

        if (distance < rad) {
          // Push player back
          if (distance > 0) {
            const overlap = rad - distance;
            p.x += (distX / distance) * overlap;
            p.y += (distY / distance) * overlap;
          } else {
            // If completely inside block (rare bug protection)
            p.x = rx - rad;
          }
        }
      });

      // Human inputs action triggers (shoot or reload taps)
      if (!p.isBot) {
        const binds = getKeysForMove(p.id);
        
        // Shoot held check
        if (keys[binds.shoot] || (p.id === 1 && joystickPos !== null)) {
          const wDef = WEAPON_REGISTRY[p.weapon];
          if (now - p.lastShotTime > wDef.fireRate && !p.reloading) {
            // Facing vector already resolved by controls, shoot bullet!
            shootPlayerWeapon(p, p.angle);
          }
        }

        // Reload key tap check
        if (keys[binds.reload] && !p.reloading && p.ammo < p.maxAmmo) {
          triggerPlayerReload(p);
        }
      }

      // Proceed reloading ticks
      if (p.reloading) {
        p.reloadProgress += dt / WEAPON_REGISTRY[p.weapon].reloadTime;
        if (p.reloadProgress >= 1) {
          // Finished reload
          const wDef = WEAPON_REGISTRY[p.weapon];
          p.ammo = wDef.maxAmmo;
          p.reloading = false;
          p.reloadProgress = 0;
        }
      }

      // Check pickup overlaps
      pickups.forEach((pu) => {
        if (!pu.active) return;
        const dist = Math.hypot(p.x - pu.x, p.y - pu.y);
        
        if (dist < 26) {
          // Collected!
          if (isMultiplayer) {
            const isMe = p.id === assignedPlayerIdRef.current;
            const isBotHost = isHost && p.isBot;
            if (isMe || isBotHost) {
              socketRef.current?.send(JSON.stringify({
                type: "grab_pickup",
                pickupId: pu.id,
                grabberId: p.id
              }));
            }
          } else {
            triggerPickupReward(p, pu);
          }
        }
      });
    });

    // Broadcast client/bots states over WebSocket in game mode
    if (isMultiplayer && socketRef.current?.readyState === WebSocket.OPEN) {
      const localPlayer = players.find(p => p.id === assignedPlayerIdRef.current);
      if (localPlayer) {
        socketRef.current.send(JSON.stringify({
          type: "client_update",
          playerState: {
            id: localPlayer.id,
            name: localPlayer.name,
            color: localPlayer.color,
            x: localPlayer.x,
            y: localPlayer.y,
            angle: localPlayer.angle,
            speed: localPlayer.speed,
            health: localPlayer.health,
            maxHealth: localPlayer.maxHealth,
            armor: localPlayer.armor,
            ammo: localPlayer.ammo,
            maxAmmo: localPlayer.maxAmmo,
            totalAmmo: localPlayer.totalAmmo,
            reloading: localPlayer.reloading,
            reloadProgress: localPlayer.reloadProgress,
            weapon: localPlayer.weapon,
            kills: localPlayer.kills,
            deaths: localPlayer.deaths,
            score: localPlayer.score,
            alive: localPlayer.alive,
            respawnTimeLeft: localPlayer.respawnTimeLeft,
            invincible: localPlayer.invincible,
            level: localPlayer.level,
            xp: localPlayer.xp,
            xpToNext: localPlayer.xpToNext,
            speed_boost: localPlayer.speed_boost,
            shield_active: localPlayer.shield_active,
            aim_assist: localPlayer.aim_assist
          }
        }));
      }

      if (isHost) {
        players.forEach(p => {
          if (p.isBot) {
            socketRef.current?.send(JSON.stringify({
              type: "client_update",
              playerState: {
                id: p.id,
                name: p.name,
                color: p.color,
                x: p.x,
                y: p.y,
                angle: p.angle,
                speed: p.speed,
                health: p.health,
                maxHealth: p.maxHealth,
                armor: p.armor,
                ammo: p.ammo,
                maxAmmo: p.maxAmmo,
                totalAmmo: p.totalAmmo,
                reloading: p.reloading,
                reloadProgress: p.reloadProgress,
                weapon: p.weapon,
                kills: p.kills,
                deaths: p.deaths,
                score: p.score,
                alive: p.alive,
                respawnTimeLeft: p.respawnTimeLeft,
                invincible: p.invincible,
                level: p.level,
                xp: p.xp,
                xpToNext: p.xpToNext,
                speed_boost: p.speed_boost,
                shield_active: p.shield_active,
                aim_assist: p.aim_assist
              }
            }));
          }
        });
      }
    }

    // 6. Update bullets/projectiles
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      
      const speedScale = dt / 15;
      b.x += b.vx * speedScale;
      b.y += b.vy * speedScale;

      // Log trail coordinate points
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 5) b.trail.shift();

      // Check boundary walls hit (20px borders)
      const isWallHit = b.x < 20 || b.x > 880 || b.y < 20 || b.y > 580;
      let destroyBullet = isWallHit;

      // Obstacle collision
      if (!destroyBullet) {
        for (let j = 0; j < obstacles.length; j++) {
          const obs = obstacles[j];
          if (b.x >= obs.x && b.x <= obs.x + obs.w && b.y >= obs.y && b.y <= obs.y + obs.h) {
            if (!b.piercing) {
              destroyBullet = true;
              break;
            } else {
              // Sniper bullet pierce structures but kicks spark particle
              if (Math.random() < 0.2) spawnSparksBurst(b.x, b.y, '#ffffff', 'debris', 3);
            }
          }
        }
      }

      if (destroyBullet) {
        // Bullet registers impact limits
        if (b.explosive) triggerAOEBlast(b.x, b.y, b.ownerId, b.damage);
        else {
          spawnSparksBurst(b.x, b.y, '#ffffff', 'debris', 5);
          playSound('hit_wall', volumeValueRef.current, sfxEnabledRef.current);
        }
        bullets.splice(i, 1);
        continue;
      }

      // Collision checks with active enemies
      let bulletAbsorbed = false;
      for (let j = 0; j < players.length; j++) {
        const p = players[j];
        if (!p.alive || p.invincible) continue;

        // Bullets skip matching shooters unless Friendly Fire is configured True
        if (p.id === b.ownerId) continue;

        const distance = Math.hypot(b.x - p.x, b.y - p.y);
        if (distance < 16 + b.radius) {
          bulletAbsorbed = true;

          if (isMultiplayer) {
            const isBulletOwnedByMe = b.ownerId === assignedPlayerIdRef.current;
            const isBulletOwnedByMyBot = isHost && players.find(x => x.id === b.ownerId)?.isBot;

            if (isBulletOwnedByMe || isBulletOwnedByMyBot) {
              const headshotOffset = 16 * 0.5;
              const isHeadshot = b.y < p.y - headshotOffset;
              let damageToApply = b.damage;
              if (isHeadshot) damageToApply = Math.round(b.damage * 1.5);

              socketRef.current?.send(JSON.stringify({
                type: "bullet_hit",
                hit: {
                  targetId: p.id,
                  damage: damageToApply,
                  killerId: b.ownerId,
                  isHeadshot
                }
              }));
            }
          } else {
            // Check Headshot: is impact inside top 25% sector of vertical cylinder
            const headshotOffset = 16 * 0.5; // upper segment limit
            const isHeadshot = b.y < p.y - headshotOffset;
            
            let damageToApply = b.damage;
            let isCrit = false;

            const shooter = players.find(x => x.id === b.ownerId);
            if (shooter) shooter.shotsHit++;

            if (isHeadshot) {
              damageToApply = Math.round(b.damage * 1.5);
              isCrit = true;
              if (shooter) shooter.headshots++;
            }

            // Deal damage taking Shields and Armor into balance
            if (p.shield_active) {
              p.shield_active = false; // absorbs bullet
              floatingTexts.push({
                id: `dmg-text-${now}-${Math.random()}`,
                x: p.x,
                y: p.y - 25,
                text: '🛡️ SHIELD BLOCKED!',
                color: '#38bdf8',
                size: 11,
                vy: -1.2,
                life: 1.0
              });
              spawnSparksBurst(b.x, b.y, '#38bdf8', 'star', 10);
              playSound('hit_wall', volumeValueRef.current, sfxEnabledRef.current);
            } else {
              // Apply armor absorptions
              if (p.armor > 0) {
                const absorbed = Math.round(damageToApply * 0.5);
                const unabsorbed = damageToApply - absorbed;
                p.armor = Math.max(0, p.armor - absorbed);
                p.health -= unabsorbed;
              } else {
                p.health -= damageToApply;
              }

              // Screen effects
              if (p.id === 1 && !p.isBot) {
                screenShakeRef.current = settings.screenShakeIntensity === 'high' ? 8 : settings.screenShakeIntensity === 'low' ? 3 : 0;
              }

              // Splash blood sparks matching player colors
              spawnSparksBurst(p.x, p.y, p.color, 'spark', 12);
              playSound('hit_player', volumeValueRef.current, sfxEnabledRef.current);

              // Print damage bubble
              floatingTexts.push({
                id: `dmg-text-${now}-${Math.random()}`,
                x: p.x,
                y: p.y - 20,
                text: isCrit ? `💥 HEADSHOT! -${damageToApply}` : `-${damageToApply}`,
                color: isCrit ? '#ffd740' : '#ff1744',
                size: isCrit ? 14 : 11,
                vy: isCrit ? -1.8 : -1.1,
                life: 1.2
              });

              // Inspect casualties death states
              if (p.health <= 0) {
                handlePlayerCasualty(p, b.ownerId, b.weapon, isCrit);
              }
            }
          }

          // Trigger AoE explosions
          if (b.explosive) {
            triggerAOEBlast(b.x, b.y, b.ownerId, b.damage);
          }

          if (!b.piercing) {
            bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    // Mirror participants coordinates to standard hook triggers every 6 frames to save performance
    if (Math.random() < 0.20) {
      setHudPlayersDisplay([...playersRef.current]);
    }
  };

  // Launch weaponry fire
  const shootPlayerWeapon = (p: PlayerStats, fireAngle: number) => {
    const isBotControl = p.isBot && (!isMultiplayer || isHost);
    const isMe = !isMultiplayer || p.id === assignedPlayerIdRef.current;
    if (!isMe && !isBotControl) return;

    const wDef = WEAPON_REGISTRY[p.weapon];
    p.lastShotTime = Date.now();
    p.shotsFired++;

    if (isMultiplayer && socketRef.current?.readyState === WebSocket.OPEN) {
      if (p.weapon === 'shotgun') {
        const pelletDegreeMap = [-0.18, -0.09, 0, 0.09, 0.18];
        pelletDegreeMap.forEach((offsetAngle) => {
          const finalAngle = fireAngle + offsetAngle;
          socketRef.current?.send(JSON.stringify({
            type: "shoot_bullet",
            bullet: {
              id: `bullet-${Date.now()}-${Math.random()}`,
              x: p.x + Math.cos(fireAngle) * 20,
              y: p.y + Math.sin(fireAngle) * 20,
              vx: Math.cos(finalAngle) * wDef.bulletSpeed,
              vy: Math.sin(finalAngle) * wDef.bulletSpeed,
              ownerId: p.id,
              weapon: 'shotgun',
              damage: wDef.damage,
              color: p.color
            }
          }));
        });
      } else {
        socketRef.current?.send(JSON.stringify({
          type: "shoot_bullet",
          bullet: {
            id: `bullet-${Date.now()}-${Math.random()}`,
            x: p.x + Math.cos(fireAngle) * 20,
            y: p.y + Math.sin(fireAngle) * 20,
            vx: Math.cos(fireAngle) * wDef.bulletSpeed,
            vy: Math.sin(fireAngle) * wDef.bulletSpeed,
            ownerId: p.id,
            weapon: p.weapon,
            damage: wDef.damage,
            color: p.color
          }
        }));
      }
    }

    const bullets = bulletsRef.current;
    const vol = volumeValueRef.current;
    const sfx = sfxEnabledRef.current;

    // Shake
    if (p.id === 1 && !p.isBot) {
      screenShakeRef.current = settings.screenShakeIntensity === 'high' ? 5 : settings.screenShakeIntensity === 'low' ? 2.5 : 0;
    }

    let pSound = `gunshot_${p.weapon}`;
    playSound(pSound, vol, sfx);

    // Muzzle fire sparks
    if (particlesEnabledRef.current) {
      for (let s = 0; s < 4; s++) {
        particlesRef.current.push({
          x: p.x + Math.cos(fireAngle) * 22,
          y: p.y + Math.sin(fireAngle) * 22,
          vx: Math.cos(fireAngle + (Math.random() - 0.5) * 0.3) * (wDef.bulletSpeed * 0.4),
          vy: Math.sin(fireAngle + (Math.random() - 0.5) * 0.3) * (wDef.bulletSpeed * 0.4),
          color: p.color,
          radius: Math.random() * 2 + 1,
          life: 80,
          maxLife: 80,
          decay: 1,
          alpha: 1.0,
          type: 'laser'
        });
      }
    }

    // Shotgun fires wide angular spread of 5 distinct bullets
    if (p.weapon === 'shotgun') {
      const pelletDegreeMap = [-0.18, -0.09, 0, 0.09, 0.18];
      pelletDegreeMap.forEach((offsetAngle) => {
        const finalAngle = fireAngle + offsetAngle;
        bullets.push({
          id: `bullet-${Date.now()}-${Math.random()}`,
          x: p.x + Math.cos(fireAngle) * 20,
          y: p.y + Math.sin(fireAngle) * 20,
          vx: Math.cos(finalAngle) * wDef.bulletSpeed,
          vy: Math.sin(finalAngle) * wDef.bulletSpeed,
          damage: wDef.damage,
          ownerId: p.id,
          weapon: 'shotgun',
          piercing: false,
          explosive: false,
          radius: 3,
          color: p.color,
          trail: [],
          alive: true,
          isHeadshotPossibility: true
        });
      });
    } else {
      // Pistol, Rifle, Sniper, Rocket (Single projectile matching weapon behaviors)
      bullets.push({
        id: `bullet-${Date.now()}-${Math.random()}`,
        x: p.x + Math.cos(fireAngle) * 20,
        y: p.y + Math.sin(fireAngle) * 20,
        vx: Math.cos(fireAngle) * wDef.bulletSpeed,
        vy: Math.sin(fireAngle) * wDef.bulletSpeed,
        damage: wDef.damage,
        ownerId: p.id,
        weapon: p.weapon,
        piercing: wDef.piercing,
        explosive: wDef.explosive,
        radius: p.weapon === 'rocket' ? 6 : p.weapon === 'sniper' ? 5 : 4,
        color: p.color,
        trail: [],
        alive: true,
        isHeadshotPossibility: true
      });
    }

    // Decrement ammo
    if (p.weapon !== 'pistol') {
      p.ammo--;
      if (p.ammo <= 0) {
        triggerPlayerReload(p);
      }
    }
  };

  // Reload triggers
  const triggerPlayerReload = (p: PlayerStats) => {
    if (p.reloading) return;
    
    // Check if reserve exists
    const wDef = WEAPON_REGISTRY[p.weapon];
    if (p.weapon !== 'pistol' && p.totalAmmo <= 0) {
      // Out of Ammo text bubble
      floatingTextsRef.current.push({
        id: `no-ammo-${Date.now()}`,
        x: p.x,
        y: p.y - 25,
        text: '⚠️ OUT OF RESERVE AMMO!',
        color: '#ff9800',
        size: 10,
        vy: -1.0,
        life: 1.0
      });
      return;
    }

    p.reloading = true;
    p.reloadProgress = 0;
    playSound('reload', volumeValueRef.current, sfxEnabledRef.current);

    // Deduct total reserve ammo
    if (p.weapon !== 'pistol') {
      const ammoNeeded = wDef.maxAmmo - p.ammo;
      const deduct = Math.min(ammoNeeded, p.totalAmmo);
      p.totalAmmo -= deduct;
    }
  };

  // Handle active pickups pads
  const triggerPickupReward = (p: PlayerStats, pu: Pickup) => {
    pu.active = false;
    pu.cooldownLeft = 14500; // 14.5 seconds pad respawn cooldown

    const text = floatingTextsRef.current;
    const vol = volumeValueRef.current;
    const sfx = sfxEnabledRef.current;

    playSound('pickup', vol, sfx);
    spawnSparksBurst(pu.x, pu.y, '#69ff47', 'star', 14);

    let pickupLabel = '';
    let pColor = '#ffffff';

    switch (pu.type) {
      case 'health':
        p.health = Math.min(p.maxHealth, p.health + 40);
        pickupLabel = '❤️ +40 HEALTH';
        pColor = '#00e676';
        break;
      case 'armor':
        p.armor = Math.min(50, p.armor + 30);
        pickupLabel = '🛡️ +30 SHIELD ARMOR';
        pColor = '#3b82f6';
        break;
      case 'speed':
        p.speed_boost = true;
        p.speedBoostTimeLeft = 8000; // 8 seconds turbine drive
        pickupLabel = '⚡ TURBO ENGINE DRIVE!';
        pColor = '#eab308';
        break;
      case 'shield':
        p.shield_active = true;
        pickupLabel = '🔮 SHIELD DOME ON!';
        pColor = '#a855f7';
        break;
      case 'aim':
        p.aim_assist = true;
        p.aimAssistTimeLeft = 10000;
        pickupLabel = '🎯 TARGET AIM MATRIX LOCK!';
        pColor = '#06b6d4';
        break;
      case 'ammo':
        p.ammo = WEAPON_REGISTRY[p.weapon].maxAmmo;
        if (p.weapon !== 'pistol') {
          p.totalAmmo = Math.min(200, p.totalAmmo + WEAPON_REGISTRY[p.weapon].maxAmmo * 2);
        }
        pickupLabel = '🔫 WEAPON REBARRELED AMMO!';
        pColor = '#f97316';
        break;
      case 'star':
        p.score += 250;
        p.xp = p.xp + 40;
        pickupLabel = '⭐ +250 BONUS CORE POINTS!';
        pColor = '#ffd740';
        checkLevelUp(p);
        break;
      case 'weapon':
        if (pu.weaponName) {
          const wDef = WEAPON_REGISTRY[pu.weaponName];
          p.weapon = pu.weaponName;
          p.ammo = wDef.maxAmmo;
          p.totalAmmo = wDef.maxAmmo * 3; // 3 extra reserve magazines
          p.reloading = false;
          pickupLabel = `🔫 MOUNTED ${wDef.name.toUpperCase()}`;
          pColor = '#ffffff';
        }
        break;
    }

    text.push({
      id: `pickup-txt-${Date.now()}`,
      x: pu.x,
      y: pu.y - 15,
      text: pickupLabel,
      color: pColor,
      size: 11,
      vy: -1.3,
      life: 1.2
    });
  };

  // Rocket launcher area splash explosion damage
  const triggerAOEBlast = (x: number, y: number, shooterId: number, baseDmg: number) => {
    playSound('explosion', volumeValueRef.current, sfxEnabledRef.current);
    
    // Shake screen proportionally
    const humanP = playersRef.current.find(h => h.id === 1 && !h.isBot);
    if (humanP && humanP.alive) {
      const dist = Math.hypot(humanP.x - x, humanP.y - y);
      if (dist < 320) {
        screenShakeRef.current = settings.screenShakeIntensity === 'high' ? 12 : settings.screenShakeIntensity === 'low' ? 5 : 0;
      }
    }

    // Explosion particles
    spawnSparksBurst(x, y, '#f97316', 'spark', 15);
    spawnSparksBurst(x, y, '#7c4dff', 'smoke', 10);

    const players = playersRef.current;
    const blastRadius = 80;

    players.forEach((p) => {
      if (!p.alive) return;
      
      // Skip scorer if Friendly damage fire is turned Off
      if (p.id === shooterId && !friendlyFireRef.current) return;

      const d = Math.hypot(p.x - x, p.y - y);
      if (d < blastRadius) {
        const falloffPct = 1 - d / blastRadius;
        const splashDmg = Math.round(baseDmg * falloffPct);
        
        if (splashDmg > 0) {
          p.health -= splashDmg;
          
          floatingTextsRef.current.push({
            id: `dmg-aoe-${Date.now()}-${Math.random()}`,
            x: p.x,
            y: p.y - 20,
            text: `💥 SPLASH -${splashDmg}`,
            color: '#ef4444',
            size: 10,
            vy: -1.0,
            life: 1.0
          });

          // Check casualties
          if (p.health <= 0) {
            handlePlayerCasualty(p, shooterId, 'rocket', false);
          }
        }
      }
    });
  };

  // Process player deaths
  const handlePlayerCasualty = (victim: PlayerStats, killerId: number, weaponType: string, isHeadshot: boolean) => {
    victim.alive = false;
    victim.deaths++;
    victim.respawnTimeLeft = 3000; // 3 seconds respawn duration ticking
    victim.streak = 0;

    const killer = playersRef.current.find(k => k.id === killerId);
    
    let feedMsg = `💀 ${victim.name.toUpperCase()} was vaporized`;
    if (killer) {
      killer.kills++;
      killer.streak++;
      killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
      
      // Reward kills scores + XP
      const basePoints = 100;
      const bonusCrit = isHeadshot ? 50 : 0;
      const scoreGain = basePoints + bonusCrit;
      
      killer.score += scoreGain;
      killer.xp += isHeadshot ? 75 : 50;

      const weaponLabel = WeaponDisplayKey(weaponType as any);
      feedMsg = `${killer.name.toUpperCase()} 💀 ${victim.name.toUpperCase()} (${isHeadshot ? 'HEADSHOT' : weaponLabel})`;

      // Inspect milestones combos announcements
      if (killer.id === 1 && !killer.isBot) {
        if (killer.streak === 2) {
          triggerBroadcastAnnouncement('DOUBLE ENEMY VAPORIZATION!', 'Score core points accelerated');
        } else if (killer.streak === 3) {
          triggerBroadcastAnnouncement('⚔️ TRIPLE STREAK DOMINION!', 'The arena pulses with your light');
        } else if (killer.streak >= 4) {
          triggerBroadcastAnnouncement('🔥 YOU ARE ON A RAMPAGE!', 'Extreme threat profile established');
        }
      }

      // Check level updates
      checkLevelUp(killer);
    }

    // Play death sound
    playSound('death', volumeValueRef.current, sfxEnabledRef.current);
    
    // Spawn massive particle explosion
    spawnSparksBurst(victim.x, victim.y, victim.color, 'spark', 22);

    // Record list
    const newLogItem = { id: `feed-${Date.now()}-${Math.random()}`, text: feedMsg, time: Date.now() };
    setKillFeed((prev) => [newLogItem, ...prev].slice(0, 5));

    // Verify game victory parameters met
    if (killer && killer.kills >= winConditionKillsRef.current) {
      triggerGameOver();
    }
  };

  const WeaponDisplayKey = (w: string) => {
    switch (w) {
      case 'pistol': return 'Pistol';
      case 'shotgun': return 'Shotgun';
      case 'rifle': return 'Assault';
      case 'sniper': return 'Sniper';
      case 'rocket': return 'Rocket';
      default: return 'Combat';
    }
  };

  // Checks level milestones
  const checkLevelUp = (p: PlayerStats) => {
    if (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level++;
      p.maxHealth += 10;
      p.health = p.maxHealth; // heal to level full
      
      // Upgrade reload and stats
      p.speed += 0.15;
      
      // Calculate next limit threshold
      const nextIdx = Math.min(LEVEL_UP_XP.length - 1, p.level - 1);
      p.xpToNext = LEVEL_UP_XP[nextIdx] + (p.level > 5 ? (p.level - 5) * 150 : 0);

      // Notification
      playSound('levelup', volumeValueRef.current, sfxEnabledRef.current);
      
      floatingTextsRef.current.push({
        id: `lvl-${p.id}-${Date.now()}`,
        x: p.x,
        y: p.y - 30,
        text: `⚡ LEVEL UP! LV.${p.level}`,
        color: '#69ff47',
        size: 13,
        vy: -1.5,
        life: 1.5
      });

      spawnSparksBurst(p.x, p.y, '#69ff47', 'star', 12);
    }
  };

  // Center banner combo announcement emitter
  const triggerBroadcastAnnouncement = (text: string, subtext: string) => {
    playSound('kill', volumeValueRef.current, sfxEnabledRef.current);
    setCombatAnnouncement({ text, subtext, timeActive: 3000 });
  };

  // Particle systems builders
  const spawnSparksBurst = (x: number, y: number, color: string, type: 'spark' | 'smoke' | 'star' | 'debris', count: number) => {
    if (!particlesEnabledRef.current) return;
    const parts = particlesRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      parts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: Math.random() * 3 + 1,
        life: Math.random() * 600 + 400,
        maxLife: 1000,
        decay: 1,
        alpha: 1.0,
        type
      });
    }
  };

  // Match terminations
  const triggerGameOver = () => {
    gameActiveRef.current = false;
    // Mirror players logs
    setFinalMatchPlayers([...playersRef.current]);
    setGameState('gameover');
  };

  // Render loops
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply dynamic screenshake translation offsets
    ctx.save();
    if (screenShakeRef.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Clear with Deep navy background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, 900, 600);

    // 2. Subtle floor grid patterns lines
    ctx.strokeStyle = '#12121e';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < 900; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y < 600; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(900, y);
      ctx.stroke();
    }

    // 3. Draw static obstacles
    obstaclesRef.current.forEach((obs) => {
      // Background solid fill
      ctx.fillStyle = '#181825';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

      // Tech neon borders
      ctx.strokeStyle = '#32324d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

      // Double styled highlight border
      ctx.strokeStyle = '#7c4dff';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(obs.x + 3, obs.y + 3, obs.w - 6, obs.h - 6);
      ctx.restore();
    });

    // 4. Draw pickups pads and rotating particles aura
    pickupsRef.current.forEach((pu) => {
      if (!pu.active) {
        // Draw empty inactive reloading pad
        ctx.strokeStyle = '#1e1e2e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      // Pulse color
      const glowColor = pu.type === 'health' ? '#0bc96c' : pu.type === 'armor' ? '#3b82f6' : pu.type === 'shield' ? '#a855f7' : '#ffd740';
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(pu.pulseTimer) * 0.08;
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, 22 + Math.sin(pu.pulseTimer) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Outer rings
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Draw standard inner symbol values representation
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let symb = '️⚡';
      if (pu.type === 'health') symb = '❤️';
      else if (pu.type === 'armor') symb = '🛡️';
      else if (pu.type === 'shield') symb = '🔮';
      else if (pu.type === 'aim') symb = '🎯';
      else if (pu.type === 'ammo') symb = '📦';
      else if (pu.type === 'star') symb = '⭐';
      else if (pu.type === 'weapon') {
        symb = pu.weaponName === 'shotgun' ? '🔴' : pu.weaponName === 'rifle' ? '🟢' : pu.weaponName === 'sniper' ? '🟣' : '🚀';
      }

      ctx.fillText(symb, pu.x, pu.y);
    });

    // 5. Draw bullets with custom path trails
    bulletsRef.current.forEach((b) => {
      if (b.trail.length > 1 && particlesEnabledRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (let t = 1; t < b.trail.length; t++) {
          ctx.lineTo(b.trail[t].x, b.trail[t].y);
        }
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.radius * 0.9;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.restore();
      }

      // Render actual bullet capsule
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner core core glow element
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Draw players
    playersRef.current.forEach((p) => {
      if (!p.alive) return;

      ctx.save();

      // Spawn flashed blink
      if (p.invincible && Math.floor(Date.now() / 150) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      // Draw speed trails dynamic auras
      if (p.speed_boost && particlesEnabledRef.current) {
        ctx.save();
        ctx.strokeStyle = '#eab308';
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw player outer ring
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.fillStyle = '#12111c';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mini visor showing aimed direction
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 11, p.y + Math.sin(p.angle) * 11, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Gun turret barrel lines
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
      ctx.stroke();

      // Re-enable dome shield block
      if (p.shield_active) {
        ctx.save();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#a855f7';
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 23 + Math.sin(Date.now() / 180) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore(); // end player draws

      // Head text badge above coordinate levels
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.name.toUpperCase(), p.x, p.y - 25);

      // HP indicator lines above player heads
      const barW = 28;
      const barH = 3;
      const barY = p.y - 32;
      const barX = p.x - barW / 2;
      
      ctx.fillStyle = '#1e1b29';
      ctx.fillRect(barX, barY, barW, barH);
      
      const pct = p.health / p.maxHealth;
      ctx.fillStyle = pct < 0.3 ? '#ef4444' : pct < 0.6 ? '#f59e0b' : '#10b981';
      ctx.fillRect(barX, barY, barW * pct, barH);
    });

    // 7. Draw normal spark particles
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      
      if (p.type === 'star') {
        ctx.arc(p.x, p.y, p.radius * 1.6, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      }
      
      ctx.fill();
      ctx.restore();
    });

    // 8. Draw floating text
    floatingTextsRef.current.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px "Orbitron", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 9. Draw standard engine boundaries walls (aesthetic lines)
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 880, 580);
    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 1;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(18, 18, 864, 564);
    ctx.restore();

    ctx.restore(); // ends screen shakes
  };

  // Touch handlers for responsive joystick inputs
  const handleJoystickStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setJoystickCenter({ x: touch.clientX, y: touch.clientY });
    setJoystickPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!joystickCenter) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickCenter.x;
    const dy = touch.clientY - joystickCenter.y;
    const distance = Math.hypot(dx, dy);
    
    const maxRadius = 40;
    let finalX = touch.clientX;
    let finalY = touch.clientY;

    if (distance > maxRadius) {
      finalX = joystickCenter.x + (dx / distance) * maxRadius;
      finalY = joystickCenter.y + (dy / distance) * maxRadius;
    }

    setJoystickPos({ x: finalX, y: finalY });

    // Normalize directional vectors
    const clampDist = Math.min(distance, maxRadius);
    const norX = dx / maxRadius;
    const norY = dy / maxRadius;
    setMobileMoveVector({ x: norX, y: norY });
  };

  const handleJoystickEnd = () => {
    setJoystickCenter(null);
    setJoystickPos(null);
    setMobileMoveVector({ x: 0, y: 0 });
  };

  return (
    <div className="w-full h-full text-slate-100 flex flex-col relative bg-[#020204]">
      
      {/* Route Switchers */}
      {gameState === 'menu' && (
        <MainMenu
          onNavigate={(targetState) => {
            if (targetState === 'lobby') {
              playClickSound();
              setShowPlaySelector(true);
            } else {
              setGameState(targetState);
            }
          }}
          playClickSound={playClickSound}
        />
      )}

      {gameState === 'lobby' && (
        <Lobby
          onNavigate={setGameState}
          playClickSound={playClickSound}
          onStartMatch={handleStartMatch}
          isMultiplayer={isMultiplayer}
          roomCode={roomCode}
          connectedPlayers={connectedPlayers}
          isHost={isHost}
          localPlayerUid={localPlayerUidRef.current}
          isLocalReady={isLocalReady}
          onToggleReady={handleToggleReady}
          onUpdateMultiplayerSettings={handleUpdateMultiplayerSettings}
          onAddBot={handleAddBotMultiplayer}
          onRemovePlayer={handleRemovePlayerMultiplayer}
          onStartMultiplayerMatch={handleStartMultiplayerMatch}
          multiplayerSettings={{
            seed: mapSeed,
            friendlyFire: friendlyFire,
            winConditionKills: winConditionKills,
            timeLimitSeconds: timeLimitSeconds
          }}
        />
      )}

      {gameState === 'settings' && (
        <SettingsScreen
          onNavigate={setGameState}
          playClickSound={playClickSound}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {gameState === 'scores' && (
        <HighScores onNavigate={setGameState} playClickSound={playClickSound} />
      )}

      {gameState === 'howtoplay' && (
        <HowToPlay onNavigate={setGameState} playClickSound={playClickSound} />
      )}

      {gameState === 'gameover' && (
        <MatchResults
          players={finalMatchPlayers}
          onNavigate={setGameState}
          playClickSound={playClickSound}
          onRematch={() => handleStartMatch({
            players: lobbyPlayers,
            winConditionKills,
            timeLimitSeconds,
            friendlyFire,
            mapSeed
          })}
        />
      )}

      {/* Main playing Canvas View with nested HUD overlay */}
      {gameState === 'playing' && (
        <div className="w-full h-full flex flex-col bg-[#0a0a0f] text-white font-sans overflow-hidden select-none">
          {/* Header: Global Status */}
          <header className="h-12 border-b border-[#7c4dff]/20 bg-[#111118] flex items-center justify-between px-6 shrink-0 select-none">
            <div className="flex items-center gap-4">
              <span className="font-black tracking-widest text-[#7c4dff] text-xl font-display">NEONBLAST ARENA</span>
              <span className="px-2 py-0.5 rounded bg-[#1e1e2e] text-[10px] text-gray-400 border border-gray-700 font-mono">v1.4.0-STABLE</span>
            </div>
            <div className="flex gap-8 text-[11px] font-mono tracking-wider">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">SESSION:</span> 
                <span className="text-[#00e5ff] font-bold">
                  {Math.floor(timeElapsedSeconds / 60).toString().padStart(2, '0')}:{(timeElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">LIMIT:</span> 
                <span className="text-white font-bold">{winConditionKills} KILLS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">FPS:</span> 
                <span className={measuredFPS >= 55 ? "text-green-400 font-bold" : measuredFPS >= 30 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>{measuredFPS}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></div>
              <div className="w-2 h-2 rounded-full bg-[#ff4081] shadow-[0_0_8px_#ff4081]"></div>
              <div className="w-2 h-2 rounded-full bg-[#69ff47] shadow-[0_0_8px_#69ff47]"></div>
              <div className="w-2 h-2 rounded-full bg-[#ffd740] shadow-[0_0_8px_#ffd740]"></div>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden relative">
            
            {/* Sidebar: Game Settings/Lobby */}
            <aside className="w-64 bg-[#111118]/80 border-r border-[#7c4dff]/20 p-4 flex flex-col gap-6 select-none shrink-0">
              <section>
                <h3 className="text-[10px] text-[#7c4dff] font-bold tracking-widest uppercase mb-3">Match Settings</h3>
                <div className="space-y-2">
                  <div className="p-2 bg-[#1e1e2e] border border-gray-800 rounded flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Map Seed</span>
                    <span className="text-white font-mono">#{mapSeed}</span>
                  </div>
                  <div className="p-2 bg-[#1e1e2e] border border-gray-800 rounded flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Friendly Fire</span>
                    <span className={friendlyFire ? "text-red-400 font-bold" : "text-green-400 font-bold"}>{friendlyFire ? "ON" : "OFF"}</span>
                  </div>
                  <div className="p-2 bg-[#1e1e2e] border border-gray-800 rounded flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Shake Intensity</span>
                    <span className="text-white uppercase font-bold text-[10px]">{settings.screenShakeIntensity}</span>
                  </div>
                </div>
              </section>
              
              <section className="flex-1">
                <h3 className="text-[10px] text-[#7c4dff] font-bold tracking-widest uppercase mb-3">Live Standings</h3>
                <div className="space-y-1 font-mono text-xs">
                  {[...(hudPlayersDisplay.length > 0 ? hudPlayersDisplay : playersRef.current)]
                    .sort((a, b) => b.kills - a.kills || b.score - a.score)
                    .map((p, idx) => (
                      <div key={p.id} className="flex justify-between items-center py-1 border-b border-gray-800/50">
                        <span className="flex items-center gap-1 uppercase font-bold truncate max-w-[150px]" style={{ color: p.color }}>
                          P{p.id}. {p.name}
                        </span>
                        <span className="text-white font-bold">{p.kills}</span>
                      </div>
                    ))}
                </div>
              </section>

              <div className="mt-auto">
                <button
                  id="sidebar-btn-pause"
                  onClick={() => {
                    playClickSound();
                    gameActiveRef.current = false;
                    setGameState('paused');
                  }}
                  className="w-full py-3 bg-[#7c4dff]/20 hover:bg-[#7c4dff]/40 text-white border border-[#7c4dff] text-xs font-bold uppercase tracking-widest rounded transition-all cursor-pointer shadow-[0_0_15px_rgba(124,77,255,0.2)]"
                >
                  Pause Game
                </button>
              </div>
            </aside>

            {/* The Arena & Overlays */}
            <main className="flex-1 bg-[#111118]/40 relative flex items-center justify-center overflow-hidden p-4">
              
              {/* Grid Overlays */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundSize: '40px 40px',
                backgroundImage: 'linear-gradient(to right, #7c4dff 1px, transparent 1px), linear-gradient(to bottom, #7c4dff 1px, transparent 1px)'
              }}></div>
              
              {/* Scanline Overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-40 z-10 scanlines"></div>

              {/* Main game board */}
              <div className="relative border border-[#7c4dff]/30 bg-black rounded shadow-[0_0_35px_rgba(124,77,255,0.15)] aspect-[3/2] w-full max-w-[900px] max-h-[600px] overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={600}
                  className="w-full h-full block"
                />
              </div>

              {/* Kill Feed Overlay inside Top-Right of Arena */}
              <div className="absolute top-4 right-4 w-52 space-y-1.5 z-30 font-mono text-[9px] pointer-events-none">
                {killFeed.map((feed) => (
                  <div key={feed.id} className="bg-black/85 border border-[#7c4dff]/20 px-3 py-1.5 flex items-center justify-between border-l-2" style={{ borderLeftColor: '#7c4dff' }}>
                    <span className="text-gray-300 tracking-tight leading-normal uppercase">{feed.text}</span>
                  </div>
                ))}
              </div>

              {/* Render Combat Combos Centered Announcement banners */}
              {combatAnnouncement && (
                <div className="absolute inset-0 flex items-center justify-center p-4 z-35 animate-fade-in-scale pointer-events-none select-none">
                  <div className="bg-gradient-to-r from-transparent via-black/90 to-transparent w-full py-4 text-center border-y border-[#7c4dff]/30">
                    <h2 className="text-2xl md:text-3xl font-extrabold font-display text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(124,77,255,0.5)]">
                      {combatAnnouncement.text}
                    </h2>
                    <p className="text-[10px] text-center text-[#7c4dff] tracking-[0.1em] mt-1 font-mono uppercase">
                      {combatAnnouncement.subtext}
                    </p>
                  </div>
                </div>
              )}

              {/* Mobile Controls (Rendered if Mobile) */}
              {isMobile && (
                <>
                  <div className="absolute bottom-6 left-6 w-24 h-24 rounded-full bg-slate-900/30 border border-slate-700/60 z-35 touch-none"
                       onTouchStart={handleJoystickStart}
                       onTouchMove={handleJoystickMove}
                       onTouchEnd={handleJoystickEnd}>
                    {joystickPos && joystickCenter && (
                      <div
                        className="absolute w-8 h-8 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${joystickPos.x - joystickCenter.x + 48}px`,
                          top: `${joystickPos.y - joystickCenter.y + 48}px`,
                        }}
                      />
                    )}
                  </div>

                  <div className="absolute bottom-6 right-6 flex gap-4 pointer-events-auto z-40">
                    <button
                      id="mobile-btn-reload"
                      onTouchStart={() => {
                        playClickSound();
                        const p = playersRef.current.find(x => x.id === 1);
                        if (p && !p.reloading && p.ammo < p.maxAmmo) triggerPlayerReload(p);
                      }}
                      className="w-14 h-14 rounded-full bg-slate-900/80 border border-neon-pink/40 text-neon-pink text-[10px] font-bold font-mono tracking-tighter flex items-center justify-center transition-all active:scale-95 shadow-md shadow-neon-pink/10"
                    >
                      RELOAD
                    </button>
                  </div>
                </>
              )}

            </main>
          </div>

          {/* Footer HUD Area */}
          <footer className="h-40 bg-[#0a0a0f] border-t border-[#7c4dff]/20 flex gap-2 p-2 shrink-0 overflow-x-auto w-full select-none">
            {/* Map each players dynamically here inside footer as fully functional panels matching the design aesthetic */}
            {[...(hudPlayersDisplay.length > 0 ? hudPlayersDisplay : playersRef.current)]
              .sort((a, b) => a.id - b.id)
              .map((p) => {
                const hpPct = Math.max(0, (p.health / p.maxHealth) * 100);
                const xpPct = (p.xp / p.xpToNext) * 100;
                
                const ammosLabel = p.weapon === 'pistol' ? `${p.ammo} / ∞` : `${p.ammo} / ${p.totalAmmo}`;

                if (!p.alive) {
                  return (
                    <div key={p.id} className="flex-1 min-w-[200px] bg-[#111118] rounded border border-gray-850 p-3 flex flex-col items-center justify-center relative">
                      <div className="absolute inset-0 bg-[#0a0a0f]/85 flex flex-col items-center justify-center rounded">
                        <span className="text-[#ffd740] font-mono text-base font-bold animate-pulse tracking-wide">RESPAWNING</span>
                        <span className="text-[10px] text-gray-500 mt-1 uppercase font-mono">
                          {Math.ceil(p.respawnTimeLeft / 1000)} Seconds
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold tracking-wider font-mono uppercase">
                        P{p.id} | {p.name}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={p.id}
                    className="flex-1 min-w-[220px] bg-[#111118] rounded border p-3 flex flex-col justify-between"
                    style={{ borderColor: `${p.color}40`, boxShadow: `0 0 10px ${p.color}05` }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold tracking-wider uppercase font-mono" style={{ color: p.color }}>
                          P{p.id} | {p.name}
                        </span>
                        <span className="text-xs font-mono text-gray-300 mt-0.5 font-bold">
                          🔫 {p.weapon.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        {p.reloading ? (
                          <div className="text-[10px] text-neon-pink font-bold font-mono animate-pulse uppercase">RELOADING</div>
                        ) : (
                          <span className="text-base font-mono leading-none font-bold text-white tracking-wide">
                            {ammosLabel}
                          </span>
                        )}
                        <div className="text-[8px] text-gray-500 uppercase font-mono mt-0.5">Ammo units</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-1.5">
                      <div className="flex justify-between text-[9px] uppercase font-bold font-mono">
                        <span className={hpPct <= 25 ? "text-red-500 animate-pulse" : "text-gray-400"}>
                          {hpPct <= 25 ? "🚨 CRITICAL" : "HEALTH MATRIX"}
                        </span>
                        <span style={{ color: p.color }}>{Math.round(hpPct)}%</span>
                      </div>
                      
                      {/* Health and Armor composite bars */}
                      <div className="h-2 bg-gray-900 rounded-full overflow-hidden relative">
                        <div
                          className="h-full transition-all duration-200"
                          style={{
                            width: `${hpPct}%`,
                            background: `linear-gradient(to right, #ef4444, ${p.color})`,
                            boxShadow: `0 0 8px ${p.color}`
                          }}
                        ></div>
                        {p.armor > 0 && (
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-[#3b82f6] shadow-[0_0_6px_#3b82f6] transition-all duration-200"
                            style={{ width: `${(p.armor / 50) * 100}%` }}
                          ></div>
                        )}
                      </div>

                      {/* XP Bar */}
                      <div className="h-1 bg-gray-900 rounded-full overflow-hidden mt-1 relative">
                        <div className="h-full bg-[#7c4dff]" style={{ width: `${xpPct}%` }}></div>
                      </div>

                      <div className="flex justify-between text-[8px] text-gray-500 font-mono">
                        <span>LVL {p.level}</span>
                        <span>XP {p.xp} / {p.xpToNext}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </footer>

        </div>
      )}

      {/* PAUSE POPUP MODAL */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center scanlines">
          <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center max-w-sm w-full font-mono text-xs">
            
            {/* Title */}
            <h1 className="text-3xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-pink drop-shadow-[0_0_12px_rgba(0,229,255,0.3)] mb-2 select-none">
              SIMULATION PAUSED
            </h1>
            <p className="text-gray-400 mb-8 uppercase tracking-widest text-[10px]">Tread carefully commander</p>

            {/* Menu options buttons */}
            <div className="flex flex-col gap-3 font-semibold text-sm">
              <button
                id="btn-pause-resume"
                onClick={() => {
                  playClickSound();
                  gameActiveRef.current = true;
                  setGameState('playing');
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan font-bold rounded border border-neon-cyan transition-all"
              >
                <Play className="w-4 h-4 fill-neon-cyan" />
                <span>RESUME ENGAGEMENT</span>
              </button>

              <button
                id="btn-pause-restart"
                onClick={() => {
                  playClickSound();
                  handleStartMatch({
                    players: lobbyPlayers,
                    winConditionKills,
                    timeLimitSeconds,
                    friendlyFire,
                    mapSeed
                  });
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-600 rounded transition-all text-gray-300"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESTART ROUND</span>
              </button>

              <button
                id="btn-pause-settings"
                onClick={() => {
                  playClickSound();
                  setGameState('settings');
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-600 rounded transition-all text-gray-300"
              >
                <Settings className="w-4 h-4" />
                <span>GAME SETTINGS</span>
              </button>

              <button
                id="btn-pause-menu"
                onClick={() => {
                  playClickSound();
                  setGameState('menu');
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-600 rounded transition-all text-gray-300"
              >
                <Home className="w-4 h-4" />
                <span>ABANDON TO MENU</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🔮 MULTIPLAYER PLAY SELECTOR OVERLAY MODAL */}
      {showPlaySelector && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border-2 border-[#7c4dff]/40 p-6 md:p-8 rounded-xl max-w-md w-full shadow-[0_0_50px_rgba(124,77,255,0.3)] animate-fade-in-scale select-none">
            
            <h2 className="text-xl md:text-2xl font-extrabold font-display tracking-wider text-center text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-purple-300 to-neon-pink mb-2">
              ENGAGEMENT MODE
            </h2>
            <p className="text-center text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-6">
              Select Combat Operations Type
            </p>

            <div className="flex flex-col gap-4">
              {/* Option 1: Offline Training Mode */}
              <button
                id="play-opt-offline"
                onClick={() => {
                  playClickSound();
                  setIsMultiplayer(false);
                  setShowPlaySelector(false);
                  setGameState('lobby');
                }}
                className="group flex flex-col items-start p-4 hover:bg-slate-900 border border-slate-800 hover:border-[#69ff47] rounded-lg transition-all relative overflow-hidden text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#69ff47] group-hover:animate-ping"></span>
                  <span className="text-sm font-bold font-display tracking-wide text-[#69ff47]">BOT PRACTICE ARENA</span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  Offline battle. Split desktop keyboard controls with customizable AI simulation bots.
                </p>
              </button>

              {/* Option 2: Live Room Link Sharing Multiplayer */}
              <button
                id="play-opt-multiplayer"
                onClick={() => {
                  playClickSound();
                  setShowPlaySelector(false);
                  setShowJoinCodeModal(true);
                }}
                className="group flex flex-col items-start p-4 hover:bg-slate-900 border border-slate-800 hover:border-neon-cyan rounded-lg transition-all relative overflow-hidden text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-neon-cyan group-hover:animate-pulse"></span>
                  <span className="text-sm font-bold font-display tracking-wide text-neon-cyan">ONLINE SECTOR HUB</span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  Play over link-sharing. Connect up to 6 players from any device in real-time.
                </p>
              </button>
            </div>

            <button
              id="selector-cancel"
              onClick={() => { playClickSound(); setShowPlaySelector(false); }}
              className="mt-6 w-full py-2 border border-slate-800 hover:border-slate-500 rounded font-mono text-xs text-gray-400 hover:text-white bg-slate-900/40 transition-all uppercase cursor-pointer"
            >
              Cancel Selection
            </button>
          </div>
        </div>
      )}

      {/* 🛰️ ONLINE CONFIG / NAME MODAL */}
      {showJoinCodeModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-55 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-[#00e5ff]/30 p-6 md:p-8 rounded-xl max-w-sm w-full shadow-[0_0_40px_rgba(0,229,255,0.15)] select-none">
            
            <h2 className="text-lg md:text-xl font-bold font-display text-center text-neon-cyan mb-2 tracking-widest uppercase">
              SECTOR GATEWAY
            </h2>
            <p className="text-center text-gray-500 font-mono text-[9px] uppercase tracking-widest mb-6">
              Establish Mission Profile
            </p>

            <div className="space-y-4">
              {/* callsings input */}
              <div>
                <label className="block text-[10px] font-mono text-[#a0a5cc] tracking-widest uppercase mb-1.5">Your Callsign Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4.5 h-4.5 text-gray-500" />
                  <input
                    id="multi-player-name-input"
                    type="text"
                    maxLength={12}
                    value={playerNameInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlayerNameInput(val);
                      localStorage.setItem('neonblast_callsign', val);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 pl-10 pr-4 py-2 text-[#00e5ff] font-display font-bold text-sm rounded outline-none focus:border-[#00e5ff] transition-all"
                  />
                </div>
              </div>

              {/* Room action selection */}
              <div className="pt-2 flex flex-col gap-3">
                {roomCode && (
                  <button
                    id="btn-gateway-join-direct"
                    onClick={() => {
                      playClickSound();
                      connectToMultiplayer(roomCode, playerNameInput || 'Player');
                      setShowJoinCodeModal(false);
                    }}
                    className="w-full py-3.5 bg-neon-pink/20 hover:bg-[#ff4081]/30 text-neon-pink border-2 border-neon-pink rounded-lg font-bold font-display text-sm transition-all uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer pulse-glow-pink"
                  >
                    <LogIn className="w-5 h-5 animate-pulse" />
                    <span>Deploy to Sector: {roomCode}</span>
                  </button>
                )}

                <button
                  id="btn-gateway-create"
                  onClick={() => {
                    playClickSound();
                    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
                    connectToMultiplayer(code, playerNameInput || 'Player');
                    setShowJoinCodeModal(false);
                  }}
                  className="w-full py-2.5 bg-neon-cyan/15 hover:bg-neon-cyan/25 text-[#00e5ff] border border-neon-cyan/40 hover:border-neon-cyan rounded font-bold font-display text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  <span>Create New Mission Room</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-900"></div>
                  <span className="flex-shrink mx-3 text-gray-600 text-[9px] font-mono">OR JOIN EXISTING ENEMY SECTOR</span>
                  <div className="flex-grow border-t border-slate-900"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    id="gateway-code-field"
                    type="text"
                    maxLength={6}
                    placeholder="ROOM CODE"
                    value={tempJoinCode}
                    onChange={(e) => setTempJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-neon-pink text-white font-mono font-bold text-center text-sm rounded outline-none p-2 tracking-widest uppercase"
                  />
                  <button
                    id="btn-gateway-join"
                    onClick={() => {
                      playClickSound();
                      if (!tempJoinCode.trim()) {
                        alert("Please enter a valid room code.");
                        return;
                      }
                      connectToMultiplayer(tempJoinCode, playerNameInput || 'Player');
                      setShowJoinCodeModal(false);
                    }}
                    className="px-4 bg-neon-pink/15 hover:bg-neon-pink/25 text-[#ff4081] border border-[#ff4081]/40 hover:border-[#ff4081] rounded font-bold font-display text-xs transition-all uppercase tracking-wider flex items-center justify-center cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <button
              id="gateway-cancel"
              onClick={() => {
                playClickSound();
                setShowJoinCodeModal(false);
                // Clear any potential room search param
                const url = new URL(window.location.href);
                url.search = '';
                window.history.replaceState({}, '', url.toString());
              }}
              className="mt-6 w-full py-1.5 border border-slate-900 hover:border-slate-800 rounded font-mono text-[10px] text-gray-600 hover:text-gray-400 bg-slate-950 transition-all uppercase cursor-pointer"
            >
              Abstain
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
