// Source - https://stackoverflow.com/a/50376498
// Posted by Gil Epshtain, modified by community. See post 'Timeline' for change history
// Retrieved 2026-04-19, License - CC BY-SA 4.0

export function isNumber(value?: string | number): boolean {
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}
