/**
 * Popup script for Gmail to Asana extension
 * Handles Personal Access Token configuration and settings
 */

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

// DOM Elements - Token
const tokenInput = document.getElementById('token');
const saveBtn = document.getElementById('save-btn');
const testBtn = document.getElementById('test-btn');
const statusDiv = document.getElementById('status');
const connectedSection = document.getElementById('connected-section');
const userNameSpan = document.getElementById('user-name');

// DOM Elements - Settings
const settingsSection = document.getElementById('settings-section');
const defaultWorkspaceSelect = document.getElementById('default-workspace');
const defaultProjectSelect = document.getElementById('default-project');
const defaultIncludeBody = document.getElementById('default-include-body');
const defaultIncludeLink = document.getElementById('default-include-link');
const defaultAttachEml = document.getElementById('default-attach-eml');
const defaultAddLabel = document.getElementById('default-add-label');
const autoCloseCheckbox = document.getElementById('auto-close');
const languageSelect = document.getElementById('language');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// Cache for workspaces and projects
let workspacesCache = [];
let projectsCache = {};

/**
 * Make authenticated Asana API request
 */
async function asanaFetch(endpoint, token) {
  const response = await fetch(`${ASANA_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0]?.message || `Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Load saved token and settings on popup open
 */
async function loadAll() {
  const data = await chrome.storage.local.get(['asanaToken', 'asanaUser', 'preferences']);

  if (data.asanaToken) {
    tokenInput.value = data.asanaToken;

    if (data.asanaUser) {
      showConnected(data.asanaUser.name);
      await loadWorkspaces(data.asanaToken);
    }
  }

  // Load preferences
  if (data.preferences) {
    loadPreferences(data.preferences);
  }
}

/**
 * Load preferences into form
 */
function loadPreferences(prefs) {
  if (prefs.defaultWorkspace) {
    defaultWorkspaceSelect.value = prefs.defaultWorkspace;
  }
  if (typeof prefs.includeBody === 'boolean') {
    defaultIncludeBody.checked = prefs.includeBody;
  }
  if (typeof prefs.includeLink === 'boolean') {
    defaultIncludeLink.checked = prefs.includeLink;
  }
  if (typeof prefs.attachEml === 'boolean') {
    defaultAttachEml.checked = prefs.attachEml;
  }
  if (typeof prefs.addLabel === 'boolean') {
    defaultAddLabel.checked = prefs.addLabel;
  }
  if (typeof prefs.autoClose === 'boolean') {
    autoCloseCheckbox.checked = prefs.autoClose;
  }
  if (prefs.language) {
    languageSelect.value = prefs.language;
  }
}

/**
 * Load workspaces from Asana API
 */
async function loadWorkspaces(token) {
  try {
    const result = await asanaFetch('/workspaces', token);
    workspacesCache = result.data;

    // Clear and populate workspace dropdown
    defaultWorkspaceSelect.innerHTML = '<option value="">Aucun (demander à chaque fois)</option>';

    for (const ws of workspacesCache) {
      const option = document.createElement('option');
      option.value = ws.gid;
      option.textContent = ws.name;
      defaultWorkspaceSelect.appendChild(option);
    }

    // Restore saved workspace selection
    const data = await chrome.storage.local.get('preferences');
    if (data.preferences?.defaultWorkspace) {
      defaultWorkspaceSelect.value = data.preferences.defaultWorkspace;
      // Load projects for this workspace
      await loadProjects(token, data.preferences.defaultWorkspace);

      // Restore saved project selection
      if (data.preferences.defaultProject) {
        defaultProjectSelect.value = data.preferences.defaultProject;
      }
    }
  } catch (error) {
    console.error('Failed to load workspaces:', error);
  }
}

/**
 * Load projects for a workspace
 */
async function loadProjects(token, workspaceId) {
  if (!workspaceId) {
    defaultProjectSelect.innerHTML = '<option value="">Choisir un espace d\'abord</option>';
    defaultProjectSelect.disabled = true;
    return;
  }

  defaultProjectSelect.innerHTML = '<option value="">Chargement...</option>';
  defaultProjectSelect.disabled = true;

  try {
    // Check cache first
    if (!projectsCache[workspaceId]) {
      const result = await asanaFetch(`/workspaces/${workspaceId}/projects?opt_fields=name,archived`, token);
      projectsCache[workspaceId] = result.data.filter(p => !p.archived);
    }

    const projects = projectsCache[workspaceId];

    defaultProjectSelect.innerHTML = '<option value="">Aucun (demander à chaque fois)</option>';

    for (const project of projects) {
      const option = document.createElement('option');
      option.value = project.gid;
      option.textContent = project.name;
      defaultProjectSelect.appendChild(option);
    }

    defaultProjectSelect.disabled = false;
  } catch (error) {
    console.error('Failed to load projects:', error);
    defaultProjectSelect.innerHTML = '<option value="">Erreur de chargement</option>';
  }
}

/**
 * Show connected status and settings
 */
function showConnected(name) {
  connectedSection.style.display = 'flex';
  userNameSpan.textContent = name;
  settingsSection.classList.add('visible');
}

/**
 * Hide connected status and settings
 */
function hideConnected() {
  connectedSection.style.display = 'none';
  settingsSection.classList.remove('visible');
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

/**
 * Clear status
 */
function clearStatus() {
  statusDiv.className = 'status';
}

/**
 * Save token handler
 */
saveBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();

  if (!token) {
    showStatus('Veuillez entrer un token', 'error');
    return;
  }

  clearStatus();
  saveBtn.textContent = 'Enregistrement...';
  saveBtn.disabled = true;

  try {
    // Test the token first
    const result = await asanaFetch('/users/me', token);
    const user = result.data;

    // Save token and user info
    await chrome.storage.local.set({
      asanaToken: token,
      asanaUser: user,
    });

    showConnected(user.name);
    showStatus('Token enregistré avec succès !', 'success');

    // Load workspaces
    await loadWorkspaces(token);

  } catch (error) {
    showStatus(`Erreur : ${error.message}`, 'error');
    hideConnected();
  } finally {
    saveBtn.textContent = 'Enregistrer';
    saveBtn.disabled = false;
  }
});

/**
 * Test connection handler
 */
testBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();

  if (!token) {
    showStatus('Veuillez entrer un token', 'error');
    return;
  }

  clearStatus();
  testBtn.textContent = 'Test en cours...';
  testBtn.disabled = true;

  try {
    const result = await asanaFetch('/users/me', token);
    showStatus(`Connexion réussie ! Utilisateur : ${result.data.name}`, 'success');

  } catch (error) {
    showStatus(`Échec : ${error.message}`, 'error');
  } finally {
    testBtn.textContent = 'Tester la connexion';
    testBtn.disabled = false;
  }
});

/**
 * Workspace selection change handler
 */
defaultWorkspaceSelect.addEventListener('change', async () => {
  const workspaceId = defaultWorkspaceSelect.value;
  const token = tokenInput.value.trim();

  if (token && workspaceId) {
    await loadProjects(token, workspaceId);
  } else {
    defaultProjectSelect.innerHTML = '<option value="">Choisir un espace d\'abord</option>';
    defaultProjectSelect.disabled = true;
  }
});

/**
 * Save settings handler
 */
saveSettingsBtn.addEventListener('click', async () => {
  saveSettingsBtn.textContent = 'Enregistrement...';
  saveSettingsBtn.disabled = true;

  try {
    const preferences = {
      defaultWorkspace: defaultWorkspaceSelect.value || null,
      defaultProject: defaultProjectSelect.value || null,
      includeBody: defaultIncludeBody.checked,
      includeLink: defaultIncludeLink.checked,
      attachEml: defaultAttachEml.checked,
      addLabel: defaultAddLabel.checked,
      autoClose: autoCloseCheckbox.checked,
      language: languageSelect.value,
    };

    await chrome.storage.local.set({ preferences });
    showStatus('Paramètres enregistrés !', 'success');

  } catch (error) {
    showStatus(`Erreur : ${error.message}`, 'error');
  } finally {
    saveSettingsBtn.textContent = 'Enregistrer les paramètres';
    saveSettingsBtn.disabled = false;
  }
});

// Load everything when popup opens
loadAll();
