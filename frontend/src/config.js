export const getApiBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // Lokalne środowisko deweloperskie
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'http://127.0.0.1:5001';
    }
  }
  // Produkcja: bezpośrednie połączenie z Cloud Run
  return 'https://ai-english-buddy-backend-665075210565.europe-west1.run.app';
};

export const API_BASE_URL = getApiBaseUrl();

