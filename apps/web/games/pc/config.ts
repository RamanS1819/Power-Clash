import { createZkNoidGameConfig } from '@/lib/createConfig';
import { ZkNoidGameType } from '@/lib/platform/game_types';
import { PowerClash }  from 'zknoid-chain-dev';
import pc from './pc';
import { ZkNoidGameFeature, ZkNoidGameGenre } from '@/lib/platform/game_tags';
// import RandzuLobby from '@/games/randzu/components/RandzuLobby';
import { LogoMode } from '@/app/constants/games';
import PcLobby from './components/PcLobby';

export const powerclashConfig = createZkNoidGameConfig({
  id: 'powerclash',
  type: ZkNoidGameType.PVP,
  name: 'PowerClash',
  description:
    'A fast-paced game where two players use unique powers to outsmart their opponent. The goal is to eliminate the other player through tactical moves and strategic use of power-ups.',
  image: '/image/games/randzu.svg',
  genre: ZkNoidGameGenre.BoardGames,
  logoMode: LogoMode.CENTER,
  features: [ZkNoidGameFeature.Multiplayer],
  isReleased: true,
  releaseDate: new Date(2024, 0, 1),
  popularity: 10,
  author: 'PowerClash Team',
  rules:
    'PowerClash is a turn-based game where each player uses different powers to defeat their opponent. Players must carefully time their moves and powers to outwit their opponent and claim victory.',
  runtimeModules: {
    PowerClash,
  },
  page: pc,
  lobby: PcLobby,
});