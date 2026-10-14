/**
 * Every material colour in the classroom scene lives here (hex is fine in this file only).
 * Why: the room is deliberately muted — the brand pulse yellow is the ONLY bright colour, so it
 * always reads as "this is what ClassIQ does". Red pen marks only the students who need help.
 */
export const palette = {
  // Brand tokens (mirrors [data-theme='landing'] in app/globals.css)
  board: '#22382F',
  board2: '#2C463B',
  wall: '#DDE9E1',
  chalk: '#FBFBF7',
  chalkDim: '#C9D6CF',
  pulse: '#FDE047',
  uniform: '#1F2A55',
  redpen: '#B3261E',

  // Stage
  background: '#D6E5DC',
  backdropInner: '#EEF3EC',
  backgroundDusk: '#141B38',
  backdropDuskInner: '#2A3563',
  plinthTop: '#EFEDE4',
  plinthSide: '#2C463B',
  plinthSideDark: '#22382F',

  // Room shell
  wallUpper: '#DDE9E1',
  wallLower: '#467A63',
  wallStripe: '#2C463B',
  wallCap: '#F4F2EA',
  skirting: '#2F5646',
  floorTile: '#CFC6B4',
  floorTileAlt: '#C4BBA8',
  floorGrout: '#A99F8C',
  windowFrame: '#5C7F6E',
  windowBar: '#2B3A35',
  sill: '#E9E5D8',

  // Wood + metal
  wood: '#A2714A',
  woodLight: '#B98758',
  woodDark: '#6C4529',
  benchFrame: '#3A4A44',
  metal: '#4A5150',
  steel: '#B9C0C2',

  // Fans + lights
  fanBody: '#EEE9DC',
  fanBlade: '#E6DECB',
  fanTrim: '#B9B2A2',
  tubeFixture: '#F2F2EE',
  tubeOff: '#E8ECEE',
  tubeOn: '#FFF4DC',

  // People
  shirt: '#F5F5EF',
  sleeve: '#F5F5EF',
  trousers: '#1F2A55',
  pinafore: '#1F2A55',
  shoe: '#1C1C1E',
  ribbon: '#FBFBF7',
  eye: '#1A1414',
  mouth: '#5A2A24',
  cheek: '#D88A78',
  skinTones: ['#C68E5E', '#A86F43', '#8E5A35', '#D7A475', '#B97D4E', '#7A4B2C', '#E0B08A', '#9C6640'],
  hairTones: ['#2A1D17', '#3B2A20', '#1E1612', '#4A3426', '#33241C'],
  saree: '#2F6A68',
  sareeBorder: '#E9DFC6',
  sareePallu: '#255654',
  blouse: '#8C3B46',
  teacherSkin: '#A9693E',
  teacherHair: '#17110F',
  glasses: '#2B2B2E',
  bindi: '#C2362B',

  // Desk props
  deviceCase: '#262B2F',
  deviceLid: '#3B4247',
  micBody: '#26292C',
  cable: '#202326',
  register: '#1F2A55',
  notebook: '#E7E2D3',
  notebookCover: '#7C8F86',
  clockFace: '#F7F5EE',
  clockRim: '#2B3A35',
  notice: '#EFE7D2',
  noticeBoard: '#8B6A48',
  plant: '#4E7D52',
  pot: '#B0603E',

  // Mastery (chapter 5). Why: yellow means "ClassIQ acting", so understood desks stay plain wood and
  // the students who need help get the teacher's red pen: a tinted desk top and a chalk-red circle.
  masteryHigh: '#B98758',
  masteryLow: '#C0574A',

  // Sky outside the windows
  skyMorningTop: '#F6E7C4',
  skyMorningBottom: '#FFF8E8',
  skyDuskTop: '#14204A',
  skyDuskBottom: '#C7774A',
  treeMorning: '#7FA48A',
  treeDusk: '#0E1530',

  // Lights
  sun: '#FFE1B0',
  /** The sun at the end of the 45-minute lesson: lower, warmer, heading for the dusk finale. */
  sunLate: '#FFC48A',
  ambientMorning: '#F3EBDD',
  hemiGround: '#B79E7E',
  duskInterior: '#FFC98F',
  duskGround: '#8A6A4A',
} as const;
