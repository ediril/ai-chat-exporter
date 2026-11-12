/**
 * ChatGPT Markdown Exporter Bookmarklet
 *
 * This bookmarklet exports ChatGPT conversations to a Markdown file.
 * It reads the conversation from ChatGPT's own conversation endpoint,
 * so the export includes messages the page has not loaded yet.
 */

javascript:(async function() {
  const OPEN = String.fromCharCode(0xE200);
  const SEP = String.fromCharCode(0xE202);
  const CLOSE = String.fromCharCode(0xE201);
  const MARKER = new RegExp('( ?)' + OPEN + '([^' + CLOSE + ']*)' + CLOSE, 'g');

  const conversationId = (location.pathname.match(/\/c\/([^/?#]+)/) || [])[1];
  if (!location.hostname.endsWith('chatgpt.com') || !conversationId) {
    alert('Open a ChatGPT conversation on chatgpt.com first.');
    return;
  }

  let data;
  try {
    const session = await fetchJson('/api/auth/session');
    data = await fetchJson('/backend-api/conversation/' + conversationId, {
      headers: { Authorization: 'Bearer ' + session.accessToken }
    });
  } catch (error) {
    alert('Could not load this conversation from ChatGPT (' + error.message + ').');
    return;
  }

  const problems = { sourcesUnavailable: false, unlinkedCitations: 0, unknownMarkers: new Set() };
  let sources = {};
  try {
    sources = collectSources(data);
  } catch (error) {
    problems.sourcesUnavailable = true;
  }

  let blocks;
  try {
    blocks = currentBranch(data).map(function(message) {
      return messageMarkdown(message, sources, problems);
    }).filter(Boolean);
  } catch (error) {
    alert('ChatGPT\'s conversation format has changed, so this chat could not be exported (' + error.message + ').');
    return;
  }

  if (!blocks.length) {
    alert('No exportable ChatGPT messages found.');
    return;
  }

  const title = (data.title || 'ChatGPT conversation').trim();
  const markdown = [
    '# ' + title,
    '',
    'Exported: ' + new Date().toLocaleString(),
    '',
    blocks.join('\n\n')
  ].join('\n') + '\n';

  downloadMarkdown(markdown, (filenameFromTitle(title) || 'ChatGPT conversation') + '.md');

  const notes = [];
  if (problems.sourcesUnavailable) {
    notes.push('Source links could not be read, so citations were left out.');
  }
  if (problems.unlinkedCitations) {
    notes.push(problems.unlinkedCitations + ' citation(s) had no matching source and were left out.');
  }
  if (problems.unknownMarkers.size) {
    notes.push('Unrecognized ChatGPT elements were left out: ' + Array.from(problems.unknownMarkers).join(', ') + '.');
  }
  if (notes.length) {
    alert('Exported with omissions:\n\n' + notes.join('\n'));
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' from ' + url);
    }
    return response.json();
  }

  function currentBranch(data) {
    const messages = [];
    for (let id = data.current_node; id; id = data.mapping[id].parent) {
      if (data.mapping[id].message) {
        messages.unshift(data.mapping[id].message);
      }
    }
    return messages;
  }

  function collectSources(data) {
    const sources = {};
    Object.values(data.mapping).forEach(function(node) {
      const metadata = node.message && node.message.metadata;
      ((metadata && metadata.search_result_groups) || []).forEach(function(group) {
        (group.entries || []).forEach(function(entry) {
          const ref = entry.ref_id;
          if (ref && entry.url) {
            sources['turn' + ref.turn_index + ref.ref_type + ref.ref_index] = {
              url: entry.url,
              label: entry.source_name || entry.attribution || new URL(entry.url).hostname
            };
          }
        });
      });
    });
    return sources;
  }

  function messageMarkdown(message, sources, problems) {
    const metadata = message.metadata || {};
    const content = message.content || {};
    if (metadata.is_visually_hidden_from_conversation) {
      return '';
    }

    if (message.author.role === 'user' && ['text', 'multimodal_text'].includes(content.content_type)) {
      const text = content.parts.map(function(part) {
        return typeof part === 'string' ? part : '[attachment]';
      }).join('\n\n');
      return text.trim() ? quote(normalize(text)) : '';
    }

    if (
      message.author.role === 'assistant' &&
      message.recipient === 'all' &&
      content.content_type === 'text' &&
      !metadata.is_thinking_preamble_message
    ) {
      const dil = metadata.model_dil_v2;
      const text = dil && typeof dil.fallbackMarkdown === 'string'
        ? unescapeMarkdown(dil.fallbackMarkdown)
        : content.parts.filter(function(part) { return typeof part === 'string'; }).join('');
      return normalize(inlineSvg(text).replace(MARKER, function(match, space, body) {
        const rendered = renderMarker(body.split(SEP), sources, problems);
        return rendered ? space + rendered : '';
      }));
    }

    return '';
  }

  function renderMarker(fields, sources, problems) {
    const type = fields[0];
    const args = fields.slice(1);

    if (type === 'cite') {
      return citation(args, sources, problems);
    }
    if (type === 'entity') {
      const name = entityName(args[0]);
      if (name) {
        return name;
      }
    }
    if (type === 'url' && /^https?:\/\//.test(args[1] || '')) {
      return '[' + (args[0] || args[1]).replace(/[\[\]]/g, '') + '](' + cleanUrl(args[1]) + ')';
    }
    if (type === 'image_group') {
      return '';
    }

    problems.unknownMarkers.add(type);
    return '';
  }

  function entityName(json) {
    try {
      const name = JSON.parse(json)[1];
      return typeof name === 'string' ? name : '';
    } catch (error) {
      return '';
    }
  }

  function citation(refIds, sources, problems) {
    if (problems.sourcesUnavailable) {
      return '';
    }
    const links = [];
    refIds.forEach(function(refId) {
      const source = sources[refId];
      if (!source) {
        problems.unlinkedCitations++;
        return;
      }
      const link = '[' + source.label.replace(/[\[\]]/g, '') + '](' + cleanUrl(source.url) + ')';
      if (!links.includes(link)) {
        links.push(link);
      }
    });
    return links.length ? '(' + links.join(', ') + ')' : '';
  }

  // ChatGPT's fallback Markdown backslash-escapes ordinary punctuation. Remove the escapes
  // that cannot change the rendering, leaving code and math (where \: \! \. are LaTeX) alone.
  function unescapeMarkdown(text) {
    return text.split(/(```[\s\S]*?```|`[^`\n]*`|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$)/).map(function(part, index) {
      if (index % 2) {
        return part;
      }
      return part
        .replace(/\\:/g, ':')
        .replace(/\\!(?!\[)/g, '!')
        .replace(/(^[ \t]*\d+)?\\\./gm, function(match, listNumber) {
          return listNumber ? match : '.';
        });
    }).join('');
  }

  // ChatGPT draws ```svg blocks as diagrams. Unfence them so Markdown editors that render
  // HTML show the diagram; a blank line inside would end the HTML block early.
  function inlineSvg(text) {
    return text.replace(/```svg\n(<svg[\s\S]*?<\/svg>)\s*\n```/g, function(match, svg) {
      return svg.replace(/\n\s*\n/g, '\n');
    });
  }

  function normalize(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function quote(text) {
    return text.split('\n').map(function(line) {
      return line.trim() ? '> ' + line : '>';
    }).join('\n');
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

  function cleanUrl(value) {
    try {
      const url = new URL(value);
      const toRemove = [];
      url.searchParams.forEach(function(v, k) {
        if (/^utm_|^fbclid|^gclid|^msclkid|^mc_|^_ga|^trk$|^ref$|^referrer$|^source$|^campaign/i.test(k)) {
          toRemove.push(k);
        }
      });
      toRemove.forEach(function(k) {
        url.searchParams.delete(k);
      });
      return url.toString();
    } catch (error) {
      return value;
    }
  }
})();
