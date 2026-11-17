const LatinReplacements = new Map([
  ['æ', 'ae'],
  ['œ', 'oe'],
  ['ß', 'ss'],
  ['ø', 'o'],
  ['ł', 'l'],
  ['đ', 'd'],
  ['ð', 'd'],
  ['þ', 'th'],
  ['ħ', 'h'],
  ['ı', 'i'],
  ['ŋ', 'n'],
  ['ƒ', 'f'],
  ['ⱳ', 'w'],
  ['ᶍ', 'x'],
  ['ᶆ', 'm'],
  ['ƚ', 'l'],
  ['ɇ', 'e'],
  ['ᵽ', 'p'],
  ['ɐ', 'a'],
  ['ǝ', 'e'],
  ['ȡ', 'd'],
]);

export default function parseSearchTokens(value: string): ReadonlyArray<string> {
  return (
    value
      .normalize('NFC')
      .toLowerCase()
      .replaceAll(/\p{Script=Latin}\p{M}*/gu, (value) =>
        Array.from(
          value.normalize('NFKD').toLowerCase().replaceAll(/\p{M}/gu, ''),
          (character) => LatinReplacements.get(character) ?? character,
        ).join(''),
      )
      .normalize('NFC')
      .replaceAll(/["'’‘]/gu, '')
      .match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d]*|[&+]/gu) || []
  );
}
