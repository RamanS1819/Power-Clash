import React, { useState, useEffect } from 'react';
import { PublicKey, Field } from 'o1js';

interface IGameViewProps {
  gameInfo: {
    id: bigint;
    player1: PublicKey;
    player2: PublicKey;
    player1Move: { move: Field; salt: Field } | null;
    player2Move: { move: Field; salt: Field } | null;
    player1Wins: number;
    player2Wins: number;
    gameWinner: PublicKey | null;
  };
  currentPlayer: PublicKey;
  onMoveSelected: (move: number) => void;
  loading: boolean;
}

const moveNames = ['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock'];

const GameView: React.FC<IGameViewProps> = ({ gameInfo, currentPlayer, onMoveSelected, loading }) => {
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [opponentMove, setOpponentMove] = useState<string>('Waiting...');
  const [roundResult, setRoundResult] = useState<string>('');

  const isCurrentPlayerTurn = !gameInfo.player1Move || !gameInfo.player2Move;
  const isPlayer1 = currentPlayer.equals(gameInfo.player1);

  useEffect(() => {
    if (gameInfo.player1Move && gameInfo.player2Move) {
      const move1 = gameInfo.player1Move.move.toString();
      const move2 = gameInfo.player2Move.move.toString();
      setOpponentMove(moveNames[isPlayer1 ? parseInt(move2) : parseInt(move1)]);
      
      // Determine round winner
      const winner = determineWinner(parseInt(move1), parseInt(move2));
      if (winner === 0) {
        setRoundResult("It's a tie!");
      } else if ((winner === 1 && isPlayer1) || (winner === 2 && !isPlayer1)) {
        setRoundResult("You win this round!");
      } else {
        setRoundResult("You lose this round!");
      }
    }
  }, [gameInfo.player1Move, gameInfo.player2Move, isPlayer1]);

  const handleMoveClick = (move: number) => {
    if (!loading && isCurrentPlayerTurn) {
      setSelectedMove(move);
      onMoveSelected(move);
    }
  };

  const determineWinner = (move1: number, move2: number): number => {
    if (move1 === move2) return 0;
    if (
      (move1 === 0 && (move2 === 2 || move2 === 3)) ||
      (move1 === 1 && (move2 === 0 || move2 === 4)) ||
      (move1 === 2 && (move2 === 1 || move2 === 3)) ||
      (move1 === 3 && (move2 === 1 || move2 === 4)) ||
      (move1 === 4 && (move2 === 0 || move2 === 2))
    ) {
      return 1;
    }
    return 2;
  };

  return (
    <div className="flex flex-col items-center justify-center bg-gray-800 p-6 rounded-lg">
      <div className="text-3xl font-bold text-white mb-6">PowerClash</div>
      <div className="flex justify-between w-full mb-6">
        <div className="text-xl text-cyan-400">
          Your Move: {selectedMove !== null ? moveNames[selectedMove] : 'Choose'}
        </div>
        <div className="text-xl text-cyan-400">
          Opponent's Move: {opponentMove}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {moveNames.map((move, index) => (
          <button
            key={move}
            onClick={() => handleMoveClick(index)}
            disabled={loading || !isCurrentPlayerTurn || selectedMove !== null}
            className={`py-2 px-4 rounded ${
              selectedMove === index
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } ${(loading || !isCurrentPlayerTurn || selectedMove !== null) && 'opacity-50 cursor-not-allowed'}`}
          >
            {move}
          </button>
        ))}
      </div>
      <div className="text-xl text-white mb-4">
        Score: You {isPlayer1 ? gameInfo.player1Wins : gameInfo.player2Wins} - {isPlayer1 ? gameInfo.player2Wins : gameInfo.player1Wins} Opponent
      </div>
      {roundResult && <div className="text-2xl text-yellow-400 mb-4">{roundResult}</div>}
      {gameInfo.gameWinner && (
        <div className="text-3xl font-bold text-green-400">
          {gameInfo.gameWinner.equals(currentPlayer) ? 'You win the game!' : 'You lose the game!'}
        </div>
      )}
      {loading && <div className="text-xl text-white">Processing move...</div>}
    </div>
  );
};

export default GameView;