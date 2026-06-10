import { WeaponDef, WeaponType } from '../types';

export const WEAPON_REGISTRY: Record<WeaponType, WeaponDef> = {
  pistol: {
    type: 'pistol',
    name: 'Neon Pistol',
    damage: 20,
    fireRate: 400, // delay in ms
    maxAmmo: 12,
    reloadTime: 1000,
    bulletSpeed: 8,
    range: 65, // travel ticks
    piercing: false,
    explosive: false,
    notes: 'Default weapon. Infinite reserve ammo.'
  },
  shotgun: {
    type: 'shotgun',
    name: 'Pulse Shotgun',
    damage: 13, // 13 * 5 = 65 potential damage if all connect
    fireRate: 850,
    maxAmmo: 6,
    reloadTime: 1800,
    bulletSpeed: 7,
    range: 18, // short range
    piercing: false,
    explosive: false,
    notes: 'Devastating scatter. Fires 5-pellet spread.'
  },
  rifle: {
    type: 'rifle',
    name: 'Assault Laser',
    damage: 12,
    fireRate: 150,
    maxAmmo: 30,
    reloadTime: 1500,
    bulletSpeed: 11,
    range: 60,
    piercing: false,
    explosive: false,
    notes: 'Full-automatic fire rate. Highly stable.'
  },
  sniper: {
    type: 'sniper',
    name: 'Vortex Sniper',
    damage: 80,
    fireRate: 1600,
    maxAmmo: 5,
    reloadTime: 2500,
    bulletSpeed: 20,
    range: 80,
    piercing: true,
    explosive: false,
    notes: 'One-shot potential. Bullets pierce targets & walls.'
  },
  rocket: {
    type: 'rocket',
    name: 'Fusion Launcher',
    damage: 60,
    fireRate: 1200,
    maxAmmo: 3,
    reloadTime: 3000,
    bulletSpeed: 5,
    range: 70,
    piercing: false,
    explosive: true,
    notes: 'Launches unstable core with heavy explosive splash area.'
  }
};

export const LEVEL_UP_XP = [100, 220, 380, 580, 850]; // XP thresholds

export function getStatForLevel(level: number): { name: string; description: string } {
  switch (level) {
    case 1:
      return { name: 'Recruit', description: 'Base speed and stats.' };
    case 2:
      return { name: 'Agility Boost', description: 'Movement speed +5%.' };
    case 3:
      return { name: 'Bulk Upgrade', description: 'Maximum Health +10 HP.' };
    case 4:
      return { name: 'Fast Fingers', description: 'Reload speed +10% faster.' };
    case 5:
      return { name: 'Supercharged', description: 'Raw bullet damage output +10%.' };
    default:
      return { name: 'Apex Predator', description: 'Gain extreme status protection.' };
  }
}
