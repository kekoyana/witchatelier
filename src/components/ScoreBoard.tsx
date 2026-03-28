import { GameState } from '../game/types';
import { useLanguage, interpolate } from '../i18n';

const BASE = import.meta.env.BASE_URL;

interface ScoreBoardProps {
  state: GameState;
  onRestart: () => void;
}

export function ScoreBoard({ state, onRestart }: ScoreBoardProps) {
  const { t } = useLanguage();

  if (!state.finalScores) return null;

  const sorted = [...state.finalScores].sort(
    (a, b) => b.breakdown.total - a.breakdown.total
  );
  const winnerId = sorted[0].playerId;

  return (
    <div className="score-board" style={{ backgroundImage: `linear-gradient(rgba(26,26,46,0.5), rgba(26,26,46,0.75)), url('${BASE}images/ending.jpg')` }}>
      <h2>{t('score.title')}</h2>
      <p style={{ color: 'var(--color-gold)', fontSize: '1.2rem' }}>
        {interpolate(t('score.winner'), { name: state.players[winnerId].name })}
      </p>

      <table className="score-table">
        <thead>
          <tr>
            <th>{t('score.player')}</th>
            <th>{t('score.buildingVP')}</th>
            <th>{t('score.chapel')}</th>
            <th>{t('score.monument')}</th>
            <th>{t('score.guild')}</th>
            <th>{t('score.cityHall')}</th>
            <th>{t('score.palace')}</th>
            <th>{t('score.total')}</th>
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

      <button onClick={onRestart}>{t('score.restart')}</button>
    </div>
  );
}
