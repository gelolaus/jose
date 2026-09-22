/* eslint-disable @next/next/no-img-element */

type StatusHudProps = {
  xp: number;
  streak: number;
  hearts: number;
  variant?: "header" | "profile";
};

const hudPanels = {
  xp: "/assets/ui/hud/wood-panel-xp.png",
  streak: "/assets/ui/hud/wood-panel-fire.png",
  hearts: "/assets/ui/hud/wood-panel-heart.png",
};

function HudValue({ value }: { value: string }) {
  return (
    <span className="jose-status-hud__value" aria-hidden="true">
      {[...value].map((character, index) =>
        character === " " ? (
          <span key={index} className="jose-status-hud__space" />
        ) : (
          <img
            key={index}
            src={`/assets/ui/hud/glyphs/${character.toLowerCase()}.svg`}
            alt=""
            className="jose-status-hud__glyph"
          />
        ),
      )}
    </span>
  );
}

export function StatusHud({ xp, streak, hearts, variant = "header" }: StatusHudProps) {
  return (
    <div className={`jose-status-hud jose-status-hud--${variant}`} aria-label="Learner status">
      <span className="jose-status-hud__item jose-status-hud__item--xp" role="status" aria-label={`${xp} experience points`}>
        <img src={hudPanels.xp} alt="" className="jose-status-hud__panel" />
        <HudValue value={`${xp} XP`} />
      </span>
      <span className="jose-status-hud__item" role="status" aria-label={`${streak} day streak`}>
        <img src={hudPanels.streak} alt="" className="jose-status-hud__panel" />
        <HudValue value={String(streak)} />
      </span>
      <span className="jose-status-hud__item jose-status-hud__item--hearts" role="status" aria-label={`${hearts} lives`}>
        <img src={hudPanels.hearts} alt="" className="jose-status-hud__panel" />
        <HudValue value={String(hearts)} />
      </span>
    </div>
  );
}
