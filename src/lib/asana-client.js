/**
 * Asana API Client
 * Uses Personal Access Token for authentication
 */

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

/**
 * Get the stored Asana token
 */
async function getToken() {
  const data = await chrome.storage.local.get('asanaToken');
  return data.asanaToken;
}

/**
 * Make an authenticated request to the Asana API
 */
async function asanaFetch(endpoint, options = {}) {
  const token = await getToken();

  if (!token) {
    throw new Error('Token Asana non configuré. Cliquez sur l\'icône de l\'extension pour le configurer.');
  }

  const response = await fetch(`${ASANA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0]?.message || `Asana API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if user is logged in to Asana (has valid token)
 */
export async function checkSession() {
  try {
    const token = await getToken();

    if (!token) {
      return {
        loggedIn: false,
        error: 'Token non configuré',
        needsSetup: true,
      };
    }

    const result = await asanaFetch('/users/me');
    return {
      loggedIn: true,
      user: result.data,
    };
  } catch (error) {
    return {
      loggedIn: false,
      error: error.message,
    };
  }
}

/**
 * Get all workspaces for the current user
 */
export async function getWorkspaces() {
  const result = await asanaFetch('/workspaces');
  return result.data;
}

/**
 * Get all projects in a workspace
 */
export async function getProjects(workspaceId) {
  const result = await asanaFetch(`/workspaces/${workspaceId}/projects?opt_fields=name,archived`);
  // Filter out archived projects
  return result.data.filter(project => !project.archived);
}

/**
 * Get all users in a workspace (for assignee dropdown)
 */
export async function getUsers(workspaceId) {
  const result = await asanaFetch(`/workspaces/${workspaceId}/users?opt_fields=name,email,photo`);
  return result.data;
}

/**
 * Get all tags in a workspace
 */
export async function getTags(workspaceId) {
  const result = await asanaFetch(`/workspaces/${workspaceId}/tags?opt_fields=name,color`);
  return result.data;
}

/**
 * Create a new task in a project
 */
export async function createTask({ projectId, name, notes, htmlNotes, workspaceId, assignee, dueDate, tags, customFields }) {
  const taskData = {
    name,
    projects: [projectId],
    workspace: workspaceId,
  };

  // Use HTML notes if provided, otherwise plain text
  if (htmlNotes) {
    taskData.html_notes = htmlNotes;
  } else if (notes) {
    taskData.notes = notes;
  }

  // Add optional fields
  if (assignee) {
    taskData.assignee = assignee;
  }
  if (dueDate) {
    taskData.due_on = dueDate; // Format: YYYY-MM-DD
  }
  if (tags && tags.length > 0) {
    taskData.tags = tags;
  }
  if (customFields && Object.keys(customFields).length > 0) {
    taskData.custom_fields = customFields;
  }

  const result = await asanaFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: taskData }),
  });
  return result.data;
}

/**
 * Upload an attachment to a task
 */
export async function uploadAttachment(taskId, file, filename) {
  const token = await getToken();

  if (!token) {
    throw new Error('Token Asana non configuré');
  }

  const formData = new FormData();
  formData.append('file', file, filename);

  const response = await fetch(`${ASANA_API_BASE}/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Don't set Content-Type header - browser will set it with boundary for FormData
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.errors?.[0]?.message || `Upload error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the permalink URL for a task
 */
export function getTaskUrl(taskId) {
  return `https://app.asana.com/0/0/${taskId}`;
}

/**
 * Search for tasks in a workspace
 */
export async function searchTasks(workspaceId, query) {
  if (!query || query.length < 2) return [];

  const result = await asanaFetch(
    `/workspaces/${workspaceId}/typeahead?resource_type=task&query=${encodeURIComponent(query)}&opt_fields=name,completed,assignee.name,projects.name`
  );
  return result.data;
}

/**
 * Add a comment (story) to a task
 * @param {string} taskId - Task ID
 * @param {string} text - Plain text (fallback)
 * @param {string} htmlText - HTML formatted text (optional)
 */
export async function addComment(taskId, text, htmlText = null) {
  const data = htmlText ? { html_text: htmlText } : { text };

  const result = await asanaFetch(`/tasks/${taskId}/stories`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
  return result.data;
}

/**
 * Get custom fields for a project
 */
export async function getProjectCustomFields(projectId) {
  const result = await asanaFetch(`/projects/${projectId}?opt_fields=custom_field_settings.custom_field.name,custom_field_settings.custom_field.type,custom_field_settings.custom_field.enum_options,custom_field_settings.custom_field.resource_subtype`);

  if (!result.data.custom_field_settings) return [];

  return result.data.custom_field_settings.map(setting => ({
    gid: setting.custom_field.gid,
    name: setting.custom_field.name,
    type: setting.custom_field.resource_subtype || setting.custom_field.type,
    enumOptions: setting.custom_field.enum_options || [],
  }));
}

/**
 * Get a task by ID
 */
export async function getTask(taskId) {
  const result = await asanaFetch(`/tasks/${taskId}?opt_fields=name,notes,completed,assignee.name,projects.name,permalink_url`);
  return result.data;
}

/**
 * Show browser notification
 */
export function showNotification(title, message, url) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message,
  }, (notificationId) => {
    if (url) {
      // Store URL for click handling
      chrome.storage.local.set({ [`notification_${notificationId}`]: url });
    }
  });
}
