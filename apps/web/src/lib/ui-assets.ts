export const JOSE_TITLE_IMAGE = "/assets/ui/branding/jose-game-title.png";

export const NAVIGATION_IMAGES: Readonly<Record<string, string>> = {
  "/learn": "/assets/ui/navigation/learn.png",
  "/practice": "/assets/ui/navigation/practice.png",
  "/bookmarks": "/assets/ui/navigation/bookmarks.png",
  "/profile": "/assets/ui/navigation/profile.png",
  "/profile/preferences": "/assets/ui/navigation/settings.png",
};

export const BOOKMARK_ACTION_IMAGES = {
  open: "/assets/ui/actions/open.png",
  remove: "/assets/ui/actions/remove.png",
} as const;

export const MODULE_BOOK_IMAGES = [
  "/assets/ui/books/01-rizal-law.png",
  "/assets/ui/books/02-hero-then-now.png",
  "/assets/ui/books/03-19th-century.png",
  "/assets/ui/books/04-family-childhood.png",
  "/assets/ui/books/05-travels-abroad.png",
  "/assets/ui/books/06-noli-me-tangere.png",
  "/assets/ui/books/07-martyrdom.png",
  "/assets/ui/books/08-la-solidaridad.png",
  "/assets/ui/books/09-dapitan-exile.png",
  "/assets/ui/books/10-false-trial.png",
  "/assets/ui/books/11-retraction.png",
  "/assets/ui/books/12-eternal-legacy.png",
  "/assets/ui/books/13-medicine.png",
  "/assets/ui/books/14-education.png",
  "/assets/ui/books/15-science.png",
  "/assets/ui/books/16-printing-reform.png",
] as const;

export function moduleBookImage(index: number) {
  return MODULE_BOOK_IMAGES[index % MODULE_BOOK_IMAGES.length]!;
}
