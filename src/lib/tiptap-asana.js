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
 * Convert editor content to Asana-compatible HTML/XML
 * @param {Editor} editor - Tiptap editor instance
 * @returns {string} XML wrapped in <body> tag for Asana
 */
export function getAsanaHTML(editor) {
  let html = editor.getHTML();

  // Convert HTML to Asana-compatible XML
  html = convertToAsanaXML(html);

  // Wrap in body tag for Asana
  return `<body>${html}</body>`;
}

/**
 * Convert Tiptap HTML output to Asana-compatible XML
 * Asana supports: strong, em, u, s, code, ol, ul, li, blockquote, a
 * Does NOT support: p, br, div, span
 */
function convertToAsanaXML(html) {
  // Replace <p> tags with line breaks (Asana uses plain text with newlines)
  // Keep content, add newlines between paragraphs
  html = html.replace(/<p>/g, '');
  html = html.replace(/<\/p>/g, '\n');

  // Convert <br> and <br/> to newlines
  html = html.replace(/<br\s*\/?>/g, '\n');

  // Convert <strong> (keep as-is, Asana supports it)
  // Convert <em> (keep as-is, Asana supports it)
  // Convert <u> (keep as-is, Asana supports it)
  // Convert <s> (keep as-is, Asana supports it)
  // Convert <code> (keep as-is, Asana supports it)

  // Ensure self-closing tags are XML compliant
  html = html.replace(/<hr>/g, '<hr/>');
  html = html.replace(/<img([^>]*)>/g, '<img$1/>');

  // Remove empty tags
  html = html.replace(/<(\w+)>\s*<\/\1>/g, '');

  // Clean up multiple newlines
  html = html.replace(/\n{3,}/g, '\n\n');

  // Trim
  html = html.trim();

  return html;
}

/**
 * Convert plain text to HTML for the editor
 * @param {string} text - Plain text content
 * @returns {string} HTML content for Tiptap (uses <p> internally)
 */
export function textToHTML(text) {
  if (!text) return '<p></p>';

  // Escape HTML entities
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert line breaks to paragraphs for Tiptap editor display
  // (will be converted back when exporting to Asana)
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
  convertToAsanaXML,
};
