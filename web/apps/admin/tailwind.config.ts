import type { Config } from 'tailwindcss';
import preset from '../../tailwind.preset';

const config: Config = {
  presets: [preset],
  // Scanne l'app ET le package UI partagé (sinon les classes des composants communs seraient purgées).
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
};
export default config;
