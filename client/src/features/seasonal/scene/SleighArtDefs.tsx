/**
 * Santa's rig, as inline SVG `defs`.
 *
 * The markup is kept as a raw string (valid SVG attributes, no JSX attribute
 * conversion) and injected once — the same approach `SeasonalCharacters.tsx`
 * already uses for its built-in art. Both `#deer` and `#sleigh-art` are
 * referenced with `<use>` from `SceneActors`, so the rig costs one DOM node
 * plus a handful of `<use>`s.
 */
export const SLEIGH_ART = `
<defs>
  <g id="deer" stroke-linecap="round" stroke-linejoin="round">
    <g fill="none" stroke="#8a4520" stroke-width="7.5">
      <path d="M20 -46 L26 -24 L20 -5" /><path d="M-12 -48 L-17 -26 L-12 -5" />
    </g>
    <path d="M33 -56 q9 -3 10 5 q-2 5 -8 4" fill="none" stroke="#8a4520" stroke-width="4" />
    <path d="M-20 -54 q3 -14 22 -16 q20 -2 28 7 q7 8 0 15 q-8 8 -26 7 q-20 -1 -25 -7 q-4 -3 1 -6z" fill="#b06a33" />
    <path d="M18 -66 q14 1 16 12 q1 8 -8 9 q-8 1 -9 -8 q-1 -8 1 -13z" fill="#bd7639" />
    <path d="M-18 -56 q7 -10 16 -12 q-9 6 -10 14 q-1 7 2 12 q-10 -5 -8 -14z" fill="#c47c42" opacity=".75" />
    <path d="M12 -56 Q0 -76 -8 -90 Q-11 -97 -19 -96 Q-31 -94 -39 -89 Q-46 -86 -45 -82 Q-43 -78 -36 -79 Q-29 -80 -25 -84 Q-18 -82 -12 -70 Q-6 -60 12 -56 Z" fill="#b06a33" />
    <path d="M-39 -89 Q-46 -86 -45 -82 Q-43 -78 -36 -79 Q-41 -83 -39 -89 Z" fill="#6d3416" opacity=".55" />
    <path d="M-14 -93 Q-21 -97 -19 -106 Q-11 -103 -9 -94 Z" fill="#96541f" />
    <circle cx="-30" cy="-88" r="2.2" fill="#101c2a" /><circle cx="-30.8" cy="-88.8" r=".8" fill="#cfe0f5" />
    <g fill="none" stroke="#efe3cd" stroke-width="2.6">
      <path d="M-12 -96 q3 -12 9 -17" /><path d="M-11 -103 q-7 -2 -9 -9" /><path d="M-6 -109 q5 -2 6 -9" />
    </g>
    <g fill="none" stroke="#d9c9ae" stroke-width="1.8" opacity=".7"><path d="M-16 -97 q-2 -8 1 -13" /></g>
    <g fill="none" stroke="#a35c2c" stroke-width="8.5">
      <path d="M24 -46 L31 -24 L25 -4" /><path d="M-14 -48 L-20 -26 L-14 -4" />
    </g>
    <g stroke="#2b2018" stroke-width="7"><path d="M25 -4 L19 -4" /><path d="M-14 -4 L-20 -4" /></g>
    <path d="M-16 -52 q-7 -7 -13 -1" fill="none" stroke="#b8362c" stroke-width="4.6" />
    <circle cx="-24" cy="-56" r="2.4" fill="#f2c14e" />
  </g>

  <g id="sleigh-art" stroke-linecap="round" stroke-linejoin="round">
    <g fill="none" stroke="#f2c14e" stroke-width="1.6" stroke-opacity=".6">
      <path d="M229 67 Q150 42 58 48" /><path d="M229 71 Q180 68 136 62" />
    </g>
    <g fill="#ffe9b0">
      <circle cx="352" cy="74" r="2.4" /><circle cx="374" cy="56" r="1.6" />
      <circle cx="392" cy="80" r="1.2" /><circle cx="368" cy="92" r="1" />
    </g>
    <g class="leg leg--hind" transform="translate(178 122)" style="--d:-.22s"><use href="#deer" /></g>
    <g class="leg" transform="translate(74 102)"><use href="#deer" /></g>
    <g transform="translate(220 34)">
      <path d="M-6 62 q-12 0 -12 -10 q0 -7 7 -8" fill="none" stroke="#cfe0f5" stroke-width="3.4" />
      <path d="M-6 62 L72 62 q12 0 12 -11" fill="none" stroke="#cfe0f5" stroke-width="3.4" />
      <path d="M-14 51 L-14 59" fill="none" stroke="#9fb6d4" stroke-width="2.2" />
      <path d="M40 62 L40 46" fill="none" stroke="#9fb6d4" stroke-width="2.2" />
      <path d="M-8 46 C-14 30 -8 12 4 10 L58 6 C74 5 84 16 82 30 C80 42 71 47 58 47 Z" fill="#c0392b" />
      <path d="M-8 46 C-14 30 -8 12 4 10 L18 9 C6 14 2 30 6 40 C9 46 14 47 20 47 Z" fill="#9c281c" />
      <path d="M-2 20 C18 8 56 6 78 12" fill="none" stroke="#f2c14e" stroke-width="2.4" opacity=".9" />
      <path d="M6 12 C24 4 52 4 70 10" fill="none" stroke="#7d1f16" stroke-width="3" />
      <path d="M56 12 q13 -5 17 5 q4 11 -8 14 q-12 2 -14 -7 q-1 -8 5 -12z" fill="#2f6a41" />
      <path d="M56 19 q6 -5 12 -2" fill="none" stroke="#f2c14e" stroke-width="2" />
      <circle cx="73" cy="14" r="2.6" fill="#f2c14e" />
      <g transform="translate(18 8)">
        <path d="M-4 32 q-4 -19 12 -22 q15 -3 18 11 q2 10 -6 13z" fill="#e0453a" />
        <path d="M-4 26 q15 6 30 -1 l1 6 q-16 7 -31 1z" fill="#26303f" />
        <circle cx="12" cy="29" r="2.6" fill="#f2c14e" />
        <path d="M4 8 q-12 5 -16 15" fill="none" stroke="#e0453a" stroke-width="6.5" />
        <circle cx="-12" cy="24" r="3.2" fill="#fff2e6" />
        <path d="M-1 5 q8 12 19 8 q8 -3 4 -11 q-11 -4 -22 3z" fill="#fff2e6" />
        <circle cx="13" cy="-5" r="4.8" fill="#f7c9a3" />
        <path d="M5 -7 q1 -9 10 -9 q8 0 8 8 l-3 2z" fill="#e0453a" />
        <path d="M5 -7 q8 -4 18 -1" fill="none" stroke="#fff2e6" stroke-width="2.8" />
        <circle cx="24" cy="-15" r="2.8" fill="#fff2e6" />
        <circle cx="15.5" cy="-5.5" r="1.2" fill="#26303f" />
      </g>
    </g>
  </g>
</defs>`;

/** Hidden container that makes `#deer` / `#sleigh-art` available to every `<use>`. */
export const SleighArtDefs = () => (
  <svg className="cr-scene__defs" width="0" height="0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SLEIGH_ART }} />
);

export default SleighArtDefs;
