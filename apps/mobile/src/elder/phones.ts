/** Last digits of a phone number, enough to tell two numbers apart however they were typed (+55, (11), spaces…). */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-8);
}

/** Keeps only what `tel:` accepts. */
export function dialable(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}
