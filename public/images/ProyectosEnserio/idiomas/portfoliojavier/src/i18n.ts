import i18n from 'i18next';
import { initReactI18next } from "react-i18next";
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import moment from 'moment';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es',
    debug: import.meta.env.MODE !== 'production',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'i18n-language',
      caches: ['localStorage']
    },
  });

i18n.on('languageChanged', (lang: string) => {
  // Avoid "en-XX" or "es-XX"
  if (lang.length > 2) {
    i18n.changeLanguage(lang.substring(0, 2));
  } else {
    // Here you would update the user's preferred language in your backend
    // if you have user authentication
    // Example: await updateUserLanguage(lang);
    
    moment.locale(lang);
  }
});

export default i18n;