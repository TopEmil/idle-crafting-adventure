/**
 * Keep scroll when rebuilding the same sheet (e.g. buying several talents).
 * Reset to top when opening a different panel.
 */
export function sheetScrollAfterRebuild(
  previousPanel: string | null,
  nextPanel: string,
  previousScrollTop: number,
): number {
  return previousPanel === nextPanel ? previousScrollTop : 0;
}
