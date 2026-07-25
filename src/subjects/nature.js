// Word pools for the Nature category. Data, not logic.
//
// Loaded LAZILY by src/subjects.js and never imported statically, which is the whole
// reason the catalog exists as a separate names-only module: the picker needs 600
// names, and a player needs the one category they chose. Keep it that way — a static
// import of this file anywhere in src/ would pull every word into the precached shell.
//
// Contract, enforced by tests/unit/content.test.js: 100+ words per subject, bare
// uppercase A-Z, 3-12 letters, no duplicates, and enough in every length bucket for
// both board presets to deal from. Short words are the scarce ones; write those first.
/** @type {Record<string,string>} */
export const WORDS = {
  'nature/birds': 'OWL,JAY,HEN,EMU,AUK,TIT,MOA,KEA,DOVE,CROW,SWAN,HAWK,LOON,WREN,IBIS,KIWI,TEAL,RHEA,COOT,LARK,ROOK,MYNA,NEST,EGGS,BEAK,WING,GULL,SKUA,EAGLE,ROBIN,FINCH,HERON,CRANE,GOOSE,QUAIL,SNIPE,EGRET,RAVEN,STORK,MACAW,ROOST,PREEN,TALON,PLUME,BROOD,CHICK,FALCON,TOUCAN,PARROT,CONDOR,TURKEY,CANARY,ORIOLE,MARTIN,THRUSH,GROUSE,PIGEON,PUFFIN,AVOCET,PLOVER,CUCKOO,AVIARY,PELICAN,PENGUIN,OSTRICH,VULTURE,BUZZARD,SEAGULL,SPARROW,SWALLOW,WARBLER,BITTERN,KESTREL,FEATHER,PLUMAGE,PEACOCK,PHEASANT,FLAMINGO,STARLING,BLUEBIRD,WOODCOCK,NUTHATCH,HORNBILL,LOVEBIRD,SONGBIRD,WILDFOWL,BIRDBATH,WINGSPAN,CORMORANT,GOLDFINCH,ALBATROSS,BLACKBIRD,SANDPIPER,NIGHTHAWK,CHICKADEE,BOWERBIRD,WATERFOWL,MIGRATION,KINGFISHER,WOODPECKER,ROADRUNNER,MEADOWLARK,HUMMINGBIRD,NIGHTINGALE,MOCKINGBIRD',
};
