import { useState,useEffect, useContext} from 'react'; 
import React from 'react';
import { 
  usePowerClashMatchQueueStore,
  useObservePowerClashMatchQueue 
} from './stores/matchQueue';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { ClientAppChain, PENDING_BLOCKS_NUM_CONST, PowerClash } from 'zknoid-chain-dev';
import { powerclashConfig } from './config';
import { useStore } from 'zustand';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import GamePage from '@/components/framework/GamePage';
import RandzuCoverSVG from '../randzu/assets/game-cover.svg';
import RandzuCoverMobileSVG from '../randzu/assets/game-cover-mobile.svg';
import Button from '@/components/shared/Button';
import Image from 'next/image';
import { Bool, CircuitString, Field, Poseidon, UInt64 , Int64, PublicKey, UInt32} from 'o1js';
import { useNetworkStore } from '@/lib/stores/network';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
import { useRateGameStore } from '@/lib/stores/rateGameStore';
import { useStartGame } from './features/startGame';
import { DEFAULT_PARTICIPATION_FEE } from 'zknoid-chain-dev/dist/src/engine/LobbyManager';
import { useLobbiesStore, useObserveLobbiesStore } from '@/lib/stores/lobbiesStore';
import { api } from '@/trpc/react';
import { GameWrap } from '@/components/framework/GamePage/GameWrap';
import { Win } from '@/components/framework/GameWidget/ui/popups/Win';
import { Lost } from '@/components/framework/GameWidget/ui/popups/Lost';

enum GameState {
  WalletNotInstalled,
  WalletNotConnected,
  NotStarted,
  MatchRegistration,
  Matchmaking,
  CurrentPlayerTurn,
  OpponentTurn,
  OpponentTimeout,
  Won,
  Active,
  Lost,
  WaitingForOpponent,
  Commitment,
  Reveal,
  RoundEnd,
  GameEnd
}

const moves = ['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock'];

const pc: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.NotStarted);
  const [finalState, setFinalState] = useState<GameState>(GameState.Active);
  const [isRateGame, setIsRateGame] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<Field | null>(null);
  const [salt, setSalt] = useState<Field | null>(null);
  const [opponentMove, setOpponentMove] = useState<string | null>(null);
  const [roundWinner, setRoundWinner] = useState<PublicKey | null>(null);
  const [gameWinner, setGameWinner] = useState<PublicKey | null>(null);
  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  const networkStore = useNetworkStore();
  const notificationStore = useNotificationStore();
  const protokitChain = useProtokitChainStore();

  useObservePowerClashMatchQueue();
  const matchQueue = usePowerClashMatchQueueStore();

  const client_ = client as ClientAppChain<
    typeof powerclashConfig.runtimeModules,
    any,
    any,
    any
  >;

  const query = networkStore.protokitClientStarted
    ? client_.query.runtime.PowerClash
    : undefined;

  useObserveLobbiesStore(query);
  const lobbiesStore = useLobbiesStore();

  console.log('Active lobby', lobbiesStore.activeLobby);

  const restart = () => {
    matchQueue.resetLastGameState();
    setGameState(GameState.NotStarted);
  };

  const sessionPrivateKey = useStore(useSessionKeyStore, (state) =>
    state.getSessionKey()
  );

  useEffect(() => {
    if (matchQueue.activeGameId && Number(matchQueue.activeGameId) !== 0) {
      setGameState(GameState.Commitment);
    }
  }, [matchQueue.activeGameId]);

  const makeMove = async (move: string) => {
    if (!query || !matchQueue.activeGameId) {
      notificationStore.create({
        type: 'error',
        message: 'Game not initialized or query not available.',
      });
      return;
    }

    const moveIndex = moves.indexOf(move);
    if (moveIndex === -1) {
      notificationStore.create({
        type: 'error',
        message: 'Invalid move selected.',
      });
      return;
    }

    const newSalt = Field.random();
    const newCommitment = Poseidon.hash([Field(moveIndex), newSalt]);

    setSelectedMove(move);
    setCommitment(newCommitment);
    setSalt(newSalt);

    const PowerClash = client.runtime.resolve('PowerClash');

    try {
      const tx = await client!.transaction(
        sessionPrivateKey.toPublicKey(), 
        async () => {
          PowerClash.commitMove(
          UInt64.from(matchQueue.activeGameId!),
          newCommitment
        );
      });

      setLoading(true);

      tx.transaction = tx.transaction?.sign(sessionPrivateKey);
      await tx.send();
    
      notificationStore.create({
        type: 'success',
        message: 'Your move has been committed to the blockchain.',
      });
      setGameState(GameState.Commitment);
    } catch (error) {
      console.error('Error committing move:', error);
      notificationStore.create({
        type: 'error',
        message: 'Failed to commit move. Please try again.',
      });
    }
  };

  const revealMove = async () => {
    if (!query || !matchQueue.activeGameId || !selectedMove || salt === null) {
      notificationStore.create({
        type: 'error',
        message: 'Cannot reveal move. Missing information.',
      });
      return;
    }

    const moveIndex = moves.indexOf(selectedMove);
    const PowerClash = client.runtime.resolve('PowerClash');

    try {
      const tx = await client!.transaction(
        sessionPrivateKey.toPublicKey(), 
        async () => {
          PowerClash.revealMove(
            UInt64.from(matchQueue.activeGameId!),
            {
              move: Field(moveIndex),
              salt: salt
            }
          );
        }
      );

      tx.transaction = tx.transaction?.sign(sessionPrivateKey);
      const result = await tx.send();

      // Extract the round winner from the transaction result
      // const revealMoveResult = result.events.find(event => event.type === 'revealMove');
      const revealMoveResult = await PowerClash.revealMove.get(
        PublicKey.fromBase58(sessionPrivateKey.toPublicKey().toBase58())
      )
      console.log('win win win winw iwnniw', revealMoveResult);
      if (revealMoveResult) {
        const { roundWinner } = revealMoveResult.event as { roundWinner: PublicKey | null };
        setRoundWinner(roundWinner);
        if (roundWinner) {
          notificationStore.create({
            type: 'success',
            message: `Round winner: ${roundWinner.equals(sessionPrivateKey.toPublicKey()) ? 'You' : 'Opponent'}`,
          });
        } else {
          notificationStore.create({
            type: 'message',
            message: 'Round ended in a tie.',
          });
        }
      }

      setGameState(GameState.RoundEnd);
    } catch (error) {
      console.error('Error revealing move:', error);
      notificationStore.create({
        type: 'error',
        message: 'Failed to reveal move. Please try again.',
      });
    }
  };


  useEffect(() => {
    if (matchQueue.activeGameId && Number(matchQueue.activeGameId) !== 0) {
      setGameState(GameState.Commitment);
    }
  }, [matchQueue.activeGameId]);
  
  return (
    <GamePage
      gameConfig={powerclashConfig}
      image={RandzuCoverSVG}
      mobileImage={RandzuCoverMobileSVG}
      defaultPage={'Game'}
    >
      <div className="flex">
        <div className="w-2/3 bg-gray-900 p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="text-2xl font-bold">You: {matchQueue.gameInfo?.player1Wins.toString() || '0'}</div>
            <div className="text-3xl font-bold">Round: {(Number(matchQueue.gameInfo?.player1Wins || 0) + Number(matchQueue.gameInfo?.player2Wins || 0) + 1).toString()}</div>
            <div className="text-2xl font-bold">Opponent: {matchQueue.gameInfo?.player2Wins.toString() || '0'}</div>
          </div>

          <div className="flex justify-around items-center mb-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Your Move</h2>
              <div className="text-3xl h-20 flex items-center justify-center">
                {selectedMove || '?'}
              </div>
            </div>
            <div className="text-4xl font-bold">VS</div>
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Opponent's Move</h2>
              <div className="text-3xl h-20 flex items-center justify-center">
                {opponentMove || '?'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-8">
            {moves.map((move) => (
              <Button
                key={move}
                onClick={() => makeMove(move)}
                disabled={gameState !== GameState.Commitment || selectedMove !== null}
                className={`p-16 rounded-lg text-3xl font-semibold transition-colors ${
                  selectedMove === move
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                label={move}
              />
            ))}
          </div>

          {gameState === GameState.RoundEnd && (
            <div className="text-center text-4xl font-bold mt-8">
              Round Ended!
              {roundWinner && (
                <div className="text-2xl mt-4">
                  Round Winner: {roundWinner.equals(sessionPrivateKey.toPublicKey()) ? 'You' : 'Opponent'}
                </div>
              )}
              {!roundWinner && (
                <div className="text-2xl mt-4">
                  This round was a tie!
                </div>
              )}
            </div>
          )}

          {gameState === GameState.GameEnd && (
            <div className="text-center text-4xl font-bold mt-8">
              Game Over!
              {gameWinner && (
                <div className="text-2xl mt-4">
                  Game Winner: {gameWinner.equals(sessionPrivateKey.toPublicKey()) ? 'You' : 'Opponent'}
                </div>
              )}
            </div>
          )}

          {gameState === GameState.Reveal && (
            <Button
              onClick={revealMove}
              className="mt-8 p-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded"
              label="Reveal Move"
            />
          )}
        </div>

        <div className="w-1/3 bg-black text-left-accent p-8 text-lg">
          <h2 className="text-2xl font-bold mb-4">Game Rules</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Rock crushes Scissors and Lizard</li>
          </ul>
        </div>
      </div>
    </GamePage>
  );
};

export default pc;