import { Bool, PublicKey, UInt64, Field } from 'o1js';
import { useContext, useEffect } from 'react';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import { useNetworkStore } from '@/lib/stores/network';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { powerclashConfig } from '../config';
import { type ClientAppChain } from '@proto-kit/sdk';
import { create } from 'zustand';
import { RoundIdxUser } from 'zknoid-chain-dev';
import { immer } from 'zustand/middleware/immer';
import { type ModuleQuery } from '@proto-kit/sequencer';
import { PowerClash, MatchMaker, PENDING_BLOCKS_NUM_CONST } from 'zknoid-chain-dev';

export interface IGameInfo {
    id: bigint;
    player1: string;
    player2: string;
    player1Commitment: bigint;
    player2Commitment: bigint;
    player1Move: { move: bigint; salt: bigint };
    player2Move: { move: bigint; salt: bigint };
    player1Wins: bigint;
    player2Wins: bigint;
    commitmentDeadline: bigint;
    revealDeadline: bigint;
    gameWinner: string;
    lastMoveBlockHeight: bigint;
}

export interface MatchQueueState {
    loading: boolean;
    queueLength: number;
    inQueue: boolean;
    activeGameId: bigint;
    gameInfo: IGameInfo | undefined;
    lastGameState: 'win' | 'lost' | 'draw' | undefined;
    pendingBalance: bigint;
    getQueueLength: () => number;
    loadMatchQueue(query: ModuleQuery<PowerClash>, blockHeight: number): Promise<void>;
    loadActiveGame: (
        query: ModuleQuery<MatchMaker>,
        blockHeight: number,
        address: PublicKey
    ) => Promise<void>;
    resetLastGameState: () => void;
}

export const matchQueueInitializer = immer<MatchQueueState>((set) => ({
    loading: false,
    queueLength: 0,
    activeGameId: 0n,
    inQueue: false,
    gameInfo: undefined,
    lastGameState: undefined,
    pendingBalance: 0n,
    resetLastGameState() {
        set((state) => {
            state.lastGameState = undefined;
            state.gameInfo = undefined;
        });
    },
    getQueueLength() {
        return this.queueLength;
    },
    async loadMatchQueue(query: ModuleQuery<PowerClash>, blockHeight: number) {
        set((state) => {
            state.loading = true;
        });

        const queueLength = await query?.queueLength.get(UInt64.from(blockHeight));

        set((state) => {
            state.queueLength = Number(queueLength?.toBigInt() || 0);
            state.loading = false;
        });
    },
    async loadActiveGame(
        query: ModuleQuery<MatchMaker>,
        blockHeight: number,
        address: PublicKey
    ) {
        set((state) => {
            state.loading = true;
        });

        const activeGameId = await query?.activeGameId.get(address);
        console.log(
          'Active game idd',
          Number(UInt64.from(activeGameId!).toBigInt())
        );
        const inQueue = await query?.queueRegisteredRoundUsers.get(
          //@ts-ignore
          new RoundIdxUser({
              roundId: UInt64.from(blockHeight).div(PENDING_BLOCKS_NUM_CONST),
              userAddress: address,
          })
      );

        if (activeGameId && activeGameId.greaterThan(UInt64.from(0)).toBoolean()) {
            const gameInfo = (await query?.games.get(activeGameId))!;

            const parsedGameInfo: IGameInfo = {
                id: activeGameId.toBigInt(),
                player1: gameInfo.player1.toBase58(),
                player2: gameInfo.player2.toBase58(),
                player1Commitment: gameInfo.player1Commitment.toBigInt(),
                player2Commitment: gameInfo.player2Commitment.toBigInt(),
                player1Move: {
                    move: gameInfo.player1Move.move.toBigInt(),
                    salt: gameInfo.player1Move.salt.toBigInt(),
                },
                player2Move: {
                    move: gameInfo.player2Move.move.toBigInt(),
                    salt: gameInfo.player2Move.salt.toBigInt(),
                },
                player1Wins: gameInfo.player1Wins.toBigInt(),
                player2Wins: gameInfo.player2Wins.toBigInt(),
                commitmentDeadline: gameInfo.commitmentDeadline.toBigInt(),
                revealDeadline: gameInfo.revealDeadline.toBigInt(),
                gameWinner: gameInfo.gameWinner.toBase58(),
                lastMoveBlockHeight: gameInfo.lastMoveBlockHeight.toBigInt(),
            };

            set((state) => {
                state.gameInfo = parsedGameInfo;
            });
        }

        const pendingBalance = (
          await query.pendingBalances.get(address)
        )?.toBigInt();

        console.log('Pending balance', pendingBalance);

        set((state) => {
            state.activeGameId = activeGameId?.toBigInt() || 0n;
            state.inQueue = inQueue?.toBoolean() || false;
            state.loading = false;
            state.pendingBalance = pendingBalance || 0n;
        });
    },
}));

export const usePowerClashMatchQueueStore = create<
    MatchQueueState,
    [['zustand/immer', never]]
>(matchQueueInitializer);

export const useObservePowerClashMatchQueue = () => {
    const chain = useProtokitChainStore();
    const network = useNetworkStore();
    const matchQueue = usePowerClashMatchQueueStore();
    const { client } = useContext(ZkNoidGameContext);

    const client_ = client as ClientAppChain<
        typeof powerclashConfig.runtimeModules,
        any,
        any,
        any
    >;

    useEffect(() => {
        if (
            !network.walletConnected ||
            !network.address ||
            !chain.block?.height ||
            !network.protokitClientStarted
        ) {
            return;
        }

        if (!client) {
            throw Error('Context app chain client is not set');
        }

        matchQueue.loadMatchQueue(
            client_.query.runtime.PowerClash,
            chain.block?.height
        );
        matchQueue.loadActiveGame(
            client_.query.runtime.PowerClash,
            chain.block?.height,
            PublicKey.fromBase58(network.address!)
        );
    }, [
        chain.block?.height,
        network.walletConnected,
        network.address,
        network.protokitClientStarted,
    ]);
};

export default function MatchQueue() {
    useObservePowerClashMatchQueue();
    const matchQueue = usePowerClashMatchQueueStore();

    if (matchQueue.loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h2>PowerClash Match Queue</h2>
            <p>Queue Length: {matchQueue.queueLength}</p>
            <p>In Queue: {matchQueue.inQueue ? 'Yes' : 'No'}</p>
            <p>Active Game ID: {matchQueue.activeGameId.toString()}</p>
            {matchQueue.gameInfo && (
                <div>
                    <h3>Current Game Info</h3>
                    <p>Player 1: {matchQueue.gameInfo.player1}</p>
                    <p>Player 2: {matchQueue.gameInfo.player2}</p>
                    <p>Player 1 Wins: {matchQueue.gameInfo.player1Wins.toString()}</p>
                    <p>Player 2 Wins: {matchQueue.gameInfo.player2Wins.toString()}</p>
                    <p>Commitment Deadline: {matchQueue.gameInfo.commitmentDeadline.toString()}</p>
                    <p>Reveal Deadline: {matchQueue.gameInfo.revealDeadline.toString()}</p>
                    <p>Game Winner: {matchQueue.gameInfo.gameWinner || 'Not determined'}</p>
                </div>
            )}
            {matchQueue.lastGameState && (
                <p>Last Game Result: {matchQueue.lastGameState}</p>
            )}
            <p>Pending Balance: {matchQueue.pendingBalance.toString()}</p>
        </div>
    );
}