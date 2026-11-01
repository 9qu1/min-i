// 本人の顔（年齢・性別・幸せ・健康で変わる SVG。絵の素材は使わず図形だけ）
const SKIN = '#F4D3B5';
const CHEEK = '#F2A48F';
const LINE = '#4A3A33';

function hairColor(age) {
  if (age >= 70) return '#E4DED8';
  if (age >= 58) return '#A79C95';
  if (age >= 48) return '#6E5B50';
  return '#4A3428';
}

function bgColor(age) {
  if (age < 6) return '#FBE3C9';
  if (age < 12) return '#E8F0D6';
  if (age < 18) return '#DDEBF4';
  if (age < 30) return '#F6E0DA';
  if (age < 50) return '#EDE3F2';
  if (age < 65) return '#F3E9D2';
  return '#E6E1DA';
}

function hair(age, g, c) {
  if (age < 3) return `<path d="M30 13 q3 -6 6 0 q-1 3 -3 4" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
  if (age < 12) {
    if (g === 'm') return `<path d="M15 31 Q15 12 32 12 Q49 12 49 31 Q44 22 32 22 Q20 22 15 31Z" fill="${c}"/>`;
    return `<path d="M15 33 Q14 12 32 12 Q50 12 49 33 Q45 21 32 20 Q19 21 15 33Z" fill="${c}"/><circle cx="12" cy="28" r="5" fill="${c}"/><circle cx="52" cy="28" r="5" fill="${c}"/>`;
  }
  if (age < 18) {
    if (g === 'm') return `<path d="M15 30 L17 17 L22 20 L26 12 L31 18 L36 11 L40 18 L46 14 L49 30 Q44 21 32 21 Q20 21 15 30Z" fill="${c}"/>`;
    return `<path d="M14 44 Q11 12 32 12 Q53 12 50 44 L46 44 Q48 24 32 22 Q17 24 18 44Z" fill="${c}"/>`;
  }
  if (age < 50) {
    if (g === 'm') return `<path d="M15 30 Q14 13 32 12 Q50 13 49 30 Q47 21 38 19 Q30 22 22 20 Q16 23 15 30Z" fill="${c}"/>`;
    return `<path d="M13 48 Q10 12 32 12 Q54 12 51 48 L46 48 Q49 26 36 20 Q27 26 18 26 Q16 36 18 48Z" fill="${c}"/>`;
  }
  if (age < 65) {
    if (g === 'm') return `<path d="M15 31 Q15 18 22 16 Q20 22 18 31Z M49 31 Q49 18 42 16 Q44 22 46 31Z" fill="${c}"/><path d="M23 15 Q32 11 41 15" fill="none" stroke="${c}" stroke-width="2"/>`;
    return `<path d="M14 36 Q12 13 32 13 Q52 13 50 36 Q48 22 32 21 Q16 22 14 36Z" fill="${c}"/><circle cx="18" cy="22" r="4" fill="${c}"/><circle cx="46" cy="22" r="4" fill="${c}"/><circle cx="32" cy="14" r="4" fill="${c}"/>`;
  }
  if (g === 'm') return `<path d="M15 32 Q15 22 20 19 Q19 26 18 32Z M49 32 Q49 22 44 19 Q45 26 46 32Z" fill="${c}"/>`;
  return `<circle cx="32" cy="10" r="6" fill="${c}"/><path d="M15 33 Q14 14 32 14 Q50 14 49 33 Q46 22 32 21 Q18 22 15 33Z" fill="${c}"/>`;
}

export function avatarSVG({ age = 0, gender = 'm', stats = {}, dead = false } = {}) {
  const happy = stats.happy ?? 60;
  const health = stats.health ?? 70;
  const c = hairColor(age);
  const faceR = age < 3 ? 17 : 15;
  const cy = age < 3 ? 34 : 33;
  const tired = health < 30;
  const eyes = tired
    ? `<path d="M24 ${cy} h5 M35 ${cy} h5" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/>`
    : `<circle cx="26.5" cy="${cy}" r="${age < 3 ? 1.9 : 1.6}" fill="${LINE}"/><circle cx="37.5" cy="${cy}" r="${age < 3 ? 1.9 : 1.6}" fill="${LINE}"/>`;
  const my = cy + 8;
  const mouth = happy >= 60
    ? `<path d="M27 ${my - 1} Q32 ${my + 4} 37 ${my - 1}" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/>`
    : happy >= 35
      ? `<path d="M28 ${my} Q32 ${my + 1.6} 36 ${my}" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/>`
      : `<path d="M28 ${my + 1.5} Q32 ${my - 2} 36 ${my + 1.5}" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/>`;
  const glasses = age >= 65 ? `<g fill="none" stroke="#7B6A5E" stroke-width="1.3"><circle cx="26.5" cy="${cy}" r="4"/><circle cx="37.5" cy="${cy}" r="4"/><path d="M30.5 ${cy} h3"/></g>` : '';
  const wrinkle = age >= 60 ? `<path d="M22 ${cy - 6} q2 -1 4 0 M38 ${cy - 6} q2 -1 4 0" stroke="#C9A58C" stroke-width="1" fill="none"/>` : '';
  const body = age < 3 ? '' : `<path d="M14 64 Q16 50 32 49 Q48 50 50 64Z" fill="${dead ? '#B9B2AC' : '#C8553D'}" opacity=".85"/>`;
  const halo = dead ? '<ellipse cx="32" cy="8" rx="10" ry="2.6" fill="none" stroke="#D9B44A" stroke-width="1.6"/>' : '';
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${dead ? ' style="filter:grayscale(.85)"' : ''}>`
    + `<circle cx="32" cy="32" r="32" fill="${bgColor(age)}"/>${body}`
    + `<circle cx="32" cy="${cy}" r="${faceR}" fill="${SKIN}"/>${hair(age, gender, c)}`
    + `<circle cx="23" cy="${cy + 5}" r="2.6" fill="${CHEEK}" opacity=".55"/><circle cx="41" cy="${cy + 5}" r="2.6" fill="${CHEEK}" opacity=".55"/>`
    + `${eyes}${mouth}${glasses}${wrinkle}${halo}</svg>`;
}
