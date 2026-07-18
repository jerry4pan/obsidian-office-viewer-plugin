export const MIN_OOXML_SLIDE_ID = 256;
export const MAX_OOXML_SLIDE_ID = 0x7fff_ffff;

export function isOoxmlSlideId(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= MIN_OOXML_SLIDE_ID &&
    value <= MAX_OOXML_SLIDE_ID
  );
}
