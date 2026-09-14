export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    // Spell out '+' and '#' before they'd otherwise collapse into the same
    // separator as any other punctuation — without this, "C", "C++", and
    // "C#" all slugify to "c" and collide (see issue #21).
    .replace(/\+/g, '-plus-')
    .replace(/#/g, '-sharp-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
