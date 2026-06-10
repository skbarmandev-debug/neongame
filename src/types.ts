export type GameState = 'menu' | 'lobby' | 'playing' | 'paused' | 'gameover' | 'scores' | 'settings' | 'howtoplay';

export type WeaponType = 'pistol' | 'shotgun' | 'rifle' | 'sniper' | 'rocket';

export interface WeaponDef {
  type: WeaponType;
  name: string;
  damage: number;
  fireRate: number; // millisecond delay between shots
  maxAmmo: number;
  reloadTime: number; // ms
  bulletSpeed: number;
  range: number; // max pixels or travel duration
  piercing: boolean;
  explosive: boolean;
  notes: string;
}

export interface PlayerStats {
  id: number; // 1 to 4
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  health: number;
  maxHealth: number;
  armor: number; // 0 to 50
  ammo: number;
  maxAmmo: number;
  totalAmmo: number;
  reloading: boolean;
  reloadProgress: number; // 0 to 1
  lastShotTime: number;
  weapon: WeaponType;
  kills: number;
  deaths: number;
  score: number;
  alive: boolean;
  respawnTimeLeft: number; // ms
  invincible: boolean;
  invincibleTimeLeft: number; // ms
  level: number;
  xp: number;
  xpToNext: number;
  speed_boost: boolean;
  speedBoostTimeLeft: number; // ms
  shield_active: boolean; // absorbs 1 bullet
  aim_assist: boolean;
  aimAssistTimeLeft: number; // ms
  streak: number;
  bestStreak: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  isBot: boolean;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  ownerId: number;
  weapon: WeaponType;
  piercing: boolean;
  explosive: boolean;
  radius: number;
  color: string;
  trail: { x: number; y: number }[];
  alive: boolean;
  isHeadshotPossibility: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  decay: number;
  type: 'spark' | 'smoke' | 'debris' | 'star' | 'laser';
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  vy: number;
  life: number; // 0 to 1
}

export type PickupType = 'health' | 'armor' | 'speed' | 'shield' | 'aim' | 'grenade' | 'ammo' | 'star' | 'weapon';

export interface Pickup {
  id: string;
  x: number;
  y: number;
  type: PickupType;
  weaponName?: WeaponType;
  pulseTimer: number;
  active: boolean;
  cooldownLeft: number; // ms
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'block' | 'pillar' | 'wall';
}

export interface GameSettings {
  volume: number; // 0 to 100
  soundEffectsEnabled: boolean;
  particlesEnabled: boolean;
  screenShakeIntensity: 'off' | 'low' | 'high';
  friendlyFire: boolean;
  showFPS: boolean;
}

export interface HighScore {
  name: string;
  score: number;
  kd: string;
  date: string;
}

export interface LobbyPlayerConfig {
  id: number;
  name: string;
  active: boolean;
  color: string;
}
