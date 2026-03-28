import { useRef, useState, useEffect } from 'react';
import { Card, GoodType } from '../game/types';
import { getCardDef } from '../game/utils';
import { useLanguage } from '../i18n';
import { getCardDisplayName, getCardDisplayAbility } from '../i18n';

interface CardViewProps {
  card: Card;
  size: 'normal' | 'small' | 'xs';
  good?: GoodType | null;
  chapelCards?: number;
  clickable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function CardView({
  card,
  size,
  good,
  chapelCards,
  clickable,
  selected,
  disabled,
  onClick,
}: CardViewProps) {
  const def = getCardDef(card);
  const { language } = useLanguage();

  const displayName = getCardDisplayName(def.id, language, def.name);
  const displayAbility = getCardDisplayAbility(def.id, language, def.abilityText);

  const typeClass =
    def.type === 'production' && def.goodType
      ? `type-${def.goodType}`
      : 'type-violet';

  const prevGoodRef = useRef<GoodType | null | undefined>(good);
  const [removingGood, setRemovingGood] = useState<GoodType | null>(null);

  useEffect(() => {
    if (prevGoodRef.current && !good) {
      setRemovingGood(prevGoodRef.current);
      const timer = setTimeout(() => setRemovingGood(null), 300);
      prevGoodRef.current = good;
      return () => clearTimeout(timer);
    }
    prevGoodRef.current = good;
  }, [good]);

  const classes = [
    'card-view',
    `size-${size}`,
    typeClass,
    clickable ? 'clickable' : '',
    selected ? 'selected' : '',
    disabled ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const costLabel = language === 'ja' ? 'コスト' : 'Cost';
  const fameLabel = language === 'ja' ? '名声' : 'Fame';

  return (
    <div className={classes} onClick={clickable ? onClick : undefined} title={`${displayName}\n${displayAbility}\n${costLabel}: ${def.cost} ${fameLabel}: ${def.vp}`}>
      <div className="card-header">
        <span className="card-cost">{def.cost}</span>
        <span className="card-vp">{def.vp}</span>
      </div>
      <div className="card-name">{displayName}</div>
      {size !== 'xs' && <div className="card-ability">{displayAbility}</div>}
      {good && <div className={`goods-token good-${good}`} />}
      {!good && removingGood && (
        <div className={`goods-token good-${removingGood} removing`} />
      )}
      {chapelCards !== undefined && chapelCards > 0 && (
        <div className="chapel-count">+{chapelCards}</div>
      )}
    </div>
  );
}
