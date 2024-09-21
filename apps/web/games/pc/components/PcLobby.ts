import GamePage from '@/components/framework/GamePage';
import { powerclashConfig } from '@/games/pc/config';
import RandzuCoverSVG from '@/games/randzu/assets/game-cover.svg';
import RandzuCoverMobileSVG from '@/games/randzu/assets/game-cover-mobile.svg';
import React, { useContext } from 'react';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { ClientAppChain } from 'zknoid-chain-dev';
import { useNetworkStore } from '@/lib/stores/network';
import LobbyPage from '@/components/framework/Lobby/LobbyPage';

export default function PcLobby({
  params,
}: {
  params: { lobbyId: string };
}) {
  const networkStore = useNetworkStore();

  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  const client_ = client as ClientAppChain<
    typeof powerclashConfig.runtimeModules,
    any,
    any,
    any
  >;

  return (
    <GamePage
      gameConfig={powerclashConfig}
      image={RandzuCoverSVG}
      mobileImage={RandzuCoverMobileSVG}
      defaultPage={'Lobby list'}
    >
      <LobbyPage
        lobbyId={params.lobbyId}
        query={
          networkStore.protokitClientStarted
            ? client_.query.runtime.PowerClash
            : undefined
        }
        contractName={'PowerClash'}
        config={powerclashConfig}
      />
    </GamePage>
  );
}