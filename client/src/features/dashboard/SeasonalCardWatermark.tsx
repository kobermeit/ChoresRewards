import React from 'react';
import { useSeason } from '../../hooks/useSettings';

export interface SeasonalCardWatermarkProps {
  variant?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Crisp, lightweight 64x64 SVG vector silhouettes
const HALLOWEEN_SVGS = [
  // 0: Jack-o'-lantern with toothy grin
  <path
    key="jackolantern"
    d="M32 6c-2 0-3 3-3 5-10 1-17 9-17 19 0 13 9 22 20 22s20-9 20-22c0-10-7-18-17-19 0-2-1-5-3-5zm-8 16c2.5 0 4 3 2 5-1 1-3 1-4 0-1-1-1-3 2-5zm16 0c2.5 0 4 3 2 5-1 1-3 1-4 0-1-1-1-3 2-5zm-8 8l3 4h-6l3-4zm-8 8c3 4 13 4 16 0-2 3-5 5-8 5s-6-2-8-5z"
  />,
  // 1: Friendly floating ghost
  <path
    key="ghost"
    d="M32 8c-9.9 0-18 8.1-18 18v22c0 1.7 1.8 2.8 3.3 2 2.2-1.2 5-1.2 7.2 0 2.2 1.2 5 1.2 7.2 0 2.2-1.2 5-1.2 7.2 0 2.2 1.2 5 1.2 7.2 0 1.5.8 3.3-.3 3.3-2V26c0-9.9-8.1-18-18-18zm-6 16a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm12 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 10c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z"
  />,
  // 2: Witch's bubbling cauldron
  <path
    key="cauldron"
    d="M20 12a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm12-4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM10 24h44c2.2 0 4 1.8 4 4 0 2.2-1.8 4-4 4-1 14-10 24-22 24S11 46 10 32c-2.2 0-4-1.8-4-4 0-2.2 1.8-4 4-4zm6 28l-4 6h6l2-6zm32 0l-4 6h6l2-6z"
  />,
  // 3: Skeleton / Skull
  <path
    key="skull"
    d="M32 10c-11 0-18 8-18 18 0 7 4 13 10 16v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c6-3 10-9 10-16 0-10-7-18-18-18zm-7 18a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm14 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-7 10l2 4h-4l2-4zm-4 8v4h2v-4h2v4h2v-4h2v4h2v-4h-10z"
  />,
  // 4: Classic Pumpkin
  <path
    key="pumpkin"
    d="M33 7c-1-1-3 1-3 4-8 1-14 8-15 17-5 2-8 7-8 13 0 11 9 19 20 19h10c11 0 20-8 20-19 0-6-3-11-8-13-1-9-7-16-15-17 0-3-2-5-3-4zm-7 8c2.5 0 4.7 1.2 6 3 1.3-1.8 3.5-3 6-3 3.9 0 7 4 7 9 0 6-3.1 11-7 11s-7-5-7-11c0-5 3.1-9 7-9z"
  />,
  // 5: Flying Bat
  <path
    key="bat"
    d="M32 20c-2 0-3 2-3 4-4-5-12-8-19-6 4 4 5 10 4 15-4 0-8 3-10 7 6 3 13 1 18-3 2 4 6 7 10 7s8-3 10-7c5 4 12 6 18 3-2-4-6-7-10-7-1-5 0-11 4-15-7-2-15 1-19 6 0-2-1-4-3-4zm-2 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm4 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"
  />,
  // 6: Spider & Corner Web
  <path
    key="spider"
    d="M60 4H36l6 6H60V4zm-14 8h14v-4H44l2 4zm14 6H50l4 4h6v-4zm-28 6c0 10 7 18 17 19v-4c-8-1-13-7-13-15h-4zm20 6l-6 6v4h4l6-6v-4zm-22 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-6-2l-4-4h-4l6 6 2-2zm0 6l-6 2-2 4h4l4-2v-4zm12-6l4-4h4l-6 6-2-2zm0 6l6 2 2 4h-4l-4-2v-4z"
  />,
  // 7: Witch Pointy Hat
  <path
    key="witchhat"
    d="M32 6L21 40h22L32 6zm-24 38c0-2.2 11.2-4 24-4s24 1.8 24 4c0 2.2-11.2 4-24 4S8 46.2 8 44zm14-4l-1 4h22l-1-4H22z"
  />,
  // 8: Halloween Wrapped Candy
  <path
    key="candy"
    d="M12 24l6 8-6 8 8-2 6-4 12-12-4-6-2 8zm40 16l-6-8 6-8-8 2-6 4-12 12 4 6 2-8zM24 24c-5.5 5.5-5.5 14.5 0 20s14.5 5.5 20 0-5.5-14.5-20-20z"
  />,
];

const CHRISTMAS_SVGS = [
  // 0: Jolly Snowman with hat, scarf & carrot
  <path
    key="snowman"
    d="M26 4h12v4H26V4zm-4 4h20v4H22V8zm10 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm-4 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm8 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-6 3l5 1-5 1v-2zm-12 7c0-2.2 1.8-4 4-4h24c2.2 0 4 1.8 4 4 0 1.1-.5 2-1.2 2.7 3.2 2.6 5.2 6.5 5.2 11 0 8-6.3 14.3-14 14.3h-4c-7.7 0-14-6.3-14-14.3 0-4.5 2-8.4 5.2-11-.7-.7-1.2-1.6-1.2-2.7zm20 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
  />,
  // 1: Snowy Pine Tree with Star
  <path
    key="snowytree"
    d="M32 4l3 5-5-1-5 1 3-5zm-3 7L16 26h6l-7 12h8l-8 14h34l-8-14h8l-7-12h6L35 11h-6zm0 39h6v8h-6v-8zm-6-24c4 2 10 2 14 0l-7-8-7 8zm-3 12c6 2 14 2 20 0l-10-8-10 8z"
  />,
  // 2: Cozy Holiday Fireplace with Stockings
  <path
    key="fireplace"
    d="M8 8h48v6H8V8zm4 6h40v40H12V14zm6 6v28h8V38c0-3.3 2.7-6 6-6s6 2.7 6 6v10h8V20H18zm12 28a4 4 0 0 0 4-4c0-2.2-1.8-4-4-4s-4 1.8-4 4a4 4 0 0 0 4 4zm-10-24h4v8l-2 3-2-3v-8zm8 0h4v8l-2 3-2-3v-8z"
  />,
  // 3: Intricate Crystal Snowflake
  <path
    key="snowflake"
    d="M30 6v8l-4-4-3 3 5 5h-8v4h8l-5 5 3 3 4-4v8h4v-8l4 4 3-3-5-5h8v-4h-8l5-5-3-3-4 4V6h-4zm0 28v8l-4-4-3 3 5 5h-8v4h8l-5 5 3 3 4-4v8h4v-8l4 4 3-3-5-5h8v-4h-8l5-5-3-3-4 4v-8h-4z"
  />,
  // 4: Santa Hat with Fluffy Pompom
  <path
    key="santahat"
    d="M50 14a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 48h40c2.2 0 4 1.8 4 4s-1.8 4-4 4H12c-2.2 0-4-1.8-4-4s1.8-4 4-4zm6-4L38 18c4 8 8 16 10 26H18z"
  />,
  // 5: Hot Cocoa Mug with Steam
  <path
    key="hotcocoa"
    d="M22 6c-1 3 1 5 0 8s-3 5-1 8h3c-1-3 1-5 0-8s-3-5 0-8h-2zm10 0c-1 3 1 5 0 8s-3 5-1 8h3c-1-3 1-5 0-8s-3-5 0-8h-2zm-18 18h28v18c0 7.7-6.3 14-14 14S14 49.7 14 42V24zm30 4v12c3.3 0 6-2.7 6-6s-2.7-6-6-6zm0-4h2c5.5 0 10 4.5 10 10s-4.5 10-10 10h-2V24z"
  />,
  // 6: Cozy Winter Mittens
  <path
    key="mittens"
    d="M24 16c-4.4 0-8 3.6-8 8v16c0 4.4 3.6 8 8 8h4c2.2 0 4-1.8 4-4v-6c2.2 0 4-1.8 4-4v-4c0-2.2-1.8-4-4-4v-6c0-4.4-3.6-8-8-8zm-8 34h20v6H16v-6zm32-34c4.4 0 8 3.6 8 8v16c0 4.4-3.6 8-8 8h-4c-2.2 0-4-1.8-4-4v-6c-2.2 0-4-1.8-4-4v-4c0-2.2 1.8-4 4-4v-6c0-4.4 3.6-8 8-8zm-4 34h20v6H44v-6z"
  />,
  // 7: Wrapped Holiday Gift Box
  <path
    key="gift"
    d="M26 8c-3 0-6 2-6 5s3 5 6 5h6V8h-6zm12 0h-6v10h6c3 0 6-2 6-5s-3-5-6-5zm-26 12v10h40V20H12zm4 14v22h14V34H16zm18 0v22h14V34H34z"
  />,
  // 8: Peppermint Candy Cane
  <path
    key="candycane"
    d="M36 6c-8.8 0-16 7.2-16 16v6h8v-6c0-4.4 3.6-8 8-8s8 3.6 8 8v34h8V22c0-8.8-7.2-16-16-16zm-10 20l4-4 4 4-4 4-4-4zm18 10l-4-4 4-4 4 4-4 4zm0 16l-4-4 4-4 4 4-4 4z"
  />,
];

const EASTER_SVGS = [
  // 0: Decorated Easter Egg
  <path
    key="easteregg"
    d="M32 6C20 6 12 24 12 38c0 12 9 20 20 20s20-8 20-20C52 24 44 6 32 6zm-14 30h28l-3 4H17l-1-4zm1 8h26c-2 6-7 10-13 10s-11-4-13-10zm25-16H18c2-7 7-14 14-14s12 7 14 14z"
  />,
  // 1: Bunny Silhouette
  <path
    key="bunny"
    d="M26 6c-3 0-5 6-4 14 1 6 4 10 6 12-5 3-8 9-8 16 0 9 7 14 16 14s16-5 16-14c0-7-3-13-8-16 2-2 5-6 6-12 1-8-1-14-4-14-3 0-5 5-5 11l-3 4-3-4c0-6-2-11-5-11z"
  />,
  // 2: Spring Flower
  <path
    key="springflower"
    d="M32 18a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM24 10a7 7 0 0 0-6 10c3 3 7 4 10 2-1-3-2-7-1-10a7 7 0 0 0-3-2zm16 0a7 7 0 0 0-3 2c1 3 0 7-1 10 3 2 7 1 10-2a7 7 0 0 0-6-10zM16 32a7 7 0 0 0 10 6c3-1 4-5 2-10-3-1-7 0-10 1a7 7 0 0 0-2 3zm32 0a7 7 0 0 0-2-3c-3-1-7-2-10-1-2 5-1 9 2 10a7 7 0 0 0 10-6zM30 38v18h4V38h-4z"
  />,
];

const SPRING_SVGS = [
  <path key="tulip" d="M32 8c-6 0-12 5-12 14 0 10 8 18 12 20 4-2 12-10 12-20 0-9-6-14-12-14zm-4 36v14h4V44c4-1 9-5 11-10l-4-2c-3 6-7 9-11 10v-2z" />,
  <path key="butterfly" d="M32 20c-1-4-4-7-8-7s-8 4-8 10c0 8 8 13 14 15-6 2-12 7-12 13 0 5 4 9 9 9 7 0 13-6 15-12 2 6 8 12 15 12 5 0 9-4 9-9 0-6-6-11-12-13 6-2 14-7 14-15 0-6-4-10-8-10s-7 3-8 7l-3 4-3-4z" />,
  <path key="sprout" d="M30 24c-8 0-14 6-14 14 6 0 12-4 14-10v30h4V34c2 6 8 10 14 10 0-8-6-14-14-14h-4v-6z" />,
];

const SUMMER_SVGS = [
  <path key="sun" d="M32 18a14 14 0 1 0 0 28 14 14 0 0 0 0-28zm0-12v6h-4V6h4zm0 46v6h-4v-6h4zM8 30v4H2v-4h6zm54 0v4h-6v-4h6zM15 13l4 4-3 3-4-4 3-3zm34 34l4 4-3 3-4-4 3-3zm-34 4l-4 4-3-3 4-4 3 3zm34-34l4-4 3 3-4 4-3-3z" />,
  <path key="palm" d="M30 28c-4-4-10-6-18-6 4 6 8 10 14 11-6 2-12 6-16 13 8-1 14-5 18-10v22h4V36c4 5 10 9 18 10-4-7-10-11-16-13 6-1 10-5 14-11-8 0-14 2-18 6V18h-4v10z" />,
];

const AUTUMN_SVGS = [
  <path key="maple" d="M32 6l3 10 8-3-4 8 11 3-7 7 6 7-10 2 3 9-10-4v13h-4V45l-10 4 3-9-10-2 6-7-7-7 11-3-4-8 8 3 3-10z" />,
  <path key="acorn" d="M32 6c-1 0-3 2-3 4h-5c-7 0-12 5-12 12h40c0-7-5-12-12-12h-5c0-2-2-4-3-4zm-18 18c0 14 8 26 18 34 10-8 18-20 18-34H14z" />,
];

const WINTER_SVGS = [
  <path key="snowflake-w" d="M30 6v8l-4-4-3 3 5 5h-8v4h8l-5 5 3 3 4-4v8h4v-8l4 4 3-3-5-5h8v-4h-8l5-5-3-3-4 4V6h-4zm0 28v8l-4-4-3 3 5 5h-8v4h8l-5 5 3 3 4-4v8h4v-8l4 4 3-3-5-5h8v-4h-8l5-5-3-3-4 4v-8h-4z" />,
  <path key="snowman" d="M32 8a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-10 18c-7 0-12 6-12 14s6 16 14 18l-4 4 4 2 4-4c2 0 4 0 6 0l4 4 4-2-4-4c8-2 14-10 14-18s-5-14-12-14H22z" />,
];

export const SeasonalCardWatermark: React.FC<SeasonalCardWatermarkProps> = ({
  variant = 0,
  className = '',
  style = {},
}) => {
  const seasonInfo = useSeason();
  if (!seasonInfo.enabled || !seasonInfo.theme) {
    return null;
  }

  const eventKey = (seasonInfo.event?.key || '').toLowerCase();
  const seasonKey = (seasonInfo.season?.key || '').toLowerCase();
  const themeKey = (seasonInfo.event?.key || seasonInfo.season?.key || seasonInfo.theme?.key || seasonInfo.forcedTheme || '').toLowerCase();

  let pool = HALLOWEEN_SVGS;

  if (eventKey.includes('hallow') || themeKey.includes('hallow') || themeKey.includes('spooky')) {
    pool = HALLOWEEN_SVGS;
  } else if (eventKey.includes('xmas') || eventKey.includes('christ') || themeKey.includes('christ') || themeKey.includes('bell')) {
    pool = CHRISTMAS_SVGS;
  } else if (eventKey.includes('easter') || themeKey.includes('easter')) {
    pool = EASTER_SVGS;
  } else if (seasonKey.includes('spring') || themeKey.includes('spring')) {
    pool = SPRING_SVGS;
  } else if (seasonKey.includes('summer') || themeKey.includes('summer')) {
    pool = SUMMER_SVGS;
  } else if (seasonKey.includes('autumn') || seasonKey.includes('fall') || themeKey.includes('autumn')) {
    pool = AUTUMN_SVGS;
  } else if (seasonKey.includes('winter') || themeKey.includes('winter')) {
    pool = WINTER_SVGS;
  }

  const svgItem = pool[variant % pool.length];
  const accent = seasonInfo.accent || '#f59e0b';

  return (
    <div
      className={`dash-seasonal-watermark ${className}`.trim()}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 10,
        width: 62,
        height: 62,
        opacity: 0.08,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        color: accent,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        ...style,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        fill="currentColor"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        {svgItem}
      </svg>
    </div>
  );
};
