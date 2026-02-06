/**
 * Service Worker - Background script for Gmail to Asana extension
 * Handles API requests to Asana and downloads Gmail attachments
 */

import * as asanaClient from '../lib/asana-client.js';

/**
 * Download a file from Gmail attachment URL
 */
async function downloadGmailAttachment(url) {
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status}`);
  }

  const blob = await response.blob();
  return blob;
}

/**
 * Message handler for content script requests
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));

  // Return true to indicate async response
  return true;
});

/**
 * Handle notification clicks - open the task URL
 */
chrome.notifications.onClicked.addListener(async (notificationId) => {
  const data = await chrome.storage.local.get(`notification_${notificationId}`);
  const url = data[`notification_${notificationId}`];

  if (url) {
    chrome.tabs.create({ url });
    chrome.storage.local.remove(`notification_${notificationId}`);
  }

  chrome.notifications.clear(notificationId);
});

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message) {
  switch (message.type) {
    case 'CHECK_SESSION':
      return await asanaClient.checkSession();

    case 'GET_WORKSPACES':
      return await asanaClient.getWorkspaces();

    case 'GET_PROJECTS':
      return await asanaClient.getProjects(message.workspaceId);

    case 'GET_USERS':
      return await asanaClient.getUsers(message.workspaceId);

    case 'GET_TAGS':
      return await asanaClient.getTags(message.workspaceId);

    case 'CREATE_TASK':
      return await asanaClient.createTask(message.taskData);

    case 'UPLOAD_ATTACHMENT': {
      const { taskId, attachmentUrl, filename } = message;
      const blob = await downloadGmailAttachment(attachmentUrl);
      const result = await asanaClient.uploadAttachment(taskId, blob, filename);
      return result;
    }

    case 'UPLOAD_ATTACHMENT_BASE64': {
      const { taskId, base64Data, mimeType, filename } = message;
      // Convert base64 back to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const result = await asanaClient.uploadAttachment(taskId, blob, filename);
      return result;
    }

    case 'GET_TASK_URL':
      return asanaClient.getTaskUrl(message.taskId);

    case 'SEARCH_TASKS':
      return await asanaClient.searchTasks(message.workspaceId, message.query);

    case 'ADD_COMMENT':
      return await asanaClient.addComment(message.taskId, message.text, message.htmlText);

    case 'GET_PROJECT_CUSTOM_FIELDS':
      return await asanaClient.getProjectCustomFields(message.projectId);

    case 'GET_TASK':
      return await asanaClient.getTask(message.taskId);

    case 'SHOW_NOTIFICATION':
      asanaClient.showNotification(message.title, message.message, message.url);
      return { success: true };

    // Storage for preferences
    case 'SAVE_PREFERENCES':
      await chrome.storage.local.set({ preferences: message.preferences });
      return { success: true };

    case 'GET_PREFERENCES': {
      const data = await chrome.storage.local.get('preferences');
      return data.preferences || {};
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
