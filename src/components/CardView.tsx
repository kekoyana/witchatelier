import { useRef, useState, useEffect } from 'react';
import { Card, GoodType } from '../game/types';
import { getCardDef } from '../game/utils';

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
  const typeClass =
    def.type === 'production' && def.goodType
      ? `type-${def.goodType}`
      : 'type-violet';

  // 商品トークン消失アニメーション
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

  return (
    <div className={classes} onClick={clickable ? onClick : undefined} title={`${def.name}\n${def.abilityText}\nコスト: ${def.cost} VP: ${def.vp}`}>
      <div className="card-header">
        <span className="card-cost">{def.cost}</span>
        <span className="card-vp">{def.vp}</span>
      </div>
      <div className="card-name">{def.name}</div>
      {size !== 'xs' && <div className="card-ability">{def.abilityText}</div>}
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
