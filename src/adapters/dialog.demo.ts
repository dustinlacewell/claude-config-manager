/**
 * Browser-mode replacement for dialog.ts. No native folder picker exists
 * in a sandboxed iframe, so "Add project" in the demo can't do anything
 * meaningful. Resolve to null and let the caller treat it as "cancelled".
 */

export const pickDirectory = async (): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    window.alert(
      'Folder picker is disabled in the demo. Install CCM on your machine to add your own projects.',
    )
  }
  return null
}
