/**
 * Project Selector - Modal for selecting Asana workspace/project
 * With assignee, due date, tags, and Gmail integration
 * Supports i18n (English/French)
 */

const ProjectSelector = {
  modal: null,
  emailData: null,
  user: null,
  workspaces: [],
  projects: [],
  users: [],
  tags: [],
  preferences: {},
  selectedProject: null,
  selectedTags: [],
  selectedExistingTask: null,
  customFields: [],
  customFieldValues: {},
  mode: 'create', // 'create' or 'comment'

  // Shorthand for i18n
  t(key, subs) {
    return window.i18n ? window.i18n.t(key, subs) : key;
  },

  /**
   * Open the project selector modal
   */
  async open(emailData, user) {
    this.emailData = emailData;
    this.user = user;
    this.selectedProject = null;
    this.selectedTags = [];
    this.selectedExistingTask = null;
    this.customFields = [];
    this.customFieldValues = {};
    this.mode = 'create';

    // Load saved preferences
    await this.loadPreferences();

    // Create and show modal
    this.createModal();
    document.body.appendChild(this.modal);

    // Animate in
    requestAnimationFrame(() => {
      this.modal.classList.add('asana-modal-visible');
    });

    // Load workspaces
    await this.loadWorkspaces();
  },

  /**
   * Close the modal
   */
  close() {
    if (this.modal) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.modal.classList.remove('asana-modal-visible');
      setTimeout(() => {
        this.modal.remove();
        this.modal = null;
      }, 300);
    }
  },

  /**
   * Load saved preferences
   */
  async loadPreferences() {
    try {
      this.preferences = await chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' }) || {};
    } catch (e) {
      this.preferences = {};
    }
  },

  /**
   * Save preferences
   */
  async savePreferences(prefs) {
    this.preferences = { ...this.preferences, ...prefs };
    await chrome.runtime.sendMessage({
      type: 'SAVE_PREFERENCES',
      preferences: this.preferences,
    });
  },

  /**
   * Create the modal DOM structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'asana-modal-overlay';

    const { subject, body, attachments, sender, emailUrl } = this.emailData;

    // Truncate body for preview
    const bodyPreview = body && body.length > 500 ? body.substring(0, 500) + '...' : (body || '');

    // Get ALL attachments from the thread, grouped by message
    const threadAttachments = window.EmailExtractor.getAllThreadAttachments();
    const totalAttachments = threadAttachments.reduce((sum, msg) => sum + msg.attachments.length, 0);

    // Store thread attachments for later use (expanding collapsed messages)
    this.threadAttachments = threadAttachments;

    // Count only real attachments (not placeholders)
    const realAttachmentCount = threadAttachments.reduce((sum, msg) =>
      sum + msg.attachments.filter(a => !a.isCollapsedPlaceholder).length, 0);
    const hasCollapsedWithAttachments = threadAttachments.some(msg => !msg.expanded);

    // Build attachments section grouped by message
    let attachmentCheckboxes = '';

    // Always show the attachments section with the "expand all" button
    const attachmentsContent = totalAttachments > 0 ? `
      <div class="asana-attachments-thread" id="asana-attachments-container">
        ${threadAttachments.map((msg, msgIndex) => `
          <div class="asana-message-attachments ${!msg.expanded ? 'asana-message-collapsed' : ''}" data-msg-index="${msgIndex}">
            <div class="asana-message-header" data-msg-index="${msgIndex}">
              <span class="asana-message-toggle">${msg.expanded ? '▼' : '▶'}</span>
              <span class="asana-message-sender">${this.escapeHtml(this.extractSenderName(msg.sender))}</span>
              ${msg.date ? `<span class="asana-message-date">${this.escapeHtml(msg.date)}</span>` : ''}
              ${msg.expanded ?
                `<span class="asana-message-count">${this.t('attachmentCount', [msg.attachments.length.toString()])}</span>` :
                `<span class="asana-message-collapsed-hint">${this.t('expandInGmail')}</span>`
              }
            </div>
            <div class="asana-attachments-list ${!msg.expanded ? 'asana-collapsed' : ''}" data-msg-content="${msgIndex}">
              ${msg.attachments.map(att => att.isCollapsedPlaceholder ? `
                <div class="asana-attachment-placeholder">
                  <span class="asana-attachment-icon">📨</span>
                  <span class="asana-attachment-info">
                    <span class="asana-attachment-name asana-text-muted">${this.escapeHtml(att.name)}</span>
                  </span>
                </div>
              ` : `
                <label class="asana-checkbox-label asana-attachment-item">
                  <input type="checkbox" name="attachment" value="${att.id}" data-url="${att.url || ''}" data-name="${att.name}" checked>
                  <span class="asana-attachment-icon">${this.getFileIcon(att.name)}</span>
                  <span class="asana-attachment-info">
                    <span class="asana-attachment-name">${this.escapeHtml(att.name)}</span>
                    ${att.size ? `<span class="asana-attachment-size">${att.size}</span>` : ''}
                  </span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="asana-no-attachments" id="asana-attachments-container">${this.t('noAttachmentsInThread')}</div>`;

    attachmentCheckboxes = `
      <div class="asana-form-group">
        <div class="asana-attachments-header">
          <label class="asana-label">
            <span class="asana-icon">📎</span> ${this.t('allThreadAttachments')} (${realAttachmentCount}${hasCollapsedWithAttachments ? '+' : ''})
          </label>
          <button type="button" class="asana-btn-expand-all" id="asana-expand-all">
            🔄 ${this.t('expandAllMessages')}
          </button>
        </div>
        ${attachmentsContent}
      </div>
    `;

    // Get today's date for the date picker default
    const today = new Date().toISOString().split('T')[0];

    this.modal.innerHTML = `
      <div class="asana-modal">
        <div class="asana-modal-header">
          <h2>${this.t('createAsanaTask')}</h2>
          <button class="asana-modal-close" aria-label="Close">&times;</button>
        </div>

        <div class="asana-modal-body">
          <!-- Email Preview Section -->
          <div class="asana-preview-section">
            <div class="asana-preview-header">
              <span class="asana-icon">✉</span> ${this.t('emailPreview')}
              ${emailUrl ? `<a href="${emailUrl}" target="_blank" class="asana-email-link" title="${this.t('openInGmail')}">🔗</a>` : ''}
            </div>

            ${sender ? `
              <div class="asana-preview-sender">
                <span class="asana-preview-label">${this.t('from')}</span>
                <span>${this.escapeHtml(sender)}</span>
              </div>
            ` : ''}

            <div class="asana-preview-subject">
              <span class="asana-preview-label">${this.t('subject')}</span>
              <span>${this.escapeHtml(subject) || this.t('noSubject')}</span>
            </div>

            ${body ? `
              <div class="asana-preview-body-container">
                <div class="asana-preview-body-header" id="asana-toggle-body">
                  <span class="asana-preview-label">${this.t('bodyPreview')}</span>
                  <span class="asana-toggle-icon">▼</span>
                </div>
                <div class="asana-preview-body" id="asana-body-content">
                  <pre>${this.escapeHtml(bodyPreview)}</pre>
                </div>
              </div>
            ` : ''}
          </div>

          <hr class="asana-divider">

          <!-- Mode Toggle -->
          <div class="asana-mode-toggle">
            <button type="button" class="asana-mode-btn asana-mode-active" id="asana-mode-create" data-mode="create">
              ➕ ${this.t('createNewTask')}
            </button>
            <button type="button" class="asana-mode-btn" id="asana-mode-comment" data-mode="comment">
              💬 ${this.t('linkExistingTask')}
            </button>
          </div>

          <!-- Create Mode: Task Configuration -->
          <div id="asana-create-section">
            <div class="asana-form-group">
              <label class="asana-label" for="asana-task-name">${this.t('taskName')}</label>
              <input type="text" id="asana-task-name" class="asana-input" value="${this.escapeHtml(subject || '')}">
            </div>
          </div>

          <!-- Comment Mode: Task Search -->
          <div id="asana-comment-section" style="display: none;">
            <div class="asana-form-group">
              <label class="asana-label">${this.t('searchTasks')}</label>
              <div class="asana-autocomplete" id="asana-task-search-autocomplete">
                <input type="text" class="asana-input asana-autocomplete-input" id="asana-task-search-input" placeholder="${this.t('searchTasks')}" disabled>
                <div class="asana-autocomplete-dropdown" id="asana-task-search-dropdown"></div>
              </div>
            </div>
            <div id="asana-selected-task-preview" class="asana-selected-task" style="display: none;"></div>
          </div>

          <div class="asana-form-row">
            <div class="asana-form-group asana-form-half">
              <label class="asana-label" for="asana-workspace">${this.t('workspace')}</label>
              <select id="asana-workspace" class="asana-select">
                <option value="">${this.t('loading')}</option>
              </select>
            </div>

            <div class="asana-form-group asana-form-half">
              <label class="asana-label">${this.t('project')}</label>
              <div class="asana-autocomplete" id="asana-project-autocomplete">
                <input type="text" class="asana-input asana-autocomplete-input" id="asana-project-input" placeholder="${this.t('selectWorkspaceFirst')}" disabled>
                <div class="asana-autocomplete-dropdown" id="asana-project-dropdown"></div>
              </div>
            </div>
          </div>

          <div class="asana-form-row">
            <div class="asana-form-group asana-form-half">
              <label class="asana-label" for="asana-assignee">${this.t('assignee')}</label>
              <select id="asana-assignee" class="asana-select" disabled>
                <option value="">${this.t('selectWorkspaceFirst')}</option>
              </select>
            </div>

            <div class="asana-form-group asana-form-half">
              <label class="asana-label" for="asana-due-date">${this.t('dueDate')}</label>
              <input type="date" id="asana-due-date" class="asana-input" min="${today}">
            </div>
          </div>

          <div class="asana-form-group">
            <label class="asana-label">${this.t('tags')}</label>
            <div class="asana-autocomplete asana-autocomplete-multi" id="asana-tags-autocomplete">
              <div class="asana-tags-selected" id="asana-tags-selected"></div>
              <input type="text" class="asana-input asana-autocomplete-input" id="asana-tags-input" placeholder="${this.t('selectWorkspaceFirst')}" disabled>
              <div class="asana-autocomplete-dropdown" id="asana-tags-dropdown"></div>
            </div>
          </div>

          <!-- Custom Fields Section (populated dynamically when project is selected) -->
          <div id="asana-custom-fields-section" class="asana-form-group" style="display: none;">
            <label class="asana-label">${this.t('customFields')}</label>
            <div id="asana-custom-fields-container"></div>
          </div>

          <div class="asana-form-group asana-options-group">
            <label class="asana-checkbox-label">
              <input type="checkbox" id="asana-include-body" ${this.preferences.includeBody !== false ? 'checked' : ''}>
              <span>${this.t('includeEmailBody')}</span>
            </label>
            <label class="asana-checkbox-label">
              <input type="checkbox" id="asana-include-link" ${this.preferences.includeLink !== false ? 'checked' : ''}>
              <span>${this.t('includeGmailLink')}</span>
            </label>
            <label class="asana-checkbox-label">
              <input type="checkbox" id="asana-attach-eml" ${!this.emailData.emlDownloadUrl ? 'disabled' : (this.preferences.attachEml ? 'checked' : '')}>
              <span>${this.t('attachEmlFile')}</span>
            </label>
            <label class="asana-checkbox-label">
              <input type="checkbox" id="asana-add-label" ${this.preferences.addLabel !== false ? 'checked' : ''}>
              <span>${this.t('addAsanaLabel')}</span>
            </label>
          </div>

          ${attachmentCheckboxes}

          <div class="asana-status" id="asana-status"></div>
        </div>

        <div class="asana-modal-footer">
          <button class="asana-btn asana-btn-secondary" id="asana-cancel">${this.t('cancel')}</button>
          <button class="asana-btn asana-btn-primary" id="asana-create">${this.t('createTask')}</button>
        </div>
      </div>
    `;

    // Add event listeners
    this.modal.querySelector('.asana-modal-close').addEventListener('click', () => this.close());
    this.modal.querySelector('#asana-cancel').addEventListener('click', () => this.close());
    this.modal.querySelector('#asana-create').addEventListener('click', () => this.createTask());
    this.modal.querySelector('#asana-workspace').addEventListener('change', e => this.onWorkspaceChange(e));

    // Close on overlay click
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) this.close();
    });

    // Setup project autocomplete
    this.setupProjectAutocomplete();

    // Setup tags autocomplete
    this.setupTagsAutocomplete();

    // Setup task search autocomplete
    this.setupTaskSearchAutocomplete();

    // Mode toggle buttons
    this.modal.querySelectorAll('.asana-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });

    // Toggle body preview
    const toggleBody = this.modal.querySelector('#asana-toggle-body');
    if (toggleBody) {
      toggleBody.addEventListener('click', () => {
        const bodyContent = this.modal.querySelector('#asana-body-content');
        const toggleIcon = toggleBody.querySelector('.asana-toggle-icon');
        bodyContent.classList.toggle('asana-collapsed');
        toggleIcon.textContent = bodyContent.classList.contains('asana-collapsed') ? '▶' : '▼';
      });
    }

    // Toggle message attachment groups
    this.modal.querySelectorAll('.asana-message-header').forEach(header => {
      header.addEventListener('click', () => {
        const msgIndex = header.dataset.msgIndex;
        const content = this.modal.querySelector(`[data-msg-content="${msgIndex}"]`);
        const toggle = header.querySelector('.asana-message-toggle');
        if (content && toggle) {
          content.classList.toggle('asana-collapsed');
          toggle.textContent = content.classList.contains('asana-collapsed') ? '▶' : '▼';
        }
      });
    });

    // Expand all messages button
    const expandAllBtn = this.modal.querySelector('#asana-expand-all');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => this.expandAllAndRescan());
    }

    // Close on escape
    this.escapeHandler = e => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escapeHandler);
  },

  /**
   * Setup project autocomplete
   */
  setupProjectAutocomplete() {
    const input = this.modal.querySelector('#asana-project-input');
    const dropdown = this.modal.querySelector('#asana-project-dropdown');
    const container = this.modal.querySelector('#asana-project-autocomplete');

    let highlightedIndex = -1;

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const filtered = this.projects.filter(p =>
        p.name.toLowerCase().includes(query)
      );
      this.renderProjectDropdown(filtered, query);
      highlightedIndex = -1;
    });

    input.addEventListener('focus', () => {
      container.classList.add('asana-autocomplete-open');
      this.renderProjectDropdown(this.projects, '');
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.asana-autocomplete-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        this.highlightItem(items, highlightedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        this.highlightItem(items, highlightedIndex);
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        items[highlightedIndex]?.click();
      } else if (e.key === 'Escape') {
        container.classList.remove('asana-autocomplete-open');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('asana-autocomplete-open');
      }
    });
  },

  /**
   * Render project dropdown items
   */
  renderProjectDropdown(projects, query) {
    const dropdown = this.modal.querySelector('#asana-project-dropdown');

    if (projects.length === 0) {
      dropdown.innerHTML = `<div class="asana-autocomplete-empty">${this.t('noProjectsFound')}</div>`;
      return;
    }

    dropdown.innerHTML = projects.map(p => `
      <div class="asana-autocomplete-item" data-id="${p.gid}">
        ${this.highlightMatch(p.name, query)}
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.asana-autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const project = this.projects.find(p => p.gid === item.dataset.id);
        if (project) {
          this.selectProject(project);
        }
      });
    });
  },

  /**
   * Select a project
   */
  async selectProject(project) {
    this.selectedProject = project;
    const input = this.modal.querySelector('#asana-project-input');
    const container = this.modal.querySelector('#asana-project-autocomplete');

    input.value = project.name;
    container.classList.remove('asana-autocomplete-open');
    container.classList.add('asana-autocomplete-selected');

    // Save preference
    this.savePreferences({ lastProjectId: project.gid });

    // Load custom fields for this project
    await this.loadCustomFields(project.gid);
  },

  /**
   * Setup tags autocomplete (multi-select)
   */
  setupTagsAutocomplete() {
    const input = this.modal.querySelector('#asana-tags-input');
    const dropdown = this.modal.querySelector('#asana-tags-dropdown');
    const container = this.modal.querySelector('#asana-tags-autocomplete');

    let highlightedIndex = -1;

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const filtered = this.tags.filter(t =>
        t.name.toLowerCase().includes(query) &&
        !this.selectedTags.find(s => s.gid === t.gid)
      );
      this.renderTagsDropdown(filtered, query);
      highlightedIndex = -1;
    });

    input.addEventListener('focus', () => {
      container.classList.add('asana-autocomplete-open');
      const available = this.tags.filter(t => !this.selectedTags.find(s => s.gid === t.gid));
      this.renderTagsDropdown(available, '');
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.asana-autocomplete-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        this.highlightItem(items, highlightedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        this.highlightItem(items, highlightedIndex);
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        items[highlightedIndex]?.click();
      } else if (e.key === 'Backspace' && input.value === '' && this.selectedTags.length > 0) {
        this.removeTag(this.selectedTags[this.selectedTags.length - 1]);
      } else if (e.key === 'Escape') {
        container.classList.remove('asana-autocomplete-open');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('asana-autocomplete-open');
      }
    });
  },

  /**
   * Render tags dropdown items
   */
  renderTagsDropdown(tags, query) {
    const dropdown = this.modal.querySelector('#asana-tags-dropdown');

    if (tags.length === 0) {
      dropdown.innerHTML = `<div class="asana-autocomplete-empty">${this.t('noTagsFound')}</div>`;
      return;
    }

    dropdown.innerHTML = tags.map(t => `
      <div class="asana-autocomplete-item" data-id="${t.gid}" style="--tag-color: ${this.getTagColor(t.color)}">
        <span class="asana-tag-dot"></span>
        ${this.highlightMatch(t.name, query)}
      </div>
    `).join('');

    // Add click handlers
    dropdown.querySelectorAll('.asana-autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const tag = this.tags.find(t => t.gid === item.dataset.id);
        if (tag) {
          this.addTag(tag);
        }
      });
    });
  },

  /**
   * Add a tag
   */
  addTag(tag) {
    if (this.selectedTags.find(t => t.gid === tag.gid)) return;

    this.selectedTags.push(tag);
    this.renderSelectedTags();

    const input = this.modal.querySelector('#asana-tags-input');
    input.value = '';
    input.focus();

    // Update dropdown
    const available = this.tags.filter(t => !this.selectedTags.find(s => s.gid === t.gid));
    this.renderTagsDropdown(available, '');
  },

  /**
   * Remove a tag
   */
  removeTag(tag) {
    this.selectedTags = this.selectedTags.filter(t => t.gid !== tag.gid);
    this.renderSelectedTags();

    // Update dropdown if open
    const container = this.modal.querySelector('#asana-tags-autocomplete');
    if (container.classList.contains('asana-autocomplete-open')) {
      const available = this.tags.filter(t => !this.selectedTags.find(s => s.gid === t.gid));
      this.renderTagsDropdown(available, '');
    }
  },

  /**
   * Render selected tags
   */
  renderSelectedTags() {
    const container = this.modal.querySelector('#asana-tags-selected');

    container.innerHTML = this.selectedTags.map(tag => `
      <span class="asana-selected-tag" style="--tag-color: ${this.getTagColor(tag.color)}" data-id="${tag.gid}">
        ${this.escapeHtml(tag.name)}
        <span class="asana-tag-remove">&times;</span>
      </span>
    `).join('');

    // Add remove handlers
    container.querySelectorAll('.asana-selected-tag').forEach(el => {
      el.querySelector('.asana-tag-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = this.selectedTags.find(t => t.gid === el.dataset.id);
        if (tag) this.removeTag(tag);
      });
    });
  },

  /**
   * Highlight matching text in autocomplete
   */
  highlightMatch(text, query) {
    if (!query) return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<strong>$1</strong>');
  },

  /**
   * Highlight item in dropdown
   */
  highlightItem(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('asana-autocomplete-highlighted', i === index);
    });
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Switch between create and comment modes
   */
  switchMode(mode) {
    this.mode = mode;

    // Update button states
    this.modal.querySelectorAll('.asana-mode-btn').forEach(btn => {
      btn.classList.toggle('asana-mode-active', btn.dataset.mode === mode);
    });

    // Show/hide sections
    const createSection = this.modal.querySelector('#asana-create-section');
    const commentSection = this.modal.querySelector('#asana-comment-section');
    const createBtn = this.modal.querySelector('#asana-create');

    // Fields only relevant for create mode
    const projectRow = this.modal.querySelector('#asana-project-autocomplete')?.closest('.asana-form-row');
    const assigneeRow = this.modal.querySelector('#asana-assignee')?.closest('.asana-form-row');
    const tagsGroup = this.modal.querySelector('#asana-tags-autocomplete')?.closest('.asana-form-group');
    const customFieldsSection = this.modal.querySelector('#asana-custom-fields-section');

    if (mode === 'create') {
      createSection.style.display = '';
      commentSection.style.display = 'none';
      createBtn.textContent = this.t('createTask');
      // Show create-only fields
      if (projectRow) projectRow.style.display = '';
      if (assigneeRow) assigneeRow.style.display = '';
      if (tagsGroup) tagsGroup.style.display = '';
      if (customFieldsSection && this.customFields.length > 0) customFieldsSection.style.display = '';
    } else {
      createSection.style.display = 'none';
      commentSection.style.display = '';
      createBtn.textContent = this.t('addComment');
      // Hide create-only fields (not needed for adding comments)
      if (projectRow) projectRow.style.display = 'none';
      if (assigneeRow) assigneeRow.style.display = 'none';
      if (tagsGroup) tagsGroup.style.display = 'none';
      if (customFieldsSection) customFieldsSection.style.display = 'none';
    }
  },

  /**
   * Setup task search autocomplete for comment mode
   */
  setupTaskSearchAutocomplete() {
    const input = this.modal.querySelector('#asana-task-search-input');
    const dropdown = this.modal.querySelector('#asana-task-search-dropdown');
    const container = this.modal.querySelector('#asana-task-search-autocomplete');

    let searchTimeout = null;
    let highlightedIndex = -1;

    input.addEventListener('input', () => {
      const query = input.value.trim();

      // Debounce search
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        if (query.length < 2) {
          dropdown.innerHTML = '';
          container.classList.remove('asana-autocomplete-open');
          return;
        }

        const workspaceId = this.modal.querySelector('#asana-workspace').value;
        if (!workspaceId) return;

        try {
          const tasks = await chrome.runtime.sendMessage({
            type: 'SEARCH_TASKS',
            workspaceId,
            query,
          });

          this.renderTaskSearchDropdown(tasks, query);
          container.classList.add('asana-autocomplete-open');
          highlightedIndex = -1;
        } catch (error) {
          console.error('Task search error:', error);
        }
      }, 300);
    });

    input.addEventListener('focus', () => {
      if (input.value.length >= 2) {
        container.classList.add('asana-autocomplete-open');
      }
    });

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.asana-autocomplete-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
        this.highlightItem(items, highlightedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        this.highlightItem(items, highlightedIndex);
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        items[highlightedIndex]?.click();
      } else if (e.key === 'Escape') {
        container.classList.remove('asana-autocomplete-open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('asana-autocomplete-open');
      }
    });
  },

  /**
   * Render task search dropdown
   */
  renderTaskSearchDropdown(tasks, query) {
    const dropdown = this.modal.querySelector('#asana-task-search-dropdown');

    if (tasks.length === 0) {
      dropdown.innerHTML = `<div class="asana-autocomplete-empty">${this.t('noTasksFound')}</div>`;
      return;
    }

    dropdown.innerHTML = tasks.map(task => `
      <div class="asana-autocomplete-item asana-task-item ${task.completed ? 'asana-task-completed' : ''}" data-id="${task.gid}">
        <span class="asana-task-check">${task.completed ? '✓' : '○'}</span>
        <span class="asana-task-name">${this.highlightMatch(task.name, query)}</span>
        ${task.assignee ? `<span class="asana-task-assignee">${this.escapeHtml(task.assignee.name)}</span>` : ''}
      </div>
    `).join('');

    dropdown.querySelectorAll('.asana-autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const task = tasks.find(t => t.gid === item.dataset.id);
        if (task) {
          this.selectExistingTask(task);
        }
      });
    });
  },

  /**
   * Select an existing task for adding a comment
   */
  selectExistingTask(task) {
    this.selectedExistingTask = task;

    const input = this.modal.querySelector('#asana-task-search-input');
    const container = this.modal.querySelector('#asana-task-search-autocomplete');
    const preview = this.modal.querySelector('#asana-selected-task-preview');

    input.value = task.name;
    container.classList.remove('asana-autocomplete-open');

    // Show task preview
    preview.style.display = 'block';
    preview.innerHTML = `
      <div class="asana-selected-task-header">
        <span class="asana-task-check">${task.completed ? '✓' : '○'}</span>
        <strong>${this.escapeHtml(task.name)}</strong>
        <button type="button" class="asana-task-clear">&times;</button>
      </div>
      ${task.projects?.length ? `<div class="asana-task-project">📁 ${task.projects.map(p => this.escapeHtml(p.name)).join(', ')}</div>` : ''}
      ${task.assignee ? `<div class="asana-task-assignee-info">👤 ${this.escapeHtml(task.assignee.name)}</div>` : ''}
    `;

    // Clear button
    preview.querySelector('.asana-task-clear').addEventListener('click', () => {
      this.selectedExistingTask = null;
      input.value = '';
      preview.style.display = 'none';
    });
  },

  /**
   * Load custom fields for a project
   */
  async loadCustomFields(projectId) {
    const section = this.modal.querySelector('#asana-custom-fields-section');
    const container = this.modal.querySelector('#asana-custom-fields-container');

    try {
      this.customFields = await chrome.runtime.sendMessage({
        type: 'GET_PROJECT_CUSTOM_FIELDS',
        projectId,
      });

      if (this.customFields.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = '';
      this.customFieldValues = {};
      this.renderCustomFields();

    } catch (error) {
      console.error('Error loading custom fields:', error);
      section.style.display = 'none';
    }
  },

  /**
   * Render custom fields inputs
   */
  renderCustomFields() {
    const container = this.modal.querySelector('#asana-custom-fields-container');

    container.innerHTML = this.customFields.map(field => {
      const fieldId = `asana-cf-${field.gid}`;

      switch (field.type) {
        case 'text':
          return `
            <div class="asana-custom-field">
              <label class="asana-cf-label" for="${fieldId}">${this.escapeHtml(field.name)}</label>
              <input type="text" id="${fieldId}" class="asana-input asana-cf-input" data-field-id="${field.gid}">
            </div>
          `;

        case 'number':
          return `
            <div class="asana-custom-field">
              <label class="asana-cf-label" for="${fieldId}">${this.escapeHtml(field.name)}</label>
              <input type="number" id="${fieldId}" class="asana-input asana-cf-input" data-field-id="${field.gid}">
            </div>
          `;

        case 'enum':
          return `
            <div class="asana-custom-field">
              <label class="asana-cf-label" for="${fieldId}">${this.escapeHtml(field.name)}</label>
              <select id="${fieldId}" class="asana-select asana-cf-input" data-field-id="${field.gid}">
                <option value="">--</option>
                ${field.enumOptions.map(opt => `
                  <option value="${opt.gid}" style="color: ${opt.color || 'inherit'}">${this.escapeHtml(opt.name)}</option>
                `).join('')}
              </select>
            </div>
          `;

        case 'date':
          return `
            <div class="asana-custom-field">
              <label class="asana-cf-label" for="${fieldId}">${this.escapeHtml(field.name)}</label>
              <input type="date" id="${fieldId}" class="asana-input asana-cf-input" data-field-id="${field.gid}">
            </div>
          `;

        default:
          return ''; // Skip unsupported field types
      }
    }).join('');

    // Add change listeners to capture values
    container.querySelectorAll('.asana-cf-input').forEach(input => {
      input.addEventListener('change', () => {
        const fieldId = input.dataset.fieldId;
        const value = input.value;
        if (value) {
          this.customFieldValues[fieldId] = value;
        } else {
          delete this.customFieldValues[fieldId];
        }
      });
    });
  },

  /**
   * Load workspaces from Asana
   */
  async loadWorkspaces() {
    try {
      this.workspaces = await chrome.runtime.sendMessage({ type: 'GET_WORKSPACES' });

      const select = this.modal.querySelector('#asana-workspace');
      select.innerHTML = `<option value="">${this.t('selectWorkspace')}</option>` +
        this.workspaces.map(ws => `<option value="${ws.gid}">${this.escapeHtml(ws.name)}</option>`).join('');

      // Priority: default workspace > last used > auto-select if only one
      const workspaceToSelect = this.preferences.defaultWorkspace || this.preferences.lastWorkspaceId;

      if (workspaceToSelect && this.workspaces.find(w => w.gid === workspaceToSelect)) {
        select.value = workspaceToSelect;
        await this.onWorkspaceChange({ target: select }, true); // Pass flag to auto-select default project
      } else if (this.workspaces.length === 1) {
        select.value = this.workspaces[0].gid;
        await this.onWorkspaceChange({ target: select }, true);
      }
    } catch (error) {
      this.showStatus(`${this.t('errorLoadWorkspaces')} ${error.message}`, 'error');
    }
  },

  /**
   * Handle workspace selection change
   * @param {Event} event - The change event
   * @param {boolean} autoSelectDefaults - Whether to auto-select default project
   */
  async onWorkspaceChange(event, autoSelectDefaults = false) {
    const workspaceId = event.target.value;
    const projectInput = this.modal.querySelector('#asana-project-input');
    const assigneeSelect = this.modal.querySelector('#asana-assignee');
    const tagsInput = this.modal.querySelector('#asana-tags-input');
    const taskSearchInput = this.modal.querySelector('#asana-task-search-input');

    // Reset selections
    this.selectedProject = null;
    this.selectedTags = [];
    this.selectedExistingTask = null;
    this.customFields = [];
    this.customFieldValues = {};
    this.renderSelectedTags();

    // Hide custom fields
    const cfSection = this.modal.querySelector('#asana-custom-fields-section');
    if (cfSection) cfSection.style.display = 'none';

    // Clear task search
    if (taskSearchInput) {
      taskSearchInput.value = '';
      const taskPreview = this.modal.querySelector('#asana-selected-task-preview');
      if (taskPreview) taskPreview.style.display = 'none';
    }

    if (!workspaceId) {
      projectInput.value = '';
      projectInput.placeholder = this.t('selectWorkspaceFirst');
      projectInput.disabled = true;
      assigneeSelect.innerHTML = `<option value="">${this.t('selectWorkspaceFirst')}</option>`;
      assigneeSelect.disabled = true;
      tagsInput.placeholder = this.t('selectWorkspaceFirst');
      tagsInput.disabled = true;
      if (taskSearchInput) {
        taskSearchInput.placeholder = this.t('selectWorkspaceFirst');
        taskSearchInput.disabled = true;
      }
      return;
    }

    // Show loading state
    projectInput.value = '';
    projectInput.placeholder = this.t('loading');
    projectInput.disabled = true;
    assigneeSelect.innerHTML = `<option value="">${this.t('loading')}</option>`;
    assigneeSelect.disabled = true;
    tagsInput.placeholder = this.t('loading');
    tagsInput.disabled = true;

    try {
      // Load projects, users, and tags in parallel
      const [projects, users, tags] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_PROJECTS', workspaceId }),
        chrome.runtime.sendMessage({ type: 'GET_USERS', workspaceId }),
        chrome.runtime.sendMessage({ type: 'GET_TAGS', workspaceId }),
      ]);

      this.projects = projects;
      this.users = users;
      this.tags = tags;

      // Enable project autocomplete
      projectInput.placeholder = this.t('searchProjects', [projects.length.toString()]);
      projectInput.disabled = false;
      this.modal.querySelector('#asana-project-autocomplete').classList.remove('asana-autocomplete-selected');

      // Auto-select default project or restore last used project
      const projectToSelect = autoSelectDefaults && this.preferences.defaultProject
        ? this.preferences.defaultProject
        : this.preferences.lastProjectId;

      if (projectToSelect) {
        const project = this.projects.find(p => p.gid === projectToSelect);
        if (project) {
          this.selectProject(project);
        }
      }

      // Populate assignees
      assigneeSelect.innerHTML = `<option value="">${this.t('unassigned')}</option>` +
        `<option value="${this.user.gid}">${this.t('me')} (${this.escapeHtml(this.user.name)})</option>` +
        this.users
          .filter(u => u.gid !== this.user.gid)
          .map(u => `<option value="${u.gid}">${this.escapeHtml(u.name)}</option>`)
          .join('');
      assigneeSelect.disabled = false;

      // Enable tags autocomplete
      tagsInput.placeholder = tags.length > 0 ? this.t('searchTags', [tags.length.toString()]) : this.t('noTagsAvailable');
      tagsInput.disabled = tags.length === 0;

      // Enable task search for comment mode
      if (taskSearchInput) {
        taskSearchInput.placeholder = this.t('searchTasks');
        taskSearchInput.disabled = false;
      }

      // Save workspace preference
      await this.savePreferences({ lastWorkspaceId: workspaceId });

    } catch (error) {
      this.showStatus(`${this.t('errorLoadData')} ${error.message}`, 'error');
    }
  },

  /**
   * Create the Asana task or add comment to existing task
   */
  async createTask() {
    // Handle comment mode
    if (this.mode === 'comment') {
      return this.addCommentToTask();
    }

    const taskName = this.modal.querySelector('#asana-task-name').value.trim();
    const workspaceId = this.modal.querySelector('#asana-workspace').value;
    const assigneeId = this.modal.querySelector('#asana-assignee').value;
    const dueDate = this.modal.querySelector('#asana-due-date').value;
    const includeBody = this.modal.querySelector('#asana-include-body').checked;
    const includeLink = this.modal.querySelector('#asana-include-link').checked;
    const attachEml = this.modal.querySelector('#asana-attach-eml').checked;
    const addGmailLabel = this.modal.querySelector('#asana-add-label').checked;

    if (!taskName) {
      this.showStatus(this.t('errorEnterTaskName'), 'error');
      return;
    }

    if (!this.selectedProject) {
      this.showStatus(this.t('errorSelectProject'), 'error');
      return;
    }

    // Get selected attachments
    const selectedAttachments = [];
    this.modal.querySelectorAll('input[name="attachment"]:checked').forEach(checkbox => {
      selectedAttachments.push({
        url: checkbox.dataset.url,
        name: checkbox.dataset.name,
      });
    });

    const createBtn = this.modal.querySelector('#asana-create');
    createBtn.disabled = true;
    createBtn.textContent = this.t('creating');

    try {
      this.showStatus(this.t('creatingTask'), 'info');

      // Build HTML notes using Asana's rich text format (valid XML)
      let htmlNotes = '<body>';

      // Add sender info
      if (this.emailData.sender) {
        htmlNotes += `${this.t('from')} ${this.escapeHtml(this.emailData.sender)}\n`;
      }

      // Add date if available
      if (this.emailData.date) {
        htmlNotes += `Date: ${this.escapeHtml(this.emailData.date)}\n`;
      }

      // Add Gmail link
      if (includeLink && this.emailData.emailUrl) {
        htmlNotes += `\n<a href="${this.escapeHtml(this.emailData.emailUrl)}">Ouvrir dans Gmail</a>\n`;
      }

      // Add body as blockquote
      if (includeBody && this.emailData.body) {
        const cleanBody = this.escapeHtml(this.emailData.body)
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^\s+|\s+$/g, '');
        htmlNotes += `\n<blockquote>${cleanBody}</blockquote>`;
      }

      htmlNotes += '</body>';

      // Build custom fields data
      const customFieldsData = {};
      for (const [fieldId, value] of Object.entries(this.customFieldValues)) {
        const field = this.customFields.find(f => f.gid === fieldId);
        if (field) {
          if (field.type === 'enum') {
            customFieldsData[fieldId] = value; // enum option gid
          } else if (field.type === 'number') {
            customFieldsData[fieldId] = parseFloat(value);
          } else {
            customFieldsData[fieldId] = value;
          }
        }
      }

      // Create the task
      const taskResponse = await chrome.runtime.sendMessage({
        type: 'CREATE_TASK',
        taskData: {
          projectId: this.selectedProject.gid,
          workspaceId,
          name: taskName,
          htmlNotes,
          assignee: assigneeId || null,
          dueDate: dueDate || null,
          tags: this.selectedTags.length > 0 ? this.selectedTags.map(t => t.gid) : null,
          customFields: Object.keys(customFieldsData).length > 0 ? customFieldsData : null,
        },
      });

      // Check for error response
      if (taskResponse.error) {
        throw new Error(taskResponse.error);
      }

      const task = taskResponse;

      // Upload EML file first (if selected)
      if (attachEml) {
        console.log('EML attachment requested, URL:', this.emailData.emlDownloadUrl);
        if (this.emailData.emlDownloadUrl) {
          this.showStatus(this.t('attachingEmail'), 'info');
          try {
            const emlFilename = `${(this.emailData.subject || 'email').substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}.eml`;
            console.log('Downloading EML from:', this.emailData.emlDownloadUrl);
            // Download from content script (has Gmail access) then upload
            const emlBlob = await this.downloadAttachment(this.emailData.emlDownloadUrl);
            console.log('EML blob result:', emlBlob ? `${emlBlob.size} bytes` : 'null');
            if (emlBlob && emlBlob.size > 0) {
              await this.uploadBlobToAsana(task.gid, emlBlob, emlFilename);
              console.log('EML uploaded successfully');
            } else {
              console.warn('EML download returned empty or null blob');
            }
          } catch (emlError) {
            console.error('Failed to attach EML:', emlError);
          }
        } else {
          console.warn('EML URL not available');
        }
      }

      // Upload other attachments
      if (selectedAttachments.length > 0) {
        this.showStatus(this.t('uploadingAttachments', [selectedAttachments.length.toString()]), 'info');

        for (const att of selectedAttachments) {
          if (att.url) {
            try {
              // Download from content script then upload
              const blob = await this.downloadAttachment(att.url);
              if (blob) {
                await this.uploadBlobToAsana(task.gid, blob, att.name);
              }
            } catch (uploadError) {
              console.error('Failed to upload attachment:', att.name, uploadError);
            }
          }
        }
      }

      // Add Gmail label
      if (addGmailLabel) {
        this.showStatus(this.t('addingLabel'), 'info');
        await this.addGmailLabel();
      }

      // Success - show link and close
      const taskUrl = `https://app.asana.com/0/0/${task.gid}`;
      this.showStatus(`${this.t('taskCreated')} <a href="${taskUrl}" target="_blank">${this.t('openInAsana')}</a>`, 'success');

      // Show browser notification
      chrome.runtime.sendMessage({
        type: 'SHOW_NOTIFICATION',
        title: this.t('notificationTitle'),
        message: `${taskName}\n${this.t('clickToOpen')}`,
        url: taskUrl,
      });

      // Auto-close modal if enabled
      if (this.preferences.autoClose) {
        setTimeout(() => this.close(), 2000);
      }

    } catch (error) {
      this.showStatus(`${this.t('errorCreateTask')} ${error.message}`, 'error');
      createBtn.disabled = false;
      createBtn.textContent = this.t('createTask');
    }
  },

  /**
   * Add comment to an existing task
   */
  async addCommentToTask() {
    if (!this.selectedExistingTask) {
      this.showStatus(this.t('noTasksFound'), 'error');
      return;
    }

    const includeBody = this.modal.querySelector('#asana-include-body').checked;
    const includeLink = this.modal.querySelector('#asana-include-link').checked;
    const attachEml = this.modal.querySelector('#asana-attach-eml').checked;
    const addGmailLabel = this.modal.querySelector('#asana-add-label').checked;

    // Get selected attachments
    const selectedAttachments = [];
    this.modal.querySelectorAll('input[name="attachment"]:checked').forEach(checkbox => {
      selectedAttachments.push({
        url: checkbox.dataset.url,
        name: checkbox.dataset.name,
      });
    });

    const createBtn = this.modal.querySelector('#asana-create');
    createBtn.disabled = true;
    createBtn.textContent = this.t('addingComment');

    try {
      this.showStatus(this.t('addingComment'), 'info');

      // Build HTML comment using Asana's rich text format (valid XML)
      let htmlComment = '<body>';
      htmlComment += `<strong>${this.escapeHtml(this.emailData.subject || '(no subject)')}</strong>`;

      // Add sender and date on new line
      if (this.emailData.sender || this.emailData.date) {
        htmlComment += '\n';
        if (this.emailData.sender) {
          htmlComment += `De: ${this.escapeHtml(this.emailData.sender)}`;
        }
        if (this.emailData.date) {
          htmlComment += this.emailData.sender ? ` | ${this.escapeHtml(this.emailData.date)}` : this.escapeHtml(this.emailData.date);
        }
      }

      // Add Gmail link
      if (includeLink && this.emailData.emailUrl) {
        htmlComment += `\n<a href="${this.escapeHtml(this.emailData.emailUrl)}">Ouvrir dans Gmail</a>`;
      }

      // Add body as blockquote
      if (includeBody && this.emailData.body) {
        const cleanBody = this.escapeHtml(this.emailData.body)
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^\s+|\s+$/g, '');
        htmlComment += `\n<blockquote>${cleanBody}</blockquote>`;
      }

      htmlComment += '</body>';

      // Add comment to task
      const commentResponse = await chrome.runtime.sendMessage({
        type: 'ADD_COMMENT',
        taskId: this.selectedExistingTask.gid,
        text: '', // fallback
        htmlText: htmlComment,
      });

      if (commentResponse.error) {
        throw new Error(commentResponse.error);
      }

      // Upload EML file (if selected)
      if (attachEml) {
        console.log('EML attachment requested (comment mode), URL:', this.emailData.emlDownloadUrl);
        if (this.emailData.emlDownloadUrl) {
          this.showStatus(this.t('attachingEmail'), 'info');
          try {
            const emlFilename = `${(this.emailData.subject || 'email').substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}.eml`;
            console.log('Downloading EML from:', this.emailData.emlDownloadUrl);
            const emlBlob = await this.downloadAttachment(this.emailData.emlDownloadUrl);
            console.log('EML blob result:', emlBlob ? `${emlBlob.size} bytes` : 'null');
            if (emlBlob && emlBlob.size > 0) {
              await this.uploadBlobToAsana(this.selectedExistingTask.gid, emlBlob, emlFilename);
              console.log('EML uploaded successfully');
            } else {
              console.warn('EML download returned empty or null blob');
            }
          } catch (emlError) {
            console.error('Failed to attach EML:', emlError);
          }
        } else {
          console.warn('EML URL not available');
        }
      }

      // Upload other attachments
      if (selectedAttachments.length > 0) {
        this.showStatus(this.t('uploadingAttachments', [selectedAttachments.length.toString()]), 'info');

        for (const att of selectedAttachments) {
          if (att.url) {
            try {
              const blob = await this.downloadAttachment(att.url);
              if (blob) {
                await this.uploadBlobToAsana(this.selectedExistingTask.gid, blob, att.name);
              }
            } catch (uploadError) {
              console.error('Failed to upload attachment:', att.name, uploadError);
            }
          }
        }
      }

      // Add Gmail label
      if (addGmailLabel) {
        this.showStatus(this.t('addingLabel'), 'info');
        await this.addGmailLabel();
      }

      // Success
      const taskUrl = `https://app.asana.com/0/0/${this.selectedExistingTask.gid}`;
      this.showStatus(`${this.t('commentAdded')} <a href="${taskUrl}" target="_blank">${this.t('openInAsana')}</a>`, 'success');

      // Show browser notification
      chrome.runtime.sendMessage({
        type: 'SHOW_NOTIFICATION',
        title: this.t('notificationCommentTitle'),
        message: `${this.selectedExistingTask.name}\n${this.t('clickToOpen')}`,
        url: taskUrl,
      });

      // Auto-close modal if enabled
      if (this.preferences.autoClose) {
        setTimeout(() => this.close(), 2000);
      }

    } catch (error) {
      this.showStatus(`${this.t('errorCreateTask')} ${error.message}`, 'error');
      createBtn.disabled = false;
      createBtn.textContent = this.t('addComment');
    }
  },

  /**
   * Expand all messages in Gmail and rescan for attachments
   */
  async expandAllAndRescan() {
    const expandBtn = this.modal.querySelector('#asana-expand-all');
    const container = this.modal.querySelector('#asana-attachments-container');

    // Show loading state
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.innerHTML = `⏳ ${this.t('expanding')}`;
    }

    // Temporarily hide modal to allow clicking on Gmail
    this.modal.style.display = 'none';

    try {
      // Method 1: Find and click Gmail's "Expand all" in the thread menu
      // Look for the small arrow/menu near the thread subject
      const expandAllSelectors = [
        '[data-tooltip*="développer"]',
        '[data-tooltip*="Expand"]',
        '[aria-label*="développer"]',
        '[aria-label*="Expand"]',
        '.h7 .ajz', // Expand icon in thread
      ];

      for (const selector of expandAllSelectors) {
        const expandIcon = document.querySelector(selector);
        if (expandIcon) {
          expandIcon.click();
          await this.sleep(800);
          break;
        }
      }

      // Method 2: Click directly on collapsed message rows
      // Gmail collapsed messages are typically in these containers
      let clickedAny = false;

      // Find the thread container
      const threadContainer = document.querySelector('.AO') ||
                              document.querySelector('[role="main"]') ||
                              document.querySelector('.nH.bkK');

      if (threadContainer) {
        // Look for collapsed message indicators - rows with sender but no full body
        // These are typically clickable rows between expanded messages
        const allRows = threadContainer.querySelectorAll('.kv, .kQ, .gE:not(.gt), .h7');

        for (const row of allRows) {
          // Skip if this row is inside an expanded message (has .gs parent or .a3s body)
          if (row.closest('.gs') || row.querySelector('.a3s')) continue;

          // Skip if row is too small (probably not a message row)
          if (row.offsetHeight < 30) continue;

          // Click to expand
          row.click();
          clickedAny = true;
          await this.sleep(300);
        }
      }

      // Method 3: Look for any collapsed message summaries (with avatar + name)
      if (!clickedAny) {
        const collapsedSummaries = document.querySelectorAll('.kv, .gE.iv.gt');
        for (const summary of collapsedSummaries) {
          if (summary.closest('.gs')) continue;
          summary.click();
          await this.sleep(300);
        }
      }

      // Method 4: Just click on areas that look like collapsed messages
      // Look for rows with sender avatars/initials that aren't expanded
      const avatarRows = document.querySelectorAll('[data-message-id]');
      for (const row of avatarRows) {
        // Check if this message is collapsed (no visible body)
        const hasBody = row.querySelector('.a3s, .ii.gt');
        if (!hasBody) {
          row.click();
          await this.sleep(300);
        }
      }

      // Wait for Gmail to load expanded content
      await this.sleep(1500);

      // Show modal again
      this.modal.style.display = '';

      // Rescan attachments
      this.threadAttachments = window.EmailExtractor.getAllThreadAttachments();
      const totalAttachments = this.threadAttachments.reduce((sum, msg) => sum + msg.attachments.length, 0);
      const realAttachmentCount = this.threadAttachments.reduce((sum, msg) =>
        sum + msg.attachments.filter(a => !a.isCollapsedPlaceholder).length, 0);
      const hasCollapsedWithAttachments = this.threadAttachments.some(msg => !msg.expanded);

      // Update the attachments container
      if (totalAttachments > 0) {
        container.outerHTML = `
          <div class="asana-attachments-thread" id="asana-attachments-container">
            ${this.threadAttachments.map((msg, msgIndex) => `
              <div class="asana-message-attachments ${!msg.expanded ? 'asana-message-collapsed' : ''}" data-msg-index="${msgIndex}">
                <div class="asana-message-header" data-msg-index="${msgIndex}">
                  <span class="asana-message-toggle">${msg.expanded ? '▼' : '▶'}</span>
                  <span class="asana-message-sender">${this.escapeHtml(this.extractSenderName(msg.sender))}</span>
                  ${msg.date ? `<span class="asana-message-date">${this.escapeHtml(msg.date)}</span>` : ''}
                  ${msg.expanded ?
                    `<span class="asana-message-count">${this.t('attachmentCount', [msg.attachments.length.toString()])}</span>` :
                    `<span class="asana-message-collapsed-hint">${this.t('expandInGmail')}</span>`
                  }
                </div>
                <div class="asana-attachments-list ${!msg.expanded ? 'asana-collapsed' : ''}" data-msg-content="${msgIndex}">
                  ${msg.attachments.map(att => att.isCollapsedPlaceholder ? `
                    <div class="asana-attachment-placeholder">
                      <span class="asana-attachment-icon">📨</span>
                      <span class="asana-attachment-info">
                        <span class="asana-attachment-name asana-text-muted">${this.escapeHtml(att.name)}</span>
                      </span>
                    </div>
                  ` : `
                    <label class="asana-checkbox-label asana-attachment-item">
                      <input type="checkbox" name="attachment" value="${att.id}" data-url="${att.url || ''}" data-name="${att.name}" checked>
                      <span class="asana-attachment-icon">${this.getFileIcon(att.name)}</span>
                      <span class="asana-attachment-info">
                        <span class="asana-attachment-name">${this.escapeHtml(att.name)}</span>
                        ${att.size ? `<span class="asana-attachment-size">${att.size}</span>` : ''}
                      </span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `;

        // Re-add toggle event listeners
        this.modal.querySelectorAll('.asana-message-header').forEach(header => {
          header.addEventListener('click', () => {
            const msgIndex = header.dataset.msgIndex;
            const content = this.modal.querySelector(`[data-msg-content="${msgIndex}"]`);
            const toggle = header.querySelector('.asana-message-toggle');
            if (content && toggle) {
              content.classList.toggle('asana-collapsed');
              toggle.textContent = content.classList.contains('asana-collapsed') ? '▶' : '▼';
            }
          });
        });
      } else {
        container.outerHTML = `<div class="asana-no-attachments" id="asana-attachments-container">${this.t('noAttachmentsInThread')}</div>`;
      }

      // Update the count in the label
      const label = this.modal.querySelector('.asana-attachments-header .asana-label');
      if (label) {
        label.innerHTML = `<span class="asana-icon">📎</span> ${this.t('allThreadAttachments')} (${realAttachmentCount}${hasCollapsedWithAttachments ? '+' : ''})`;
      }

      // Update button
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = `✓ ${this.t('refreshAttachments')}`;
      }

    } catch (error) {
      console.error('Error expanding messages:', error);
      // Make sure modal is visible again
      this.modal.style.display = '';
      if (expandBtn) {
        expandBtn.disabled = false;
        expandBtn.innerHTML = `🔄 ${this.t('expandAllMessages')}`;
      }
    }
  },

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Download attachment from Gmail (runs in content script context with Gmail access)
   */
  async downloadAttachment(url) {
    try {
      console.log('Fetching attachment from:', url);
      const response = await fetch(url, {
        credentials: 'include', // Include Gmail cookies
      });

      console.log('Fetch response:', response.status, response.statusText, 'Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        console.error('Failed to download attachment:', response.status, response.statusText);
        return null;
      }

      const blob = await response.blob();
      console.log('Downloaded blob:', blob.size, 'bytes, type:', blob.type);
      return blob;
    } catch (error) {
      console.error('Error downloading attachment:', error);
      return null;
    }
  },

  /**
   * Upload a blob to Asana task via service worker
   */
  async uploadBlobToAsana(taskId, blob, filename) {
    // Convert blob to base64 to send via message
    const base64 = await this.blobToBase64(blob);

    const response = await chrome.runtime.sendMessage({
      type: 'UPLOAD_ATTACHMENT_BASE64',
      taskId,
      base64Data: base64,
      mimeType: blob.type || 'application/octet-stream',
      filename,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response;
  },

  /**
   * Convert blob to base64 string
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Add "Asana" label to the current email in Gmail
   */
  async addGmailLabel() {
    try {
      const labelsBtn = document.querySelector('[data-tooltip="Labels"]') ||
                        document.querySelector('[aria-label="Labels"]') ||
                        document.querySelector('[data-tooltip="Libellés"]') ||
                        document.querySelector('[aria-label="Libellés"]') ||
                        document.querySelector('.asb');

      if (labelsBtn) {
        labelsBtn.click();
        await new Promise(resolve => setTimeout(resolve, 300));

        const labelItems = document.querySelectorAll('[role="menuitem"], .J-N');

        for (const item of labelItems) {
          if (item.textContent.includes('Asana')) {
            item.click();
            return;
          }
        }

        document.body.click();
        console.log('Asana label not found. Create it manually in Gmail settings.');
      }
    } catch (e) {
      console.error('Could not add Gmail label:', e);
    }
  },

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const status = this.modal.querySelector('#asana-status');
    status.innerHTML = message;
    status.className = `asana-status asana-status-${type}`;
  },

  /**
   * Get tag color from Asana color name
   */
  getTagColor(colorName) {
    const colors = {
      'dark-pink': '#ea4e9d',
      'dark-green': '#058527',
      'dark-blue': '#0064b6',
      'dark-red': '#d6423f',
      'dark-teal': '#06a59a',
      'dark-brown': '#8d6e63',
      'dark-orange': '#e8710a',
      'dark-purple': '#7b68ee',
      'dark-warm-gray': '#8f8f8f',
      'light-pink': '#f9aaef',
      'light-green': '#c7f464',
      'light-blue': '#4ecbfa',
      'light-red': '#ff8d8d',
      'light-teal': '#76f0e7',
      'light-brown': '#d4b996',
      'light-orange': '#ffc107',
      'light-purple': '#e6d6fc',
      'light-warm-gray': '#d9d9d9',
    };
    return colors[colorName] || '#9ca6af';
  },

  /**
   * Get file icon based on extension
   */
  getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const icons = {
      pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
      ppt: '📽️', pptx: '📽️', txt: '📃',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
      zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
      js: '💻', ts: '💻', py: '💻', html: '💻', css: '💻', json: '💻',
      mp3: '🎵', wav: '🎵', mp4: '🎬', avi: '🎬', mov: '🎬',
    };
    return icons[ext] || '📎';
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Extract just the name from "Name <email>" format
   */
  extractSenderName(sender) {
    if (!sender) return '';
    // Try to get just the name part before <email>
    const match = sender.match(/^([^<]+)/);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
    // If no name, return the email without angle brackets
    return sender.replace(/<|>/g, '').trim();
  },
};

// Make available globally
window.ProjectSelector = ProjectSelector;
