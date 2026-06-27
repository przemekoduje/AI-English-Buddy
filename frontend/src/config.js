// Konfiguracja adresu URL API backendu.
// W środowisku produkcyjnym (np. na Vercel) adres zostanie pobrany ze zmiennej REACT_APP_API_URL.
// W środowisku lokalnym adres domyślny to http://127.0.0.1:5001.
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5001';
