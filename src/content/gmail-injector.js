/**
 * Gmail Injector - Injects Asana button into Gmail toolbar and individual messages
 * Uses MutationObserver to detect email view changes
 */

const GmailInjector = {
  observer: null,
  injectedButtons: new WeakSet(),

  /**
   * Initialize the injector
   */
  init() {
    // Wait for Gmail to load
    this.waitForGmail().then(() => {
      this.setupObserver();
      this.injectButtons();
    });
  },

  /**
   * Wait for Gmail UI to be ready
   */
  waitForGmail() {
    return new Promise(resolve => {
      const check = () => {
        // Check for Gmail's main container
        if (document.querySelector('.nH') || document.querySelector('[role="main"]')) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  },

  /**
   * Set up MutationObserver to detect email view changes
   */
  setupObserver() {
    this.observer = new MutationObserver(mutations => {
      // Debounce the injection
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.injectButtons();
      }, 200);
    });

    // Observe the main Gmail container
    const mainContainer = document.querySelector('.nH') || document.body;
    this.observer.observe(mainContainer, {
      childList: true,
      subtree: true,
    });
  },

  /**
   * Find and inject Asana buttons into email toolbars and individual messages
   */
  injectButtons() {
    // Inject into main toolbar
    this.injectToolbarButtons();

    // Inject into individual messages in thread
    this.injectMessageButtons();
  },

  /**
   * Inject buttons into main email toolbar
   */
  injectToolbarButtons() {
    const toolbarSelectors = [
      '.ade', // Email action bar
      '.G-atb', // Alternate toolbar
      '[gh="mtb"]', // Message toolbar
    ];

    for (const selector of toolbarSelectors) {
      const toolbars = document.querySelectorAll(selector);

      toolbars.forEach(toolbar => {
        if (this.injectedButtons.has(toolbar)) return;
        if (toolbar.querySelector('.asana-gmail-btn')) return;

        const insertPoint = toolbar.querySelector('.T-I') || toolbar.firstChild;

        if (insertPoint) {
          const button = this.createAsanaButton(null); // null = extract from whole view
          insertPoint.parentNode.insertBefore(button, insertPoint);
          this.injectedButtons.add(toolbar);
        }
      });
    }
  },

  /**
   * Inject buttons into individual messages in a thread
   */
  injectMessageButtons() {
    // Strategy 1: Find expanded messages by their body container
    // Each expanded message in a thread has a .gs container
    const expandedMessages = document.querySelectorAll('.gs');

    expandedMessages.forEach(messageContainer => {
      if (this.injectedButtons.has(messageContainer)) return;
      if (messageContainer.querySelector('.asana-gmail-btn-mini')) return;

      // Look for the header area of this message
      const headerArea = messageContainer.querySelector('.gE.iv.gt') ||
                         messageContainer.querySelector('.gH') ||
                         messageContainer.querySelector('.h7');

      if (!headerArea) return;

      // Find action buttons area (the icons on the right: reply, more, etc.)
      // These are usually in a container with specific classes
      let actionsArea = headerArea.querySelector('.bGI') ||
                        headerArea.querySelector('.adf.ads') ||
                        messageContainer.querySelector('.amn') ||
                        messageContainer.querySelector('[data-tooltip="More"]')?.parentElement ||
                        messageContainer.querySelector('[aria-label="More"]')?.parentElement;

      // Fallback: find the date/time element and insert after it
      if (!actionsArea) {
        const dateElement = headerArea.querySelector('.g3') ||
                            headerArea.querySelector('.gH .gK');
        if (dateElement) {
          actionsArea = dateElement.parentElement;
        }
      }

      if (actionsArea) {
        const button = this.createMiniAsanaButton(messageContainer);
        actionsArea.appendChild(button);
        this.injectedButtons.add(messageContainer);
      }
    });

    // Strategy 2: Find message containers by data-message-id
    const messageContainers = document.querySelectorAll('[data-message-id]');

    messageContainers.forEach(messageContainer => {
      if (this.injectedButtons.has(messageContainer)) return;
      if (messageContainer.querySelector('.asana-gmail-btn-mini')) return;

      // Find header or action area
      const actionsArea = messageContainer.querySelector('.bGI') ||
                          messageContainer.querySelector('.adf.ads') ||
                          messageContainer.querySelector('[data-tooltip="More"]')?.parentElement;

      if (actionsArea) {
        const button = this.createMiniAsanaButton(messageContainer);
        actionsArea.appendChild(button);
        this.injectedButtons.add(messageContainer);
      }
    });

    // Strategy 3: Target the sender row in each message
    // The sender info row often has class .gD for sender and actions nearby
    const senderElements = document.querySelectorAll('.gE .gD, .gH .gD');

    senderElements.forEach(senderEl => {
      const messageContainer = senderEl.closest('.gs') ||
                               senderEl.closest('[data-message-id]') ||
                               senderEl.closest('.gE');

      if (!messageContainer) return;
      if (this.injectedButtons.has(messageContainer)) return;
      if (messageContainer.querySelector('.asana-gmail-btn-mini')) return;

      // Find the row containing the sender
      const senderRow = senderEl.closest('.gH') || senderEl.closest('.h7') || senderEl.parentElement;

      if (senderRow) {
        const button = this.createMiniAsanaButton(messageContainer);
        // Insert at the end of the sender row
        senderRow.appendChild(button);
        this.injectedButtons.add(messageContainer);
      }
    });
  },

  /**
   * Helper for i18n translations
   */
  t(key, substitutions) {
    return window.i18n ? window.i18n.t(key, substitutions) : key;
  },

  /**
   * Create the main Asana button element
   */
  createAsanaButton(messageContainer) {
    const button = document.createElement('div');
    button.className = 'asana-gmail-btn T-I J-J5-Ji';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('data-tooltip', this.t('createAsanaTask'));
    button.setAttribute('aria-label', this.t('createAsanaTask'));

    button.innerHTML = `
      <span class="asana-gmail-btn-icon"></span>
      <span class="asana-gmail-btn-text">Asana</span>
    `;

    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.handleButtonClick(messageContainer);
    });

    button.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleButtonClick(messageContainer);
      }
    });

    return button;
  },

  /**
   * Create a mini Asana button for individual messages
   */
  createMiniAsanaButton(messageContainer) {
    const button = document.createElement('div');
    button.className = 'asana-gmail-btn-mini';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('data-tooltip', this.t('createAsanaTask'));
    button.setAttribute('aria-label', this.t('createAsanaTask'));
    button.title = this.t('createAsanaTask');

    // Simple Asana logo icon
    button.innerHTML = `<span class="asana-mini-icon">A</span>`;

    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.handleButtonClick(messageContainer);
    });

    button.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleButtonClick(messageContainer);
      }
    });

    return button;
  },

  /**
   * Handle Asana button click
   */
  async handleButtonClick(messageContainer = null) {
    // Load preferences and initialize i18n with language preference
    const prefs = await chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' }) || {};
    if (window.i18n && window.i18n.init) {
      await window.i18n.init(prefs.language || 'auto');
    }

    // Check Asana session first
    const session = await chrome.runtime.sendMessage({ type: 'CHECK_SESSION' });

    if (!session.loggedIn) {
      if (session.needsSetup) {
        this.showNotification(this.t('errorNeedsToken'), 'error');
      } else {
        this.showNotification(this.t('errorNotLoggedIn'), 'error');
      }
      return;
    }

    // Extract email data from specific message or whole view
    const emailData = messageContainer
      ? window.EmailExtractor.extractFromMessage(messageContainer)
      : window.EmailExtractor.extractEmailData();

    if (!emailData.subject && !emailData.body) {
      this.showNotification(this.t('errorExtractEmail'), 'error');
      return;
    }

    // Open project selector modal
    window.ProjectSelector.open(emailData, session.user);
  },

  /**
   * Show a notification to the user
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `asana-notification asana-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('asana-notification-visible');
    });

    // Remove after 4 seconds
    setTimeout(() => {
      notification.classList.remove('asana-notification-visible');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  },
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GmailInjector.init());
} else {
  GmailInjector.init();
}

// Make available globally
window.GmailInjector = GmailInjector;
