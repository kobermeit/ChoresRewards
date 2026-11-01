import React, { useEffect, useMemo, useState } from 'react';
import { useGetSeasonalQuery } from '../../store/api';
import { useNavigation, useUiPref } from '../../hooks/useSettings';
import { resolveAssetUrl } from '../../api';

/**
 * Seasonal character layer: sits behind the app chrome (`pointer-events:none`,
 * `aria-hidden`) and draws a few characters at the screen edges that idle gently.
 * Visible only when seasonal themes are on AND the per-device
 * "Show Seasonal Characters" pref is enabled.
 *
 * ART: each character first tries to load a custom file from
 *   static/images/characters/<theme>/<name>.svg
 * If it is missing (404) the built-in inline SVG below is used instead, so
 * commissioned artwork can be dropped in with no code change.
 */

const ART: Record<string, { viewBox: string; svg: string }> = {
  jack: {
    viewBox: '0 0 120 270',
    svg: `
      <g stroke="#252542" stroke-width="8" stroke-linecap="round" fill="none">
        <path d="M52 196 L46 250"/><path d="M68 196 L74 250"/><path d="M46 250 L34 254"/><path d="M74 250 L86 254"/>
      </g>
      <path d="M45 120 Q60 110 75 120 L80 192 Q60 200 40 192 Z" fill="#252542"/>
      <g stroke="#4a4a6a" stroke-width="1.6">
        <path d="M50 122 L48 192"/><path d="M55 119 L54 195"/><path d="M60 118 L60 197"/><path d="M65 119 L66 195"/><path d="M70 122 L72 192"/>
      </g>
      <g stroke="#252542" stroke-width="6" stroke-linecap="round" fill="none">
        <path d="M45 128 C33 142 29 160 25 178"/><path d="M75 128 C87 142 91 160 95 178"/>
      </g>
      <path d="M60 112 l-14 -7 5 9 -9 5 18 2z M60 112 l14 -7 -5 9 9 5 -18 2z" fill="#141026"/>
      <g class="cr-char__head">
        <ellipse cx="60" cy="70" rx="31" ry="35" fill="#f8f5e8"/>
        <ellipse cx="48" cy="66" rx="8.5" ry="11" fill="#0a0a14"/>
        <ellipse cx="72" cy="66" rx="8.5" ry="11" fill="#0a0a14"/>
        <circle cx="50.5" cy="62" r="2" fill="#f8f5e8"/><circle cx="74.5" cy="62" r="2" fill="#f8f5e8"/>
        <path d="M43 86 q17 12 34 0" stroke="#0a0a14" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <g stroke="#0a0a14" stroke-width="2"><path d="M51 82 v9"/><path d="M60 84 v9"/><path d="M69 82 v9"/></g>
      </g>`,
  },
  sally: {
    viewBox: '0 0 120 250',
    svg: `
      <path d="M43 122 Q60 113 77 122 L90 208 Q60 220 30 208 Z" fill="#7b6e9e"/>
      <g stroke="#2b2440" stroke-width="1.6"><path d="M39 152 h44"/><path d="M35 174 h52"/><path d="M33 196 h56"/></g>
      <g stroke="#a89fc4" stroke-width="6.5" fill="none" stroke-linecap="round">
        <path d="M43 130 C33 148 29 164 27 182"/><path d="M77 130 C87 148 91 164 93 182"/>
      </g>
      <circle cx="60" cy="86" r="27" fill="#ded8ea"/>
      <ellipse cx="51" cy="82" rx="4.5" ry="5.5" fill="#191330"/>
      <ellipse cx="69" cy="82" rx="4.5" ry="5.5" fill="#191330"/>
      <path d="M52 96 q8 6 16 0" stroke="#191330" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M60 56 q-20 2 -23 20 q12 -8 23 -5 q11 -3 23 5 q-3 -18 -23 -20" fill="#c2410c"/>
      <path d="M37 74 q-4 16 2 26 M83 74 q4 16 -2 26" stroke="#c2410c" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  },
  zero: {
    viewBox: '0 0 160 130',
    svg: `
      <path d="M14 74 q0 -30 30 -35 q7 -18 17 -16 q10 2 9 15 q30 0 38 26 q8 26 -14 32 q-6 18 -18 12 q-12 10 -22 0 q-34 2 -40 -34 Z" fill="#eef2ff" opacity=".96"/>
      <path d="M40 34 l-9 -13 l14 4 z" fill="#e3e8f7"/>
      <circle cx="104" cy="60" r="6" fill="#141026"/><circle cx="106" cy="60" r="1.8" fill="#eef2ff"/>
      <ellipse cx="112" cy="78" rx="7" ry="5.5" fill="#fb923c"/>
      <path d="M14 84 q-10 10 -2 20 M30 96 q-8 12 2 20" stroke="#eef2ff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>`,
  },
  oogie: {
    viewBox: '0 0 150 200',
    svg: `
      <path d="M75 6 q48 4 54 62 q6 64 -26 102 q-24 24 -56 0 q-32 -38 -26 -102 q6 -58 54 -62 Z" fill="#a17f4d"/>
      <path d="M75 6 q48 4 54 62 q6 64 -26 102 q-24 24 -56 0 q-32 -38 -26 -102 q6 -58 54 -62 Z" fill="none" stroke="#5d4527" stroke-width="3"/>
      <g stroke="#5d4527" stroke-width="2.4" stroke-dasharray="4 5"><path d="M75 18 v140"/><path d="M44 52 q31 9 62 0"/><path d="M38 96 q37 11 74 0"/></g>
      <g class="cr-char__eyes"><circle cx="58" cy="70" r="10" fill="#a3e635"/><circle cx="92" cy="70" r="10" fill="#a3e635"/>
        <circle cx="58" cy="70" r="4" fill="#1a2408"/><circle cx="92" cy="70" r="4" fill="#1a2408"/></g>
      <path d="M54 104 q21 16 42 0" stroke="#3f2f18" stroke-width="4.5" fill="none" stroke-dasharray="6 5" stroke-linecap="round"/>`,
  },
  lock: {
    viewBox: '0 0 80 92',
    svg: `<path d="M16 34 q-4 -22 6 -26 q6 12 10 12 q6 0 12 -12 q10 4 6 26" fill="#7f1d1d"/>
      <circle cx="40" cy="46" r="26" fill="#b91c1c"/>
      <ellipse cx="32" cy="42" rx="5" ry="6.5" fill="#0b0716"/><ellipse cx="48" cy="42" rx="5" ry="6.5" fill="#0b0716"/>
      <path d="M28 58 q12 10 24 0" stroke="#0b0716" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  shock: {
    viewBox: '0 0 80 92',
    svg: `<path d="M40 2 L58 34 H22 Z" fill="#312e81"/>
      <ellipse cx="40" cy="56" rx="24" ry="24" fill="#c7d2fe"/>
      <ellipse cx="32" cy="52" rx="4.5" ry="5.5" fill="#0b0716"/><ellipse cx="48" cy="52" rx="4.5" ry="5.5" fill="#0b0716"/>
      <path d="M40 58 l-4 11 h8 Z" fill="#0b0716"/>
      <path d="M31 71 q9 7 18 0" stroke="#0b0716" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
  barrel: {
    viewBox: '0 0 80 92',
    svg: `<circle cx="40" cy="50" r="26" fill="#f1f5f9"/>
      <circle cx="31" cy="46" r="7.5" fill="#0b0716"/><circle cx="49" cy="46" r="7.5" fill="#0b0716"/>
      <circle cx="31" cy="46" r="2" fill="#f1f5f9"/><circle cx="49" cy="46" r="2" fill="#f1f5f9"/>
      <g stroke="#0b0716" stroke-width="2"><path d="M35 60 v9"/><path d="M45 60 v9"/></g>
      <path d="M28 64 q12 8 24 0" stroke="#0b0716" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  },
};

/** Where each character sits and how big it is, per theme. */
const SETS: Record<string, Array<{ name: string; left?: string; right?: string; bottom: string; width: number }>> = {
  halloween: [
    { name: 'jack', left: '0.5%', bottom: '0px', width: 168 },
    { name: 'sally', right: '0.5%', bottom: '0px', width: 152 },
    { name: 'zero', right: '0.5%', bottom: '250px', width: 150 },
    { name: 'oogie', left: '11%', bottom: '0px', width: 120 },
    { name: 'lock', left: '19%', bottom: '-4px', width: 68 },
    { name: 'shock', left: '23%', bottom: '-4px', width: 68 },
    { name: 'barrel', left: '27%', bottom: '-4px', width: 68 },
  ],
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const KID_VIEWS = new Set(['dashboard', 'chores', 'rewards']);

export const SeasonalCharacters: React.FC = () => {
  const { data } = useGetSeasonalQuery();
  const [enabled] = useUiPref('seasonalCharacters');
  const { activeView } = useNavigation();

  const themeKey = useMemo(() => {
    const active: any = (data as any)?.active;
    return String(active?.event?.key || active?.season?.key || '').toLowerCase();
  }, [data]);

  const themesOn = Boolean((data as any)?.settings?.seasonal_themes_enabled);
  const isHalloween = themeKey.includes('halloween');
  const characters = useMemo(() => (isHalloween ? SETS.halloween : []), [isHalloween]);
  // Randomised phase + duration per mount so the scene never reads as a loop
  const motion = useMemo(
    () => characters.map(() => ({ dur: rnd(5.5, 9.5), delay: -rnd(0, 8) })),
    [characters]
  );

  // Custom art is opt-in through a manifest, so a missing file never spams the console
  const [customArt, setCustomArt] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!enabled || !themesOn || !themeKey) return;
    let cancelled = false;
    fetch(resolveAssetUrl(`static/images/characters/${themeKey}/manifest.json`), { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: any) => {
        if (cancelled || !json) return;
        const list: string[] = Array.isArray(json.characters) ? json.characters : [];
        const map: Record<string, boolean> = {};
        for (const name of list) map[String(name)] = true;
        setCustomArt(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, themesOn, themeKey]);

  // Kid-facing pages only (Today / Chores / Rewards) — never over the meal planner or settings
  if (!enabled || !themesOn || characters.length === 0 || !KID_VIEWS.has(activeView)) return null;

  return (
    <div className="cr-characters" aria-hidden="true">
      {characters.map((char, index) => {
        const art = ART[char.name];
        if (!art) return null;
        return (
          <div
            key={char.name}
            className={`cr-char cr-char--${char.name}`}
            style={{
              left: char.left,
              right: char.right,
              bottom: char.bottom,
              width: char.width,
              animationDuration: `${motion[index].dur}s`,
              animationDelay: `${motion[index].delay}s`,
            }}
          >
            {customArt[char.name] ? (
              <img
                className="cr-char__custom"
                src={resolveAssetUrl(`static/images/characters/${themeKey}/${char.name}.svg`)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span
                className="cr-char__builtin"
                dangerouslySetInnerHTML={{
                  __html: `<svg viewBox="${art.viewBox}" width="100%">${art.svg}</svg>`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SeasonalCharacters;

