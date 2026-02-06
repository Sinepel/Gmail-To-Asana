/**
 * Tiptap Editor configured for Asana-compatible HTML
 * Only allows tags supported by Asana's rich text API
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

/**
 * Create an Asana-compatible Tiptap editor
 * @param {HTMLElement} element - Container element
 * @param {string} content - Initial content (plain text or HTML)
 * @param {object} options - Additional options
 * @returns {Editor} Tiptap editor instance
 */
export function createAsanaEditor(element, content = '', options = {}) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        // Disable unsupported features
        heading: false, // Asana has limited heading support
        codeBlock: false, // Use inline code only
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        history: true,
        // Keep these enabled
        bold: true,
        italic: true,
        strike: true,
        code: true,
        bulletList: true,
        orderedList: true,
        listItem: true,
        blockquote: true,
        hardBreak: true,
        paragraph: true,
        document: true,
        text: true,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: null,
          rel: null,
        },
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'asana-tiptap-editor',
      },
    },
    ...options,
  });

  return editor;
}

/**
 * Convert editor content to Asana-compatible HTML
 * @param {Editor} editor - Tiptap editor instance
 * @returns {string} HTML wrapped in <body> tag for Asana
 */
export function getAsanaHTML(editor) {
  let html = editor.getHTML();

  // Wrap in body tag for Asana
  return `<body>${html}</body>`;
}

/**
 * Convert plain text to HTML for the editor
 * @param {string} text - Plain text content
 * @returns {string} HTML content
 */
export function textToHTML(text) {
  if (!text) return '';

  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert line breaks to paragraphs
  const paragraphs = escaped.split(/\n\n+/);
  return paragraphs
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Export to window for use in content script
window.TiptapAsana = {
  createAsanaEditor,
  getAsanaHTML,
  textToHTML,
};
