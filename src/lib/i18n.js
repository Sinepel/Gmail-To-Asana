/**
 * Internationalization (i18n) helper
 * Supports custom language preference with fallback to browser locale
 */

const i18n = {
  messages: {},
  currentLanguage: 'en',
  initialized: false,

  /**
   * Initialize i18n with language preference
   * @param {string} languagePref - 'auto', 'fr', or 'en'
   */
  async init(languagePref = 'auto') {
    // Determine which language to use
    if (languagePref === 'auto') {
      // Use browser's language
      const browserLang = chrome.i18n.getUILanguage().split('-')[0];
      this.currentLanguage = ['fr', 'en'].includes(browserLang) ? browserLang : 'en';
    } else {
      this.currentLanguage = languagePref;
    }

    // Load messages for current language
    try {
      const url = chrome.runtime.getURL(`_locales/${this.currentLanguage}/messages.json`);
      const response = await fetch(url);
      this.messages = await response.json();
    } catch (e) {
      console.warn(`i18n: Failed to load messages for ${this.currentLanguage}, falling back to Chrome API`);
      this.messages = {};
    }

    this.initialized = true;
  },

  /**
   * Get a localized message
   * @param {string} key - Message key from messages.json
   * @param {string|string[]} substitutions - Optional substitutions for placeholders
   * @returns {string} Localized message or key if not found
   */
  t(key, substitutions) {
    // If we have custom loaded messages, use them
    if (this.messages[key]) {
      let message = this.messages[key].message;

      // Handle substitutions
      if (substitutions) {
        const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
        subs.forEach((sub, index) => {
          // Replace $1, $2, etc. with substitution values
          message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
          // Also handle placeholders like $count$
          const placeholders = this.messages[key].placeholders;
          if (placeholders) {
            Object.entries(placeholders).forEach(([name, config]) => {
              if (config.content === `$${index + 1}`) {
                message = message.replace(new RegExp(`\\$${name}\\$`, 'gi'), sub);
              }
            });
          }
        });
      }

      return message;
    }

    // Fallback to Chrome's i18n API
    try {
      const message = chrome.i18n.getMessage(key, substitutions);
      return message || key;
    } catch (e) {
      console.warn(`i18n: Failed to get message for key "${key}"`, e);
      return key;
    }
  },

  /**
   * Get the current UI language
   * @returns {string} Language code (e.g., 'en', 'fr')
   */
  getLanguage() {
    return this.currentLanguage;
  },

  /**
   * Check if current language is French
   * @returns {boolean}
   */
  isFrench() {
    return this.currentLanguage === 'fr';
  },
};

// Make available globally
window.i18n = i18n;
