const adjectives = [
  'Stormy','Cosmic','Shadow','Neon','Mystic','Lunar','Velvet','Crystal','Thunder',
  'Golden','Silver','Crimson','Phantom','Blaze','Frost','Wild','Ember','Dusk',
  'Midnight','Astral','Savage','Silent','Rapid','Toxic','Vivid','Hollow','Rogue',
  'Wicked','Brave','Stealthy','Hazy','Fiery','Icy','Dark','Bright','Rustic',
  'Swift','Lucky','Noble','Witty','Chill','Zen','Electric','Sonic','Atomic'
];

const animals = [
  'Fox','Wolf','Hawk','Raven','Panther','Tiger','Cobra','Viper','Phoenix',
  'Dragon','Falcon','Jaguar','Lynx','Eagle','Bear','Lion','Shark','Orca',
  'Puma','Owl','Crow','Bat','Stag','Moth','Crane','Dove','Hound','Mink',
  'Ferret','Mantis','Python','Scorpion','Beetle','Wasp','Hornet','Coyote',
  'Badger','Otter','Seal','Rhino','Gecko','Asp','Jackal','Ibis','Condor'
];

export function generateUsername(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${animal}·${num}`;
}

export function getInitials(name: string): string {
  const parts = name.split(/[·.]/);
  return parts[0]?.substring(0, 2).toUpperCase() || '??';
}
