/**
 * ChatGPT Markdown Exporter Bookmarklet
 *
 * This bookmarklet exports ChatGPT conversations to a Markdown file.
 */

javascript:(function() {
  setTimeout(function() {
    if (!location.hostname.endsWith('chatgpt.com')) {
      alert('Open a ChatGPT conversation on chatgpt.com first.');
      return;
    }

    const main = document.querySelector('main');
    if (!main) {
      alert('ChatGPT chat area not found.');
      return;
    }

    const messageNodes = Array.from(main.querySelectorAll('[data-user-message-bubble], [data-dil-response]'));

    if (!messageNodes.length) {
      alert('ChatGPT messages were not found. The page structure may have changed.');
      return;
    }

    const blocks = messageNodes.map(function(messageNode) {
      const isUser = messageNode.hasAttribute('data-user-message-bubble');
      const clone = messageNode.cloneNode(true);
      cleanupExportFragment(clone);

      const markdown = cleanChatGptMarkdown(nodeToMarkdown(clone, { preserveWhitespace: isUser })).trim();
      return markdown && isUser ? quote(markdown) : markdown;
    }).filter(Boolean);

    if (!blocks.length) {
      alert('No exportable ChatGPT message content found.');
      return;
    }

    const title = getTitle();
    if (!title) {
      alert('ChatGPT conversation title not found.');
      return;
    }

    const markdown = [
      '# ' + title,
      '',
      'Exported: ' + new Date().toLocaleString(),
      '',
      blocks.join('\n\n')
    ].join('\n');

    const filenameBase = filenameFromTitle(title);
    if (!filenameBase) {
      alert('ChatGPT conversation filename could not be created.');
      return;
    }

    downloadMarkdown(markdown, filenameBase + '.md');
  }, 500);

  function getTitle() {
    return document.title
      .replace(/\s*\|\s*ChatGPT\s*$/i, '')
      .replace(/\s*-\s*ChatGPT\s*$/i, '')
      .trim();
  }

  function downloadMarkdown(markdown, filename) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function filenameFromTitle(value) {
    return value
      .trim()
      .replace(/[\s\u0000-\u001F\u007F]+/g, ' ')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/[\. ]+$/g, '');
  }

  function cleanupExportFragment(fragment) {
    fragment.querySelectorAll([
      'button',
      '[data-pill]',
      '[role="menu"]',
      '[role="menubar"]',
      '[role="toolbar"]',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[data-testid*="copy"]',
      '[data-testid*="feedback"]',
      '[data-testid*="share"]',
      '[data-testid*="voice"]',
      '[class*="sr-only"]',
      'input',
      'select',
      'textarea',
      'svg'
    ].join(',')).forEach(function(node) {
      node.remove();
    });
  }

  function cleanChatGptMarkdown(markdown) {
    return markdown
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function nodeToMarkdown(node, context) {
    context = context || {};

    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return childrenToMarkdown(node, context);
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return context.preserveWhitespace ? node.textContent : node.textContent.replace(/\s+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tag = node.tagName.toLowerCase();

    if (['script', 'style', 'button', 'svg', 'textarea', 'input', 'select'].includes(tag)) {
      return '';
    }

    if (node.getAttribute('aria-hidden') === 'true') {
      return '';
    }

    if (
      node.getAttribute('contenteditable') === 'true' ||
      ['menu', 'menubar', 'toolbar', 'textbox'].includes(node.getAttribute('role'))
    ) {
      return '';
    }

    if (tag === 'br') {
      return '\n';
    }

    if (tag === 'pre') {
      const code = node.querySelector('code') || node;
      const language = getCodeLanguage(code);
      const text = code.textContent.replace(/\n+$/g, '');
      const fence = getFence(text);
      return '\n\n' + fence + language + '\n' + text + '\n' + fence + '\n\n';
    }

    if (tag === 'code') {
      return inlineCode(node.textContent);
    }

    if (tag === 'a') {
      const text = childrenToMarkdown(node, context).trim() || node.href;
      return '[' + text.replace(/\]/g, '\\]') + '](' + cleanUrl(node.href) + ')';
    }

    if (tag === 'img') {
      const src = node.currentSrc || node.src || node.getAttribute('src') || '';
      const alt = node.alt.replace(/\s+/g, ' ').trim() || 'image';
      return src ? '\n\n![' + alt.replace(/\]/g, '\\]') + '](' + cleanUrl(src) + ')\n\n' : '';
    }

    if (/^h[1-6]$/.test(tag)) {
      const text = childrenToMarkdown(node, context).trim();
      if (node.closest('[data-d-component="grid"]')) {
        return '\n\n**' + text + '**\n\n';
      }
      return '\n\n' + '#'.repeat(Number(tag.slice(1))) + ' ' + text + '\n\n';
    }

    if (tag === 'p') {
      return '\n\n' + childrenToMarkdown(node, context).trim() + '\n\n';
    }

    if (tag === 'strong' || tag === 'b' || node.hasAttribute('data-d-default-strong')) {
      return '**' + childrenToMarkdown(node, context).trim() + '**';
    }

    if (tag === 'em' || tag === 'i' || node.getAttribute('data-d-font-style') === 'italic') {
      return '*' + childrenToMarkdown(node, context).trim() + '*';
    }

    if (tag === 'blockquote') {
      return '\n\n' + quote(childrenToMarkdown(node, context).trim()) + '\n\n';
    }

    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      const items = Array.from(node.children).filter(function(child) {
        return child.tagName && child.tagName.toLowerCase() === 'li';
      });

      return '\n' + items.map(function(item, index) {
        return listItemToMarkdown(item, ordered, index + 1, context.depth || 0);
      }).join('\n') + '\n';
    }

    if (tag === 'li') {
      return listItemToMarkdown(node, false, 1, context.depth || 0);
    }

    if (tag === 'table') {
      return tableToMarkdown(node);
    }

    if (isBlockElement(tag)) {
      return '\n\n' + childrenToMarkdown(node, context).trim() + '\n\n';
    }

    return childrenToMarkdown(node, context);
  }

  function quote(text) {
    return text.split('\n').map(function(line) {
      return line.trim() ? '> ' + line : '>';
    }).join('\n');
  }

  function childrenToMarkdown(node, context) {
    return Array.from(node.childNodes).map(function(child) {
      return nodeToMarkdown(child, context);
    }).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }

  function listItemToMarkdown(item, ordered, index, depth) {
    const marker = ordered ? index + '. ' : '- ';
    const indent = '  '.repeat(depth);
    const nestedLists = Array.from(item.children).filter(function(child) {
      const tag = child.tagName ? child.tagName.toLowerCase() : '';
      return tag === 'ul' || tag === 'ol';
    });
    const nestedSet = new Set(nestedLists);
    const mainText = Array.from(item.childNodes).map(function(child) {
      if (nestedSet.has(child)) return '';
      return nodeToMarkdown(child, { depth: depth + 1 });
    }).join('').trim();
    const nestedText = nestedLists.map(function(list) {
      return nodeToMarkdown(list, { depth: depth + 1 }).replace(/^\n+|\n+$/g, '');
    }).filter(Boolean).join('\n');

    return indent + marker + mainText + (nestedText ? '\n' + nestedText : '');
  }

  function tableToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll('tr')).map(function(row) {
      return Array.from(row.children).map(function(cell) {
        return childrenToMarkdown(cell, {}).trim().replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
      });
    }).filter(function(row) {
      return row.length > 0;
    });

    if (!rows.length) {
      return '';
    }

    const columnCount = Math.max.apply(null, rows.map(function(row) {
      return row.length;
    }));
    const normalizedRows = rows.map(function(row) {
      while (row.length < columnCount) row.push('');
      return row;
    });
    const header = normalizedRows[0];
    const separator = header.map(function() {
      return '---';
    });
    const body = normalizedRows.slice(1);

    return '\n\n' + [header, separator].concat(body).map(function(row) {
      return '| ' + row.join(' | ') + ' |';
    }).join('\n') + '\n\n';
  }

  function getCodeLanguage(code) {
    const className = code.className || '';
    const match = String(className).match(/language-([a-z0-9_-]+)/i);
    return match ? match[1] : '';
  }

  function getFence(text) {
    const matches = text.match(/`{3,}/g) || [];
    const longest = matches.reduce(function(max, match) {
      return Math.max(max, match.length);
    }, 2);

    return '`'.repeat(longest + 1);
  }

  function inlineCode(text) {
    const trimmed = text.trim();
    const ticks = trimmed.match(/`+/g) || [];
    const longest = ticks.reduce(function(max, tick) {
      return Math.max(max, tick.length);
    }, 0);
    const fence = '`'.repeat(longest + 1);

    return fence + trimmed + fence;
  }

  function cleanUrl(value) {
    try {
      const url = new URL(value);
      const params = url.searchParams;
      const toRemove = [];

      params.forEach(function(v, k) {
        if (/^utm_|^fbclid|^gclid|^msclkid|^mc_|^_ga|^ref$|^referrer$|^source$|^campaign/i.test(k)) {
          toRemove.push(k);
        }
      });

      toRemove.forEach(function(k) {
        params.delete(k);
      });

      return url.toString();
    } catch (e) {
      return value;
    }
  }

  function isBlockElement(tag) {
    return [
      'article',
      'aside',
      'div',
      'figure',
      'figcaption',
      'footer',
      'header',
      'main',
      'nav',
      'section'
    ].includes(tag);
  }
})();
