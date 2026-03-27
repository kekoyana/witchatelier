import { GameState } from '../game/types';

interface ScoreBoardProps {
  state: GameState;
  onRestart: () => void;
}

export function ScoreBoard({ state, onRestart }: ScoreBoardProps) {
  if (!state.finalScores) return null;

  const sorted = [...state.finalScores].sort(
    (a, b) => b.breakdown.total - a.breakdown.total
  );
  const winnerId = sorted[0].playerId;

  return (
    <div className="score-board">
      <h2>ゲーム終了</h2>
      <p style={{ color: 'var(--color-gold)', fontSize: '1.2rem' }}>
        {state.players[winnerId].name} の勝利！
      </p>

      <table className="score-table">
        <thead>
          <tr>
            <th>プレイヤー</th>
            <th>建物VP</th>
            <th>礼拝堂</th>
            <th>記念碑</th>
            <th>ギルド</th>
            <th>市役所</th>
            <th>宮殿</th>
            <th>合計</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const player = state.players[s.playerId];
            const isWinner = s.playerId === winnerId;
            return (
              <tr key={s.playerId} className={isWinner ? 'winner' : ''}>
                <td>{player.name}</td>
                <td>{s.breakdown.buildingVP}</td>
                <td>{s.breakdown.chapelVP || '-'}</td>
                <td>{s.breakdown.monumentVP || '-'}</td>
                <td>{s.breakdown.guildHallVP || '-'}</td>
                <td>{s.breakdown.cityHallVP || '-'}</td>
                <td>{s.breakdown.palaceVP || '-'}</td>
                <td className="total-row">{s.breakdown.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button onClick={onRestart}>もう一度プレイ</button>
    </div>
  );
}
