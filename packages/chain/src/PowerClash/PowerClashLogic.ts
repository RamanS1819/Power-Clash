import {
  RuntimeModule,
  runtimeMethod,
  runtimeModule,
  state,
} from '@proto-kit/module';
import { State, StateMap, assert } from '@proto-kit/protocol';
import {
  Bool,
  Field,
  Poseidon,
  Provable,
  PublicKey,
  Struct,
  UInt64,
} from 'o1js';
import { Balances, UInt64 as ProtoUInt64 } from '@proto-kit/library';
import { inject } from 'tsyringe';
import { MatchMaker } from '../engine/MatchMaker';
import { Lobby } from '../engine/LobbyManager';

const ROUNDS_TO_WIN = 2; // Best of 3
const MOVE_TIME_LIMIT = 50; // Assuming 5-second block time, this gives ~4 minutes per move

export class RPSLSMove extends Struct({
  move: Field, // 0: Rock, 1: Paper, 2: Scissors, 3: Lizard, 4: Spock
  salt: Field,
}) {}

export class Game extends Struct({
  id: UInt64,
  player1: PublicKey,
  player2: PublicKey,
  player1Commitment: Field,
  player2Commitment: Field,
  player1Move: RPSLSMove,
  player2Move: RPSLSMove,
  player1Wins: Field,
  player2Wins: Field,
  commitmentDeadline: UInt64,
  revealDeadline: UInt64,
  gameWinner: PublicKey,
  lastMoveBlockHeight: UInt64,
}) {}

@runtimeModule()
export class PowerClash extends MatchMaker {
  @state() public games = StateMap.from<UInt64, Game>(UInt64, Game);

  constructor(@inject('Balances') balances: Balances) {
    super(balances);
  }

  @runtimeMethod()
  public async commitMove(gameId: UInt64, commitment: Field): Promise<{ success: boolean, game: Game }> {
    const sender = this.transaction.sender.value;
    const game = (await this.games.get(gameId)).value;
    
    assert(game.gameWinner.equals(PublicKey.empty()), 'Game already finished');
    assert(
      sender.equals(game.player1) || sender.equals(game.player2),
      'You are not a player in this game'
    );
    assert(this.network.block.height.lessThanOrEqual(game.commitmentDeadline), 'Commitment period has ended');

    if (sender.equals(game.player1)) {
      game.player1Commitment = commitment;
    } else {
      game.player2Commitment = commitment;
    }

    game.lastMoveBlockHeight = this.network.block.height;
    await this.games.set(gameId, game);

    return { success: true, game };
  }

  @runtimeMethod()
  public async revealMove(gameId: UInt64, move: RPSLSMove): Promise<{ success: boolean, game: Game, roundWinner: PublicKey | null }> {
    const sender = this.transaction.sender.value;
    const game = (await this.games.get(gameId)).value;

    assert(game.gameWinner.equals(PublicKey.empty()), 'Game already finished');
    assert(
      sender.equals(game.player1) || sender.equals(game.player2),
      'You are not a player in this game'
    );
    assert(this.network.block.height.lessThanOrEqual(game.revealDeadline), 'Reveal period has ended');

    const commitment = Poseidon.hash([move.move, move.salt]);
    if (sender.equals(game.player1)) {
      assert(commitment.equals(game.player1Commitment), 'Revealed move does not match commitment');
      game.player1Move = move;
    } else {
      assert(commitment.equals(game.player2Commitment), 'Revealed move does not match commitment');
      game.player2Move = move;
    }

    let roundWinner: PublicKey | null = null;

    if (!game.player1Move.move.equals(Field(-1)) && !game.player2Move.move.equals(Field(-1))) {
      roundWinner = this.determineWinner(game.player1Move.move, game.player2Move.move, game.player1, game.player2);
      
      if (roundWinner.equals(game.player1)) {
        game.player1Wins = game.player1Wins.add(1);
      } else if (roundWinner.equals(game.player2)) {
        game.player2Wins = game.player2Wins.add(1);
      }


      if (game.player1Wins.equals(Field(ROUNDS_TO_WIN))) {
        game.gameWinner = game.player1;
        await this.endGame(game);
      } else if (game.player2Wins.equals(Field(ROUNDS_TO_WIN))) {
        game.gameWinner = game.player2;
        await this.endGame(game);
      } else {
        // Reset for next round
        game.player1Commitment = Field(0);
        game.player2Commitment = Field(0);
        game.player1Move = new RPSLSMove({ move: Field(-1), salt: Field(0) });
        game.player2Move = new RPSLSMove({ move: Field(-1), salt: Field(0) });
        game.commitmentDeadline = this.network.block.height.add(MOVE_TIME_LIMIT);
        game.revealDeadline = this.network.block.height.add(UInt64.from(MOVE_TIME_LIMIT).mul(2));
      }
    }

    game.lastMoveBlockHeight = this.network.block.height;
    await this.games.set(gameId, game);

    return { success: true, game, roundWinner };
  }

  @runtimeMethod()
  public async claimTimeoutVictory(gameId: UInt64): Promise<{ success: boolean, game: Game }> {
    const game = (await this.games.get(gameId)).value;
    assert(game.gameWinner.equals(PublicKey.empty()), 'Game already finished');

    const currentHeight = this.network.block.height;
    assert(
      currentHeight.greaterThan(game.lastMoveBlockHeight.add(MOVE_TIME_LIMIT)),
      'Opponent has not timed out yet'
    );

    const sender = this.transaction.sender.value;
    const isPlayer1 = sender.equals(game.player1);

    game.gameWinner = Provable.if(isPlayer1, game.player1, game.player2);
    await this.endGame(game);
    await this.games.set(gameId, game);

    return { success: true, game };
  }

  private determineWinner(move1: Field, move2: Field, player1: PublicKey, player2: PublicKey): PublicKey {
    const p1Wins = Bool.or(
      Bool.and(move1.equals(Field(0)), Bool.or(move2.equals(Field(2)), move2.equals(Field(3)))),
      Bool.or(
        Bool.and(move1.equals(Field(1)), Bool.or(move2.equals(Field(0)), move2.equals(Field(4)))),
        Bool.or(
          Bool.and(move1.equals(Field(2)), Bool.or(move2.equals(Field(1)), move2.equals(Field(3)))),
          Bool.or(
            Bool.and(move1.equals(Field(3)), Bool.or(move2.equals(Field(1)), move2.equals(Field(4)))),
            Bool.and(move1.equals(Field(4)), Bool.or(move2.equals(Field(0)), move2.equals(Field(2))))
          )
        )
      )
    );
  
    return Provable.if(p1Wins, player1, 
           Provable.if(move1.equals(move2), PublicKey.empty(), player2));
  }

  private async endGame(game: Game): Promise<void> {
    if (game.gameWinner.equals(PublicKey.empty())) {
      await this.acquireFunds(game.id, game.player1, game.player2, ProtoUInt64.from(1), ProtoUInt64.from(1), ProtoUInt64.from(0));
    } else {
      const loser = Provable.if(game.gameWinner.equals(game.player1), game.player2, game.player1);
      await this.acquireFunds(game.id, game.gameWinner, loser, ProtoUInt64.from(2), ProtoUInt64.from(0), ProtoUInt64.from(0));
    }
  
    await this.activeGameId.set(game.player1, UInt64.from(0));
    await this.activeGameId.set(game.player2, UInt64.from(0));
    await this._onLobbyEnd(game.id, Bool(true));
  }

  public async initGame(lobby: Lobby, shouldInit: Bool): Promise<UInt64> {
    const gameId = await super.initGame(lobby, shouldInit);

    const game = new Game({
      id: gameId,
      player1: lobby.players[0],
      player2: lobby.players[1],
      player1Commitment: Field(0),
      player2Commitment: Field(0),
      player1Move: new RPSLSMove({ move: Field(-1), salt: Field(0) }),
      player2Move: new RPSLSMove({ move: Field(-1), salt: Field(0) }),
      player1Wins: Field(0),
      player2Wins: Field(0),
      commitmentDeadline: this.network.block.height.add(MOVE_TIME_LIMIT),
      revealDeadline: this.network.block.height.add(UInt64.from(MOVE_TIME_LIMIT).mul(2)),
      gameWinner: PublicKey.empty(),
      lastMoveBlockHeight: this.network.block.height,
    });

    if (shouldInit.equals(Bool(true))) {
      await this.games.set(gameId, game);
      await this.gameFund.set(gameId, lobby.participationFee.mul(ProtoUInt64.from(2)));
    } else {
      console.warn("Game is already initialized or initialization is skipped.");
    }

    return gameId;
  }

  @runtimeMethod()
  public async getGameState(gameId: UInt64): Promise<Game> {
    return (await this.games.get(gameId)).value;
  }
}

export default PowerClash;