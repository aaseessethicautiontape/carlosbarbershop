/**
 * Static facts that are not in the database. Taken from the design canvas; every item that still
 * needs the owner's sign-off is listed in TODO-LIVE.md. Do NOT add reviews that are not real.
 */
export const site = {
  name: "Carlo's Barbershop",
  since: 2015, // from canvas: confirm with owner
  address: { line1: "331 Bayfield St", city: "Barrie", region: "ON", postal: "L4M 3C2" },
  phoneDisplay: "705-721-4400",
  phoneHref: "tel:+17057214400",
  email: "Carlodabarber@gmail.com",
  instagram: "https://www.instagram.com/carlosbarbershop705",
  facebook: "https://www.facebook.com/780497408713154",
  googleMapsDirections: "https://www.google.com/maps/dir/?api=1&destination=331+Bayfield+St+Barrie+ON",
  googleMapsReviews: "https://www.google.com/maps/search/?api=1&query=Carlo%27s+Barber+Shop+Barrie",
  mapEmbed: "https://www.google.com/maps?q=331+Bayfield+St,+Barrie,+ON+L4M+3C2&output=embed",
  rating: { score: "4.4", count: 313 }, // from canvas: verify against Google before launch
  /** Real Google review quotes supplied by the owner in the design canvas. Verify wording + attribution. */
  reviews: [
    { quote: "Received the exact haircut I wanted with a nice neck shave for a great price!", by: "Google review" },
    { quote: "Great staff, great prices and service.", by: "Google review" },
    { quote: "I cannot recommend Estella enough, especially if you’re looking for someone who really knows their craft.", by: "Jay J. · Google review" },
  ],
  ticker: ["Walk-ins welcome", "Book online in 30 seconds", "Hot towel shaves", "331 Bayfield St", "Since 2015"],
} as const;

export const addressOneLine = `${site.address.line1}, ${site.address.city}, ${site.address.region} ${site.address.postal}`;
