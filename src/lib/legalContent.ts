// Shim so that reference/oldPage/privacyContent.ts can import `LegalSection`
// from `@/lib/legalContent` (the original path it expects).
// The actual content used by the completion-page mockup is imported from
// `@reference/oldPage/legalContent` and `@reference/oldPage/privacyContent`.

export type LegalSection = {
  id: string;
  title: string;
  body: string[];
};
