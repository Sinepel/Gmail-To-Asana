/**
 * Email Extractor - Extracts email data from Gmail DOM
 */

const EmailExtractor = {
  /**
   * Extract the email subject from the current email view
   */
  getSubject() {
    // Try different selectors for email subject
    const selectors = [
      'h2[data-thread-perm-id]',
      '.hP',
      '.ha h2',
      '[data-legacy-thread-id] h2',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return '';
  },

  /**
   * Extract the email body content
   */
  getBody() {
    // Try different selectors for email body
    const selectors = [
      '.a3s.aiL', // Standard email body
      '.gs .ii.gt', // Alternative body container
      '[data-message-id] .a3s', // Message with ID
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Get the last (most recent) email body in thread
        const lastBody = elements[elements.length - 1];
        return lastBody.innerText?.trim() || '';
      }
    }

    return '';
  },

  /**
   * Extract attachment information from the current email
   */
  getAttachments() {
    const attachments = [];

    // Gmail attachment containers
    const attachmentContainers = document.querySelectorAll('.aZo, .aQH');

    attachmentContainers.forEach(container => {
      // Get attachment name
      const nameElement = container.querySelector('.aV3, .aQA span');
      const name = nameElement?.textContent?.trim() || 'attachment';

      // Get download URL - look for download link
      const downloadLink = container.querySelector('a[download], a[href*="download"]');
      let url = downloadLink?.href;

      // Alternative: look for the attachment ID in data attributes
      if (!url) {
        const attachmentId = container.getAttribute('data-id') ||
                            container.querySelector('[data-id]')?.getAttribute('data-id');
        if (attachmentId) {
          // Gmail attachment download URL pattern
          url = `https://mail.google.com/mail/u/0/?ui=2&ik=&attid=${attachmentId}&disp=safe`;
        }
      }

      // Get file size if available
      const sizeElement = container.querySelector('.aQBs, .SaH2Ve');
      const size = sizeElement?.textContent?.trim() || '';

      if (name) {
        attachments.push({
          name,
          url,
          size,
          id: `attachment-${attachments.length}`,
        });
      }
    });

    // Also check for inline attachments in a different format
    const inlineAttachments = document.querySelectorAll('.aQw');
    inlineAttachments.forEach(container => {
      const nameElement = container.querySelector('.aQA');
      const name = nameElement?.textContent?.trim();

      if (name && !attachments.find(a => a.name === name)) {
        const downloadBtn = container.querySelector('[data-tooltip*="Download"]');
        const url = downloadBtn?.closest('a')?.href;

        attachments.push({
          name,
          url,
          size: '',
          id: `attachment-${attachments.length}`,
        });
      }
    });

    return attachments;
  },

  /**
   * Get the sender email address
   */
  getSender() {
    const selectors = [
      '.gD', // Sender name/email element
      '[email]', // Element with email attribute
      '.go', // Alternative sender element
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.getAttribute('email') || element.textContent?.trim() || '';
      }
    }

    return '';
  },

  /**
   * Get the Gmail URL for the current email/thread
   */
  getEmailUrl() {
    // Gmail URL is in the address bar, but we can also construct it from thread ID
    const currentUrl = window.location.href;

    // If we're viewing an email, the URL contains the thread/message ID
    if (currentUrl.includes('#inbox/') || currentUrl.includes('#sent/') ||
        currentUrl.includes('#all/') || currentUrl.includes('#label/') ||
        currentUrl.includes('#search/')) {
      return currentUrl;
    }

    // Try to get thread ID from DOM
    const threadElement = document.querySelector('[data-thread-perm-id]') ||
                          document.querySelector('[data-legacy-thread-id]');

    if (threadElement) {
      const threadId = threadElement.getAttribute('data-thread-perm-id') ||
                       threadElement.getAttribute('data-legacy-thread-id');
      if (threadId) {
        return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
      }
    }

    return currentUrl;
  },

  /**
   * Get the message ID from a specific message container
   */
  getMessageIdFromMessage(container) {
    // Look for data-message-id attribute
    const messageId = container.getAttribute('data-message-id') ||
                      container.closest('[data-message-id]')?.getAttribute('data-message-id');

    if (messageId) {
      return messageId;
    }

    // Try legacy message ID
    const legacyId = container.getAttribute('data-legacy-message-id') ||
                     container.closest('[data-legacy-message-id]')?.getAttribute('data-legacy-message-id');

    return legacyId || '';
  },

  /**
   * Extract all email data at once
   */
  extractEmailData() {
    return {
      subject: this.getSubject(),
      body: this.getBody(),
      attachments: this.getAttachments(),
      sender: this.getSender(),
      emailUrl: this.getEmailUrl(),
      emlDownloadUrl: this.getEmlDownloadUrl(),
    };
  },

  /**
   * Extract email data from a specific message container in a thread
   */
  extractFromMessage(messageContainer) {
    // Get thread subject (shared across all messages)
    const subject = this.getSubject();

    // Get sender from this specific message
    const sender = this.getSenderFromMessage(messageContainer);

    // Get body from this specific message
    const body = this.getBodyFromMessage(messageContainer);

    // Get attachments from this specific message
    const attachments = this.getAttachmentsFromMessage(messageContainer);

    // Get the date of this message
    const date = this.getDateFromMessage(messageContainer);

    // Get email URL and message ID
    const emailUrl = this.getEmailUrl();
    const messageId = this.getMessageIdFromMessage(messageContainer);
    const emlDownloadUrl = this.getEmlDownloadUrlFromMessage(messageContainer);

    return {
      subject,
      body,
      attachments,
      sender,
      date,
      emailUrl,
      messageId,
      emlDownloadUrl,
    };
  },

  /**
   * Get sender from a specific message container
   */
  getSenderFromMessage(container) {
    const selectors = [
      '.gD', // Sender name/email element
      '[email]', // Element with email attribute
      '.go', // Alternative sender element
      '.qu', // Another sender format
    ];

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element) {
        const email = element.getAttribute('email');
        const name = element.getAttribute('name') || element.textContent?.trim();
        if (email) {
          return name ? `${name} <${email}>` : email;
        }
        return name || '';
      }
    }

    return '';
  },

  /**
   * Get body content from a specific message container
   */
  getBodyFromMessage(container) {
    const selectors = [
      '.a3s.aiL', // Standard email body
      '.ii.gt', // Alternative body container
      '.a3s', // Fallback body
    ];

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element?.innerText) {
        return element.innerText.trim();
      }
    }

    return '';
  },

  /**
   * Get attachments from a specific message container
   */
  getAttachmentsFromMessage(container) {
    const attachments = [];

    // Gmail attachment containers within this message
    const attachmentContainers = container.querySelectorAll('.aZo, .aQH, .aQw');

    attachmentContainers.forEach(attContainer => {
      // Get attachment name
      const nameElement = attContainer.querySelector('.aV3, .aQA span, .aQA');
      const name = nameElement?.textContent?.trim() || 'attachment';

      // Get download URL
      const downloadLink = attContainer.querySelector('a[download], a[href*="download"]');
      let url = downloadLink?.href;

      // Alternative: look for the attachment ID in data attributes
      if (!url) {
        const attachmentId = attContainer.getAttribute('data-id') ||
                            attContainer.querySelector('[data-id]')?.getAttribute('data-id');
        if (attachmentId) {
          url = `https://mail.google.com/mail/u/0/?ui=2&ik=&attid=${attachmentId}&disp=safe`;
        }
      }

      // Get file size if available
      const sizeElement = attContainer.querySelector('.aQBs, .SaH2Ve');
      const size = sizeElement?.textContent?.trim() || '';

      if (name && !attachments.find(a => a.name === name)) {
        attachments.push({
          name,
          url,
          size,
          id: `attachment-${attachments.length}`,
        });
      }
    });

    return attachments;
  },

  /**
   * Get date from a specific message container
   */
  getDateFromMessage(container) {
    const selectors = [
      '.g3', // Date element
      '[title]', // Element with title containing date
      '.gH .g3',
    ];

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element) {
        // Try title attribute first (usually has full date)
        const title = element.getAttribute('title');
        if (title) return title;
        // Fallback to text content
        if (element.textContent) return element.textContent.trim();
      }
    }

    return '';
  },

  /**
   * Get recipients (To field) from the email
   */
  getRecipients() {
    // Try to find the "to" field
    const selectors = [
      '.g2', // Recipients container
      '[data-hovercard-id]', // Recipient with hovercard
      '.gI span[email]', // Recipient email span
    ];

    const recipients = [];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const email = el.getAttribute('email');
        const name = el.getAttribute('name') || el.textContent?.trim();
        if (email && !recipients.find(r => r.email === email)) {
          recipients.push({ name, email });
        }
      });
    }

    return recipients;
  },

  /**
   * Get the HTML body of the email
   */
  getBodyHtml() {
    const selectors = [
      '.a3s.aiL', // Standard email body
      '.ii.gt', // Alternative body container
      '.a3s', // Fallback body
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const lastBody = elements[elements.length - 1];
        return lastBody.innerHTML || '';
      }
    }

    return '';
  },

  /**
   * Get the ik parameter from Gmail (required for downloads)
   * Tries multiple methods as Gmail stores this in different ways
   */
  getIkParameter() {
    // Method 1: Check window.GLOBALS array
    try {
      if (window.GLOBALS && Array.isArray(window.GLOBALS)) {
        // ik is usually at index 9 in GLOBALS
        const ik = window.GLOBALS[9];
        if (ik && typeof ik === 'string' && /^[a-f0-9]+$/i.test(ik)) {
          return ik;
        }
      }
    } catch (e) { /* ignore */ }

    // Method 2: Look in script tags for GLOBALS
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const content = script.textContent;
      if (content && content.includes('GLOBALS')) {
        // Try to find ik in GLOBALS array
        const match = content.match(/GLOBALS\s*=\s*\[(?:[^\]]*,){9}\s*["']([a-f0-9]+)["']/i);
        if (match) return match[1];

        // Alternative pattern
        const match2 = content.match(/["']ik["']\s*:\s*["']([a-f0-9]+)["']/i);
        if (match2) return match2[1];
      }
    }

    // Method 3: Look for ik in any data attribute or meta tag
    const metaIk = document.querySelector('meta[name="ik"]');
    if (metaIk) return metaIk.getAttribute('content');

    // Method 4: Extract from current URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const ikFromUrl = urlParams.get('ik');
    if (ikFromUrl) return ikFromUrl;

    // Method 5: Look in localStorage/sessionStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('ik')) {
          const val = localStorage.getItem(key);
          if (val && /^[a-f0-9]+$/i.test(val)) return val;
        }
      }
    } catch (e) { /* ignore */ }

    console.warn('Gmail ik parameter not found - EML download may not work');
    return '';
  },

  /**
   * Get the download URL for the EML file from Gmail
   * Gmail format: https://mail.google.com/mail/u/0/?ui=2&ik=XXXX&view=om&th=MESSAGE_ID
   */
  getEmlDownloadUrl() {
    // Get message ID from the current view
    const messageId = this.getMessageId();
    if (!messageId) {
      console.warn('No message ID found for EML download');
      return null;
    }

    // Get the ik parameter from Gmail (required for download)
    const ik = this.getIkParameter();

    // Construct download URL
    // view=om = original message (EML format)
    const url = `https://mail.google.com/mail/u/0/?ui=2&ik=${ik}&view=om&th=${messageId}`;
    console.log('EML download URL:', url);
    return url;
  },

  /**
   * Get the current message ID
   */
  getMessageId() {
    // Try to get from URL hash
    const hash = window.location.hash;
    const urlMatch = hash.match(/#(?:inbox|sent|all|label\/[^/]+|search\/[^/]+)\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Try to get from DOM
    const messageEl = document.querySelector('[data-message-id]');
    if (messageEl) {
      return messageEl.getAttribute('data-message-id');
    }

    // Try data-thread-perm-id
    const threadEl = document.querySelector('[data-thread-perm-id]');
    if (threadEl) {
      return threadEl.getAttribute('data-thread-perm-id');
    }

    // Try legacy thread ID
    const legacyEl = document.querySelector('[data-legacy-thread-id]');
    if (legacyEl) {
      return legacyEl.getAttribute('data-legacy-thread-id');
    }

    return null;
  },

  /**
   * Get EML download URL for a specific message in a thread
   */
  getEmlDownloadUrlFromMessage(container) {
    const messageId = this.getMessageIdFromMessage(container);
    if (!messageId) {
      console.warn('No message ID found for EML download from message');
      return null;
    }

    // Get the ik parameter
    const ik = this.getIkParameter();

    return `https://mail.google.com/mail/u/0/?ui=2&ik=${ik}&view=om&th=${messageId}`;
  },

  /**
   * Get all attachments from all messages in the thread
   * Returns an array of message objects, each containing sender, date, and attachments
   * Scans both expanded AND collapsed messages
   */
  getAllThreadAttachments() {
    const messages = [];
    let globalIndex = 0;
    const processedContainers = new Set();

    // Strategy 1: Find ALL attachment containers anywhere in the page
    // Gmail uses various classes for attachment containers
    const attachmentSelectors = [
      '.aZo',           // Standard attachment card
      '.aQH',           // Attachment area container
      '.aQw',           // Inline attachment
      '.brc',           // Another attachment format
      '[data-tooltip*="télécharger"]', // Download tooltip (FR)
      '[data-tooltip*="Download"]',    // Download tooltip (EN)
      '.aSG',           // Attachment chips area
    ];

    const allAttachmentContainers = document.querySelectorAll(attachmentSelectors.join(', '));

    // Group attachments by their parent message
    const attachmentsByMessage = new Map();

    allAttachmentContainers.forEach(container => {
      // Skip if already processed
      if (processedContainers.has(container)) return;

      // Find the parent message container
      const messageContainer = container.closest('.gs') ||
                               container.closest('[data-message-id]') ||
                               container.closest('.h7') ||
                               container.closest('.gE');

      const messageKey = messageContainer ? messageContainer : 'global';

      if (!attachmentsByMessage.has(messageKey)) {
        attachmentsByMessage.set(messageKey, {
          container: messageContainer,
          attachments: [],
        });
      }

      // Extract attachment info
      const nameEl = container.querySelector('.aV3, .aQA span, .aQA, .aZI, [data-tooltip]');
      let name = nameEl?.textContent?.trim() ||
                 container.getAttribute('data-tooltip') ||
                 container.querySelector('[aria-label]')?.getAttribute('aria-label');

      // Skip if no name found or already have this attachment
      if (!name) return;

      const existingAtts = attachmentsByMessage.get(messageKey).attachments;
      if (existingAtts.find(a => a.name === name)) return;

      // Get download URL
      const downloadLink = container.querySelector('a[download], a[href*="download"], a[href*="attid"]');
      const url = downloadLink?.href || '';

      // Get size
      const sizeEl = container.querySelector('.aQBs, .SaH2Ve, .brc + span');
      const size = sizeEl?.textContent?.trim() || '';

      existingAtts.push({ name, url, size });
      processedContainers.add(container);
    });

    // Convert map to messages array
    attachmentsByMessage.forEach((data, key) => {
      if (data.attachments.length === 0) return;

      let sender = '';
      let date = '';
      let messageId = null;

      if (data.container && data.container !== 'global') {
        sender = this.getSenderFromMessage(data.container);
        date = this.getDateFromMessage(data.container);
        messageId = this.getMessageIdFromMessage(data.container);
      } else {
        sender = 'Pièces jointes';
      }

      // Add IDs to attachments
      data.attachments.forEach((att, attIndex) => {
        att.id = `msg${globalIndex}-att${attIndex}`;
        att.messageIndex = globalIndex;
      });

      messages.push({
        index: globalIndex,
        sender,
        date,
        messageId,
        attachments: data.attachments,
        expanded: true,
      });
      globalIndex++;
    });

    // Strategy 2: Find collapsed messages with attachment count indicators
    // Look for the number badges that indicate attachments
    const collapsedRows = document.querySelectorAll('.kv, .kQ, .h7:not(.gs)');

    collapsedRows.forEach(row => {
      // Look for attachment count number (like "14" in the screenshot)
      const countBadge = row.querySelector('.bqX, .brd, .brc') ||
                         row.querySelector('span[style*="background"]') ||
                         Array.from(row.querySelectorAll('span')).find(s =>
                           /^\d+$/.test(s.textContent?.trim()) && s.textContent?.trim() !== '0'
                         );

      // Also check for paperclip icon
      const hasClipIcon = row.innerHTML.includes('attachment') ||
                          row.querySelector('[data-tooltip*="pièce"], [data-tooltip*="attachment"], [aria-label*="pièce"], [aria-label*="attachment"]');

      if (countBadge || hasClipIcon) {
        // Check if we already have attachments from this message
        const existingMsg = messages.find(m =>
          m.sender && this.getSenderFromCollapsed(row)?.includes(m.sender.split(' ')[0])
        );
        if (existingMsg) return;

        const sender = this.getSenderFromCollapsed(row);
        const date = this.getDateFromCollapsed(row);
        const count = countBadge?.textContent?.trim() || '?';

        const placeholderText = window.i18n ?
          window.i18n.t('collapsedAttachments') :
          'Dépliez ce message pour voir les pièces jointes';

        messages.push({
          index: globalIndex,
          sender: sender || 'Message replié',
          date: date,
          messageId: null,
          attachments: [{
            id: `msg${globalIndex}-collapsed`,
            name: `${placeholderText} (${count})`,
            url: null,
            size: '',
            isCollapsedPlaceholder: true,
            messageIndex: globalIndex,
          }],
          expanded: false,
          collapsedElement: row,
          attachmentCount: count,
        });
        globalIndex++;
      }
    });

    return messages;
  },

  /**
   * Get sender from a collapsed message row
   */
  getSenderFromCollapsed(row) {
    const senderEl = row.querySelector('.yP, .zF, .yW span[email], .gD, [email], .bA4 span');
    if (senderEl) {
      return senderEl.getAttribute('name') ||
             senderEl.getAttribute('email') ||
             senderEl.textContent?.trim();
    }
    // Fallback: find any span that looks like a name
    const spans = row.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && text.length > 2 && text.length < 50 && !text.match(/^\d+$/) && !text.includes('@')) {
        return text;
      }
    }
    return '';
  },

  /**
   * Get date from a collapsed message row
   */
  getDateFromCollapsed(row) {
    const dateEl = row.querySelector('.xW span, .g3, [title]');
    if (dateEl) {
      return dateEl.getAttribute('title') || dateEl.textContent?.trim();
    }
    return '';
  },

  /**
   * Get a flat list of all attachments from the thread with message info
   */
  getAllAttachmentsFlat() {
    const allAttachments = [];
    const threadMessages = this.getAllThreadAttachments();

    threadMessages.forEach(msg => {
      msg.attachments.forEach(att => {
        allAttachments.push({
          ...att,
          sender: msg.sender,
          date: msg.date,
          messageId: msg.messageId,
        });
      });
    });

    return allAttachments;
  },
};

// Make available globally for other content scripts
window.EmailExtractor = EmailExtractor;
