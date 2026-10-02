// Generates part6.json: icons for school, jobs, health, the body, feelings.
import fs from 'node:fs';
const OUT = process.argv[2] || new URL('../../icons/part6.json', import.meta.url);
const items = [];
const add = (id, motif, parts) => items.push({ id, motif, svg: parts.join('') });

// 4-point sparkle centred at (x,y), radius s
const spark = (x, y, s, cls = 't-c') => `<path class="${cls}" d="M${x},${y - s}Q${x + s * .16},${y - s * .16} ${x + s},${y}Q${x + s * .16},${y + s * .16} ${x},${y + s}Q${x - s * .16},${y + s * .16} ${x - s},${y}Q${x - s * .16},${y - s * .16} ${x},${y - s}Z"/>`;
const HEART = 'M0 .9C-.35 .62-1 .2-1-.3C-1-.72-.68-.98-.42-.98C-.18-.98 0-.8 0-.58C0-.8 .18-.98 .42-.98C.68-.98 1-.72 1-.3C1 .2 .35 .62 0 .9Z';

// ---------- school ----------
add('pencil', 'sharpened pencil', [
  '<g transform="translate(32 32) rotate(-45)">',
  '<rect class="t-c" x="-36.5" y="-7" width="13" height="14" rx="4"/>',
  '<path class="t-b" d="M-36.5,2.5H-23.5V7H-32.5A4,4 0 0 1 -36.5,3Z"/>',
  '<rect class="t-b" x="-26" y="-7.8" width="9.5" height="15.6" rx="1.5"/>',
  '<rect class="t-a" x="-23.4" y="-7.8" width="1.4" height="15.6"/><rect class="t-a" x="-20.2" y="-7.8" width="1.4" height="15.6"/>',
  '<rect class="t-a" x="-16.5" y="-7" width="37" height="14"/>',
  '<rect class="t-b" x="-16.5" y="2.4" width="37" height="4.6"/>',
  '<rect class="t-c" x="-13" y="-5" width="28" height="2.2" rx="1.1"/>',
  '<path class="t-c" d="M20.5,-7L34.6,-1.4Q36.6,0 34.6,1.4L20.5,7Z"/>',
  '<path class="t-a" d="M20.5,-7Q24,-4.7 20.5,-2.3Q24,0 20.5,2.3Q24,4.7 20.5,7Z"/>',
  '<path class="t-b" d="M30,-3.2L34.6,-1.4Q36.6,0 34.6,1.4L30,3.2Q31.4,0 30,-3.2Z"/>',
  '</g>',
]);

add('chalkboard', 'chalkboard on an easel', [
  '<path class="t-b" d="M11,48L5,62H10.5L16.5,48Z"/><path class="t-b" d="M53,48L59,62H53.5L47.5,48Z"/>',
  '<rect class="t-a" x="3" y="4" width="58" height="43" rx="4"/>',
  '<path class="t-b" fill-rule="evenodd" d="M8,9H56V42H8ZM18.5,13L25.5,25H11.5ZM18.5,16.9L14.7,23.2H22.3ZM31.35,15.3H33.15V18.2H36V20H33.15V22.9H31.35V20H28.5V18.2H31.35ZM39,19a6,6 0 1 0 12,0a6,6 0 1 0 -12,0ZM40.9,19a4.1,4.1 0 1 0 8.2,0a4.1,4.1 0 1 0 -8.2,0ZM12,30h15v1.8h-15zM30,30h9v1.8h-9zM12,35h22v1.8h-22z"/>',
  '<rect class="t-c" x="6" y="5.6" width="20" height="1.8" rx=".9"/>',
  '<path class="t-c" fill-rule="evenodd" d="M18.5,13L25.5,25H11.5ZM18.5,16.9L14.7,23.2H22.3Z"/>',
  '<path class="t-c" d="M31.35,15.3H33.15V18.2H36V20H33.15V22.9H31.35V20H28.5V18.2H31.35Z"/>',
  '<path class="t-c" fill-rule="evenodd" d="M39,19a6,6 0 1 0 12,0a6,6 0 1 0 -12,0ZM40.9,19a4.1,4.1 0 1 0 8.2,0a4.1,4.1 0 1 0 -8.2,0Z"/>',
  '<rect class="t-c" x="12" y="30" width="15" height="1.8" rx=".9"/><rect class="t-c" x="30" y="30" width="9" height="1.8" rx=".9"/><rect class="t-c" x="12" y="35" width="22" height="1.8" rx=".9"/>',
  '<rect class="t-a" x="1" y="44" width="62" height="5" rx="2.5"/>',
  '<rect class="t-b" x="3" y="47" width="58" height="2" rx="1"/>',
  '<rect class="t-c" x="41" y="40.6" width="10" height="3.4" rx="1.3"/>',
  '<rect class="t-b" x="11" y="38.5" width="12" height="5.5" rx="1.5"/><rect class="t-c" x="11" y="38.5" width="12" height="2.2" rx="1"/>',
]);

add('graduation-cap', 'mortarboard with tassel and diploma', [
  '<path class="t-b" d="M15,24V38C15,43 23,46.5 32,46.5C41,46.5 49,43 49,38V24Z"/>',
  '<path class="t-a" d="M15,33C22,36 42,36 49,33V38C49,43 41,46.5 32,46.5C23,46.5 15,43 15,38Z"/>',
  '<path class="t-b" d="M2,20L32,33L62,20V23L32,36L2,23Z"/>',
  '<polygon class="t-a" points="32,7 62,20 32,33 2,20"/>',
  '<polygon class="t-c" points="32,10 9,20 12.5,21.5 32,13"/>',
  '<circle class="t-b" cx="32" cy="20" r="2.3"/>',
  '<path class="ln" stroke-width="2.2" d="M32,20L52,24.3V41"/>',
  '<path class="t-b" d="M49.8,41H54.2L57,53H47Z"/><rect class="t-a" x="49" y="39" width="6" height="4" rx="1.8"/>',
  '<g transform="rotate(-10 21 55)">',
  '<rect class="t-c" x="4" y="50.5" width="34" height="9" rx="2"/>',
  '<ellipse class="t-a" cx="5" cy="55" rx="3" ry="4.5"/><ellipse class="t-b" cx="5" cy="55" rx="1.2" ry="2"/>',
  '<rect class="t-b" x="19" y="49.5" width="4.5" height="11" rx="1"/>',
  '<path class="t-b" d="M20,60L18,64.5L21.2,63L21.2,60ZM22.5,60L24.5,64.5L21.3,63L21.3,60Z"/>',
  '</g>',
]);

add('alarm-clock', 'ringing alarm clock', [
  '<path class="ln" stroke-width="2.4" d="M4,26C2.5,22 3,17.5 5.5,14M9,28C8,25.5 8.2,23 9.8,21"/>',
  '<path class="ln" stroke-width="2.4" d="M60,26C61.5,22 61,17.5 58.5,14M55,28C56,25.5 55.8,23 54.2,21"/>',
  '<path class="t-b" d="M18,52L11.5,61.5H17L23,55Z"/><path class="t-b" d="M46,52L52.5,61.5H47L41,55Z"/>',
  '<path class="ln" stroke-width="3" d="M32,15V7"/><circle class="t-b" cx="32" cy="6" r="3"/>',
  '<g transform="translate(17 14) rotate(-38)"><path class="t-a" d="M-10,4A10,9.5 0 0 1 10,4Z"/><rect class="t-b" x="-11.5" y="3" width="23" height="3.4" rx="1.7"/><path class="t-c" d="M-6.8,1.5A7,7 0 0 1 -2,-4.2L-1.5,-2A4.5,4.5 0 0 0 -4.4,1.5Z"/></g>',
  '<g transform="translate(47 14) rotate(38)"><path class="t-a" d="M-10,4A10,9.5 0 0 1 10,4Z"/><rect class="t-b" x="-11.5" y="3" width="23" height="3.4" rx="1.7"/><path class="t-c" d="M-6.8,1.5A7,7 0 0 1 -2,-4.2L-1.5,-2A4.5,4.5 0 0 0 -4.4,1.5Z"/></g>',
  '<circle class="t-a" cx="32" cy="37" r="22"/>',
  '<path class="t-b" fill-rule="evenodd" d="M10,37a22,22 0 1 0 44,0a22,22 0 1 0 -44,0ZM11,35.5a19.5,19.5 0 1 0 39,0a19.5,19.5 0 1 0 -39,0Z"/>',
  '<circle class="t-c" cx="31" cy="36" r="15.5"/>',
  '<path class="t-c" d="M13.6,30A19,19 0 0 1 19.5,21L21,22.6A16.5,16.5 0 0 0 16,30.5Z"/>',
  '<circle class="t-b" cx="31" cy="23.8" r="1.5"/><circle class="t-b" cx="43.2" cy="36" r="1.5"/><circle class="t-b" cx="31" cy="48.2" r="1.5"/><circle class="t-b" cx="18.8" cy="36" r="1.5"/>',
  '<path class="ln" stroke-width="3" d="M31,36V27M31,36L38,40"/>',
  '<circle class="t-b" cx="31" cy="36" r="2.4"/>',
]);

// ---------- health / jobs ----------
add('stethoscope', 'stethoscope with a little heart', [
  '<path class="ln" stroke-width="4" d="M13,8C11,20 14,30 24,33M35,8C37,20 34,30 24,33"/>',
  '<path class="ln" stroke-width="4.5" d="M24,33V44C24,54 30,59 38,59C45,59 48,55 48,49"/>',
  '<circle class="t-a" cx="13" cy="6" r="3.4"/><circle class="t-a" cx="35" cy="6" r="3.4"/>',
  '<rect class="t-a" x="20.5" y="30.5" width="7" height="6" rx="2"/>',
  '<rect class="t-b" x="45" y="45" width="6" height="5" rx="1"/>',
  '<circle class="t-b" cx="48" cy="36" r="12"/>',
  '<circle class="t-a" cx="48" cy="36" r="9.5"/>',
  '<circle class="t-c" cx="48" cy="36" r="4.5"/>',
  '<path class="t-c" d="M40.8,33A8,8 0 0 1 45,28.3L45.8,30A6,6 0 0 0 42.6,33.5Z"/>',
  `<g transform="translate(53 12) rotate(12) scale(8)"><path class="t-a" d="${HEART}"/></g>`,
]);

add('first-aid-kit', 'first-aid kit with a cross', [
  '<path class="t-b" d="M20,20V11A5,5 0 0 1 25,6H39A5,5 0 0 1 44,11V20H39V12.5A1.5,1.5 0 0 0 37.5,11H26.5A1.5,1.5 0 0 0 25,12.5V20Z"/>',
  '<rect class="t-a" x="4" y="17" width="56" height="43" rx="7"/>',
  '<path class="t-b" d="M4,52H60V53A7,7 0 0 1 53,60H11A7,7 0 0 1 4,53Z"/>',
  '<path class="t-b" d="M60,24V52H55V24Z"/>',
  '<path class="ln" d="M5,27H59"/>',
  '<rect class="t-b" x="13" y="23" width="5" height="7" rx="1.2"/><rect class="t-b" x="46" y="23" width="5" height="7" rx="1.2"/>',
  '<path class="t-b" d="M29.5,32H37.5V38.5H44V46.5H37.5V53H29.5V46.5H23V38.5H29.5Z"/>',
  '<path class="t-c" d="M28,30.5H36V37H42.5V45H36V51.5H28V45H21.5V37H28Z"/>',
  '<rect class="t-c" x="8" y="31" width="2.6" height="15" rx="1.3"/>',
]);

add('bandage', 'adhesive bandage', [
  '<path class="t-b" d="M8,6H11V9H14V12H11V15H8V12H5V9H8Z"/>',
  '<path class="t-b" d="M52,49H55V52H58V55H55V58H52V55H49V52H52Z"/>',
  '<g transform="translate(32 32) rotate(-45)">',
  '<rect class="t-a" x="-33" y="-11.5" width="66" height="23" rx="11.5"/>',
  '<path class="t-b" d="M-31.6,5.5A11.5,11.5 0 0 0 -21.5,11.5H21.5A11.5,11.5 0 0 0 31.6,5.5Z"/>',
  '<rect class="t-c" x="-11" y="-9" width="22" height="18" rx="3"/>',
  '<rect class="t-b" x="-11" y="5.5" width="22" height="3.5" rx="1.5"/>',
  '<circle class="t-b" cx="-17" cy="-4" r="1.4"/><circle class="t-b" cx="-24" cy="-4" r="1.4"/><circle class="t-b" cx="-17" cy="2" r="1.4"/><circle class="t-b" cx="-24" cy="2" r="1.4"/>',
  '<circle class="t-b" cx="17" cy="-4" r="1.4"/><circle class="t-b" cx="24" cy="-4" r="1.4"/><circle class="t-b" cx="17" cy="2" r="1.4"/><circle class="t-b" cx="24" cy="2" r="1.4"/>',
  '<rect class="t-c" x="-29" y="-9" width="12" height="2.2" rx="1.1"/>',
  '</g>',
]);

add('pill', 'capsule and tablets', [
  '<g transform="translate(42 24) rotate(-45)">',
  '<path class="t-a" d="M0,-10H-14A10,10 0 0 0 -14,10H0Z"/>',
  '<path class="t-b" d="M0,-10H14A10,10 0 0 1 14,10H0Z"/>',
  '<rect class="t-c" x="-18" y="-6.5" width="14" height="3.2" rx="1.6"/>',
  '<rect class="t-a" x="4" y="-6.5" width="11" height="3.2" rx="1.6"/>',
  '</g>',
  '<ellipse class="t-b" cx="16" cy="50.5" rx="13" ry="9.5"/>',
  '<ellipse class="t-a" cx="16" cy="47.5" rx="13" ry="9"/>',
  '<path class="ln" stroke-width="2.2" d="M7,47.5H25"/>',
  '<ellipse class="t-c" cx="10" cy="43" rx="3.5" ry="1.4"/>',
  '<ellipse class="t-b" cx="49" cy="55.5" rx="8" ry="5.5"/><ellipse class="t-a" cx="49" cy="53.8" rx="8" ry="5"/>',
  '<ellipse class="t-c" cx="45.5" cy="52" rx="2.2" ry="1"/>',
]);

// ---------- body ----------
add('tooth', 'smiling tooth with sparkles', [
  '<path class="t-a" d="M32,12C26,6 12,6 11,19C10,29 14,36 16,44C18,52 19,59 23,59C27,59 27,48 32,46C37,48 37,59 41,59C45,59 46,52 48,44C50,36 54,29 53,19C52,6 38,6 32,12Z"/>',
  '<path class="t-b" d="M53,19C54,29 50,36 48,44C46,52 45,59 41,59C38.5,59 37.6,55 37,51C40.5,52 42,47 43.5,41C45.5,33 49.5,28 49.5,19.5C49.5,14.5 47.5,11 44.5,9C49.5,9.5 52.7,13 53,19Z"/>',
  '<path class="t-c" d="M16,17C17.5,12.5 21.5,10.5 26,11.5C22,13 19.8,15.8 19.5,20C18,20.5 15.7,19.5 16,17Z"/>',
  '<ellipse class="t-b" cx="24.5" cy="27" rx="2.4" ry="3.2"/><ellipse class="t-b" cx="39.5" cy="27" rx="2.4" ry="3.2"/>',
  '<ellipse class="t-c" cx="19.5" cy="33" rx="3" ry="1.8"/><ellipse class="t-c" cx="44.5" cy="33" rx="3" ry="1.8"/>',
  '<path class="ln" stroke-width="2.4" d="M27,34Q32,39 37,34"/>',
  spark(57, 8, 5), spark(7, 50, 4), spark(59, 38, 3),
]);

add('brain', 'brain with folds', [
  '<path class="t-b" d="M35,43C36.5,49 36,55 33,60.5H40.5C42,55 43,49 43,43Z"/>',
  '<ellipse class="t-b" cx="48.5" cy="44.5" rx="9.5" ry="6.5"/>',
  '<path class="t-a" d="M12,42C6,40 3,34 4,28C4,22 6,17 10,14C12,9 18,6 24,7C28,4 36,4 40,7C45,5 52,7 55,12C59,16 61,22 60,28C60,35 57,39 52,41C48,43 44,43 42,42C39,46 34,48 28,47C22,46 18,44 12,42Z"/>',
  '<path class="t-b" d="M60,28C60,35 57,39 52,41C48,43 44,43 42,42C39,46 34,48 28,47C22,46 18,44 12,42C22,43.5 30,43.5 36,40.5C44,37 54,34 60,28Z"/>',
  '<path class="t-c" d="M7.5,25C7.5,19 11,13.5 17,11C13.5,15 11.8,19.5 11.5,25C10.5,26 8.5,26 7.5,25Z"/>',
  '<path class="ln" stroke-width="2.3" d="M13,34C19,32 25,36 31,33C35,31 40,30.5 45,33"/>',
  '<path class="ln" stroke-width="2.3" d="M33,7C31.5,12 36,15 33.5,20C31.5,24 34.5,26.5 33,29"/>',
  '<path class="ln" stroke-width="2.3" d="M9,24C13,21.5 16,25 20,23M17,13C16,17 19,19.5 23,18M23,28C24,25 28,24 29,27M44,10C43,14 46.5,16.5 50,15M40,22C43,19 48,20.5 50,24M50,31C53,31 55,32.5 57,30.5M19,40C23,38 27,41 31,39"/>',
  '<path class="t-a" d="M41.5,44.5C45,46.5 52,46.5 56,44.5V46C52,48.5 45,48.5 41.5,46Z"/>',
  '<path class="t-a" d="M43,48.5C46,50 51,50 54,48.5V49.8C51,51.5 46,51.5 43,49.8Z"/>',
]);

add('eye', 'eye with lashes', [
  '<path class="ln" stroke-width="2.6" d="M17,20.8L12.5,14.5M24.5,17.9L22.5,11M32,17V9.5M39.5,17.9L41.5,11M47,20.8L51.5,14.5"/>',
  '<path class="t-b" fill-rule="evenodd" d="M2,33Q32,2 62,33Q32,64 2,33ZM7,33Q32,7 57,33Q32,59 7,33Z"/>',
  '<path class="t-c" d="M7,33Q32,7 57,33Q32,59 7,33Z"/>',
  '<circle class="t-a" cx="32" cy="33" r="12"/>',
  '<path class="t-b" fill-rule="evenodd" d="M20,33a12,12 0 1 0 24,0a12,12 0 1 0 -24,0ZM21,32a10.5,10.5 0 1 0 21,0a10.5,10.5 0 1 0 -21,0Z"/>',
  '<circle class="t-b" cx="32" cy="33" r="5.5"/>',
  '<circle class="t-c" cx="36" cy="28.5" r="2.6"/><circle class="t-c" cx="28.2" cy="37" r="1.2"/>',
]);

add('bone', 'cartoon bone', [
  '<g transform="translate(32 32) rotate(-35)">',
  '<path class="t-b" d="M-13.6,-5.5H13.6A8.5,8.5 0 1 1 27.5,0A8.5,8.5 0 1 1 13.6,5.5H-13.6A8.5,8.5 0 1 1 -27.5,0A8.5,8.5 0 1 1 -13.6,-5.5Z"/>',
  '<path class="t-a" transform="translate(-.6 -1.8)" d="M-13.6,-5.5H13.6A8.5,8.5 0 1 1 27.5,0A8.5,8.5 0 1 1 13.6,5.5H-13.6A8.5,8.5 0 1 1 -27.5,0A8.5,8.5 0 1 1 -13.6,-5.5Z"/>',
  '<rect class="t-c" x="-12" y="-5.2" width="18" height="2.3" rx="1.15"/>',
  '<ellipse class="t-c" cx="-25" cy="-11" rx="3" ry="1.8" transform="rotate(-30 -25 -11)"/>',
  '<ellipse class="t-c" cx="20" cy="-12.5" rx="2.6" ry="1.6" transform="rotate(20 20 -12.5)"/>',
  '</g>',
]);

add('flexed-arm', 'flexed arm showing a bicep', [
  '<path class="ln" stroke-width="2.4" d="M11,20L8,15M19,16L18.5,10.5M27,18L29,13"/>',
  '<path class="t-a" d="M2,62V40C6,30 14,24 24,23C32,22 37,26 39.5,30.5L38.5,26H35A2.5,2.5 0 0 1 35,21A2.5,2.5 0 0 1 35,16A2.5,2.5 0 0 1 35,11A2.5,2.5 0 0 1 35,6C36,3 40,1.5 45,1.5C53,1.5 58,6 58,13C58,24 62,36 60,46C59,56 54,61 46,62Z"/>',
  '<path class="t-b" d="M58,13C58,24 62,36 60,46C59,56 54,61 46,62H2V56C20,58 40,57 48,54C54,51 55,42 54,32C53.5,26 53,19 54.5,13.5Z"/>',
  '<path class="t-b" d="M2,40C7,40 11,48 11,62H2Z"/>',
  '<path class="t-c" d="M10,34C14,28 19,26 25,26C21,28 17.5,31 15,35.5C13,36 11,35.5 10,34Z"/>',
  '<path class="t-c" d="M39,6C41,4 44,3.5 47,3.8C44,5 42,6.5 41,8.5C40,8.5 39,7.5 39,6Z"/>',
  '<path class="ln" stroke-width="2" d="M35,21H40M35,16H40M35,11H39.5"/>',
  '<path class="ln" stroke-width="2.2" d="M38.5,26C43,25.5 47,22 48,17C48.5,14 47,11.5 44.5,11"/>',
  '<path class="ln" stroke-width="2.2" d="M40,31C42,33.5 45,33.5 47,32"/>',
]);

add('water-bottle', 'sports water bottle with droplets', [
  '<rect class="t-a" x="28.5" y="0.5" width="7" height="5" rx="1.5"/>',
  '<rect class="t-b" x="23" y="3.5" width="18" height="9" rx="2.5"/>',
  '<rect class="t-a" x="21" y="11" width="22" height="4.5" rx="1"/>',
  '<path class="t-a" d="M18,15H46C49,15 51,17.5 51,21V30C51,33 49,35 49,38C49,41 51,43 51,46V57C51,60.5 48.5,63 45,63H19C15.5,63 13,60.5 13,57V46C13,43 15,41 15,38C15,35 13,33 13,30V21C13,17.5 15,15 18,15Z"/>',
  '<path class="t-b" d="M44,15H46C49,15 51,17.5 51,21V30C51,33 49,35 49,38C49,41 51,43 51,46V57C51,60.5 48.5,63 45,63H40C43,62 45,60 45,57V46C45,43 43,41 43,38C43,35 45,33 45,30V21C45,18 44.5,16.5 44,15Z"/>',
  '<rect class="t-b" x="13" y="44" width="38" height="11"/>',
  '<rect class="t-c" x="17" y="20" width="3" height="18" rx="1.5"/>',
  '<path class="ln" d="M24,48.5H40"/>',
  '<path class="t-c" d="M58,16C60,19.5 62,21.8 62,24.5A4,4 0 0 1 54,24.5C54,21.8 56,19.5 58,16Z"/>',
  '<path class="t-c" d="M6,40C7.6,42.8 9.2,44.6 9.2,46.8A3.2,3.2 0 0 1 2.8,46.8C2.8,44.6 4.4,42.8 6,40Z"/>',
]);

add('pillow', 'fluffy pillow with a moon and zzz', [
  '<path class="t-c" d="M15,3A9,9 0 1 0 23,17A7,7 0 1 1 15,3Z"/>',
  '<path class="ln" stroke-width="2.4" d="M31,15H36L31,20H36M39,8.5H46L39,15.5H46M49,2H58L49,11H58"/>',
  '<g transform="rotate(-4 32 42)">',
  '<path class="t-a" d="M4,25Q5,23.5 7,24C20,28.5 44,28.5 57,24Q59,23.5 60,25C56,35 56,48 60,58Q59,60.5 57,60C44,55.5 20,55.5 7,60Q5,60.5 4,58C8,48 8,35 4,25Z"/>',
  '<path class="t-b" d="M60,58Q59,60.5 57,60C44,55.5 20,55.5 7,60Q5,60.5 4,58C5,56 5.8,54 6.4,52C20,50 42,50 54.5,50C55,53 57.5,56 60,58Z"/>',
  '<path class="t-b" d="M60,25C56,35 56,48 60,58C57.5,56 55.5,53.5 54.5,50C53.5,42 53.5,34 55.5,28C57,27 58.5,26 60,25Z"/>',
  '<path class="t-c" d="M11,31C19,30 29,30 37,30.5C29,32 20,33.5 12,36.5C10.5,35 10.3,33 11,31Z"/>',
  '<path class="ln" d="M8.5,28.5C10.5,29.5 11.5,31.5 11.5,33.5M55.5,28.5C53.5,29.5 52.5,31.5 52.5,33.5"/>',
  '</g>',
]);

// ---------- feelings ----------
add('heart', 'glossy heart with sparkles', [
  '<path class="t-a" d="M32,59C19,49.5 4,38.5 4,23.5C4,13.5 11,6 20,6C25.5,6 29.5,9 32,13.5C34.5,9 38.5,6 44,6C53,6 60,13.5 60,23.5C60,38.5 45,49.5 32,59Z"/>',
  '<path class="t-b" d="M58.5,37C54,45 43,52.5 32,59C29,56.7 26,54.4 23,52C35,51 51,45.5 58.5,37Z"/>',
  '<path class="t-c" d="M10,20C10.5,14.5 14.5,11 19.5,11C17,13 15,16.5 15,21C13.5,21.5 11,21.5 10,20Z"/>',
  '<circle class="t-c" cx="12.2" cy="25.3" r="1.9"/>',
  spark(55, 52, 5), spark(8, 50, 3.5),
]);

const shakeL = '<g transform="rotate(-10 32 38)">', shakeR = '<g transform="rotate(10 32 38)">';
add('handshake', 'two hands shaking with a heart', [
  shakeL,
  '<rect class="t-a" x="-8" y="26" width="20" height="24" rx="2"/>',
  '<rect class="t-c" x="10" y="24.5" width="5.5" height="27" rx="2"/>',
  '<path class="t-b" d="M15,26C21,24.5 27,24 32,24.5L45,27C48,28 49,31 48,34L47.5,46.5A2.4,2.4 0 0 1 43,47.8A2.4,2.4 0 0 1 38.5,48A2.4,2.4 0 0 1 34,47.5L15,48Z"/>',
  '</g>',
  shakeR,
  '<rect class="t-b" x="52.5" y="26" width="20" height="24" rx="2"/>',
  '<rect class="t-c" x="48.5" y="24.5" width="5.5" height="27" rx="2"/>',
  '<path class="t-a" d="M49,26C44,24.5 39,24.5 34,25.5H32V47H43C46,47 48,46.5 49,46Z"/>',
  '<rect class="t-a" x="24" y="25.2" width="14" height="5.6" rx="2.8"/><rect class="t-a" x="22.5" y="30.6" width="15.5" height="5.6" rx="2.8"/><rect class="t-a" x="23" y="36" width="15" height="5.6" rx="2.8"/><rect class="t-a" x="25" y="41.4" width="13" height="5.6" rx="2.8"/>',
  '<path class="ln" stroke-width="1.8" d="M26,30.7H33M24.8,36.1H33M25.6,41.5H33"/>',
  '<rect class="t-c" x="38" y="27.5" width="8" height="2.2" rx="1.1"/>',
  '</g>',
  shakeL,
  '<path class="t-b" d="M22,27.5C26,21 34,19.5 40,20.3C43.5,20.8 43.5,25.3 40.5,26.3C36,27.3 31,28.3 27,31Z"/>',
  '<ellipse class="t-c" cx="39.5" cy="22.6" rx="2" ry="1.3"/>',
  '</g>',
  `<g transform="translate(32 11) scale(6.5)"><path class="t-a" d="${HEART}"/></g>`,
  spark(16, 13, 3.5), spark(49, 12, 3),
]);

add('smiley', 'grinning smiley face', [
  '<circle class="t-a" cx="32" cy="32" r="28"/>',
  '<path class="t-b" fill-rule="evenodd" d="M4,32a28,28 0 1 0 56,0a28,28 0 1 0 -56,0ZM5.5,30.5a25.5,25.5 0 1 0 51,0a25.5,25.5 0 1 0 -51,0Z"/>',
  '<ellipse class="t-c" cx="18" cy="16" rx="6" ry="3" transform="rotate(-38 18 16)"/>',
  '<ellipse class="t-b" cx="22.5" cy="25" rx="3.4" ry="5"/><ellipse class="t-b" cx="41.5" cy="25" rx="3.4" ry="5"/>',
  '<circle class="t-c" cx="23.5" cy="23" r="1.3"/><circle class="t-c" cx="42.5" cy="23" r="1.3"/>',
  '<ellipse class="t-c" cx="14" cy="36" rx="4" ry="2.4"/><ellipse class="t-c" cx="50" cy="36" rx="4" ry="2.4"/>',
  '<path class="t-b" d="M18,36Q32,40 46,36Q44,51 32,51Q20,51 18,36Z"/>',
  '<path class="t-c" d="M19.5,38Q32,41.5 44.5,38L44,41Q32,44 20,41Z"/>',
]);

fs.writeFileSync(OUT, JSON.stringify(items, null, 1));
console.log(items.length, 'items; longest', Math.max(...items.map(i => i.svg.length)));
