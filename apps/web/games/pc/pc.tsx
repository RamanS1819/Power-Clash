'use client';

import { useContext, useEffect, useState } from 'react';
import { UInt64, PublicKey } from 'o1js';
import { useNetworkStore } from '@/lib/stores/network';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { useStore } from 'zustand';
import GamePage from '@/components/framework/GamePage';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { powerclashConfig } from './config';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { MainButtonState } from '@/components/framework/GamePage/PvPGameView';
import { api } from '@/trpc/react';
import { getEnvContext } from '@/lib/envContext';
import GameWidget from '@/components/framework/GameWidget';
import { motion } from 'framer-motion';
import { formatPubkey } from '@/lib/utils';
import Button from '@/components/shared/Button';
import { Currency } from '@/constants/currency';
import { formatUnits } from '@/lib/unit';
import { walletInstalled } from '@/lib/helpers';
import { GameWrap } from '@/components/framework/GamePage/GameWrap';
import toast from '@/components/shared/Toast';
import { useToasterStore } from '@/lib/stores/toasterStore';
import { useRateGameStore } from '@/lib/stores/rateGameStore';
import { ClientAppChain } from 'zknoid-chain-dev';

const ROUNDS_TO_WIN = 2; // Best of 3
const MOVE_TIME_LIMIT = 50; // Assuming 5-second block time, this gives ~4 minutes per move

enum GameState {
  NotStarted,
  WalletNotInstalled,
  WalletNotConnected,
  MatchRegistration,
  Matchmaking,
  CommitPhase,
  RevealPhase,
  OpponentTimeout,
  GameEnded,
}

export default function pc() {
  const [gameState, setGameState] = useState(GameState.NotStarted);
  const [isRateGame, setIsRateGame] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  const networkStore = useNetworkStore();
  const toasterStore = useToasterStore();
  const rateGameStore = useRateGameStore();
  const protokitChain = useProtokitChainStore();
  const sessionPrivateKey = useStore(useSessionKeyStore, (state) =>
    state.getSessionKey()
  );
  const progress = api.progress.setSolvedQuests.useMutation();

  const [gameInfo, setGameInfo] = useState<any>(null);
  const [opponent, setOpponent] = useState<string | null>(null);

  const clientAppChain = client as ClientAppChain<
    typeof powerclashConfig.runtimeModules,
    any,
    any,
    any
  >;

  const query = networkStore.protokitClientStarted
    ? clientAppChain.query.runtime.PowerClash
    : undefined;


  useEffect(() => {
    if (!walletInstalled()) {
      setGameState(GameState.WalletNotInstalled);
    } else if (!networkStore.address) {
      setGameState(GameState.WalletNotConnected);
    } else {
      setGameState(GameState.NotStarted);
    }
  }, [networkStore.address]);

  const startGame = async () => {
    setLoading(true);
    // Implement game start logic here
    setLoading(false);
    setGameState(GameState.Matchmaking);
  };

  const commitMove = async (move: number) => {
    setLoading(true);
    // Implement move commitment logic here
    setLoading(false);
    setGameState(GameState.RevealPhase);
  };

  const revealMove = async () => {
    setLoading(true);
    // Implement move reveal logic here
    setLoading(false);
    // Update game state based on the result
  };

  const proveOpponentTimeout = async () => {
    setLoading(true);
    // Implement timeout proving logic here
    setLoading(false);
    setGameState(GameState.GameEnded);
  };

  const restart = () => {
    setGameInfo(null);
    setOpponent(null);
    setGameState(GameState.NotStarted);
  };

  const mainButtonState = loading
    ? MainButtonState.TransactionExecution
    : (() => {
        switch (gameState) {
          case GameState.CommitPhase:
            return MainButtonState.YourTurn;
          case GameState.RevealPhase:
            return MainButtonState.OpponentsTurn;
          case GameState.OpponentTimeout:
            return MainButtonState.OpponentTimeOut;
          case GameState.NotStarted:
            return MainButtonState.NotStarted;
          case GameState.WalletNotInstalled:
            return MainButtonState.WalletNotInstalled;
          case GameState.WalletNotConnected:
            return MainButtonState.WalletNotConnected;
          default:
            return MainButtonState.None;
        }
      })();

  const statuses = {
    [GameState.WalletNotInstalled]: 'WALLET NOT INSTALLED',
    [GameState.WalletNotConnected]: 'WALLET NOT CONNECTED',
    [GameState.NotStarted]: 'NOT STARTED',
    [GameState.MatchRegistration]: 'MATCH REGISTRATION',
    [GameState.Matchmaking]: 'MATCHMAKING',
    [GameState.CommitPhase]: 'COMMIT PHASE',
    [GameState.RevealPhase]: 'REVEAL PHASE',
    [GameState.OpponentTimeout]: 'OPPONENT TIMEOUT',
    [GameState.GameEnded]: 'GAME ENDED',
  };

  return (
    <GamePage
      gameConfig={powerclashConfig}
      image={'/path-to-power-clash-image.svg'}
      mobileImage={'/path-to-power-clash-mobile-image.svg'}
      defaultPage={'Game'}
    >
      <motion.div
        className={'flex grid-cols-4 flex-col-reverse gap-4 pt-10 lg:grid lg:pt-0'}
        animate={'windowed'}
      >
        <div className={'flex flex-col gap-4 lg:hidden'}>
          <span className={'w-full text-headline-2 font-bold'}>Rules</span>
          <span className={'font-plexsans text-buttons-menu font-normal'}>
            {powerclashConfig.rules}
          </span>
        </div>
        <div className={'hidden h-full w-full flex-col gap-4 lg:flex'}>
          <div className={'flex w-full gap-2 font-plexsans text-[20px]/[20px] uppercase text-left-accent'}>
            <span>Game status:</span>
            <span>{statuses[gameState]}</span>
          </div>
          <div className={'flex w-full gap-2 font-plexsans text-[20px]/[20px] text-foreground'}>
            <span>Your opponent:</span>
            {/* <span>{formatPubkey(opponent)}</span> */}
          </div>
          {mainButtonState === MainButtonState.YourTurn && (
            <Button
              startContent={<svg>...</svg>}
              label={'YOUR TURN'}
              isReadonly
            />
          )}
          {mainButtonState === MainButtonState.OpponentsTurn && (
            <Button
              startContent={<svg>...</svg>}
              label={"OPPONENT'S TURN"}
              isReadonly
            />
          )}
          {mainButtonState === MainButtonState.OpponentTimeOut && (
            <Button label={'OPPONENT TIMED OUT'} isReadonly />
          )}
          {mainButtonState === MainButtonState.TransactionExecution && (
            <Button
              startContent={<svg>...</svg>}
              label={'TRANSACTION EXECUTION'}
              isReadonly
            />
          )}
        </div>
        <GameWidget
          author={powerclashConfig.author}
          isPvp
          playersCount={2}
          gameId="power-clash"
        >
          {networkStore.address ? (
            <>
              {gameState === GameState.NotStarted && (
                <GameWrap>
                  <Button
                    label={`START GAME`}
                    onClick={startGame}
                    className={'max-w-[40%]'}
                  />
                </GameWrap>
              )}
              {gameState === GameState.OpponentTimeout && (
                <GameWrap>
                  <Button
                    label={'Prove Opponent Timeout'}
                    onClick={proveOpponentTimeout}
                    className={'px-4'}
                  />
                </GameWrap>
              )}
              {gameState === GameState.GameEnded && (
                <GameWrap>
                  <Button
                    label={'Start New Game'}
                    onClick={restart}
                    className={'px-4'}
                  />
                </GameWrap>
              )}
            </>
          ) : walletInstalled() ? (
            <GameWrap>
              <Button
                label={'Connect Wallet'}
                onClick={() => networkStore.connectWallet(false)}
                className={'px-4'}
              />
            </GameWrap>
          ) : (
            <GameWrap>
              <Button
                label={'Install Wallet'}
                onClick={() => window.open('https://www.aurowallet.com/', '_blank')}
                className={'px-4'}
              />
            </GameWrap>
          )}
        </GameWidget>
        {/* Add more UI components as needed */}
      </motion.div>
    </GamePage>
  );
}