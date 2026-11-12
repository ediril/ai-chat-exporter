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

  const problems = {
    sourcesUnavailable: false,
    unlinkedCitations: 0,
    missingImages: 0,
    unknownMarkers: new Set(),
    unknownMessageTypes: new Set()
  };
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

  const notes = [];
  if (problems.sourcesUnavailable) {
    notes.push('Source links could not be read, so citations were left out.');
  }
  if (problems.unlinkedCitations) {
    notes.push(problems.unlinkedCitations + ' citation(s) had no matching source and were left out.');
  }
  if (problems.missingImages) {
    notes.push(problems.missingImages + ' image group(s) had no images available and were left out.');
  }
  if (problems.unknownMarkers.size) {
    notes.push('Unrecognized ChatGPT elements were left out: ' + Array.from(problems.unknownMarkers).join(', ') + '.');
  }
  if (problems.unknownMessageTypes.size) {
    notes.push('Replies of unrecognized types were left out: ' + Array.from(problems.unknownMessageTypes).join(', ') + '.');
  }

  // Notes are recorded in the file and announced before the download starts:
  // an alert fired after the download began never appeared in Chrome.
  if (notes.length) {
    alert('Exported with omissions (the exporter needs updating):\n\n' + notes.join('\n'));
  }

  const title = (data.title || 'ChatGPT conversation').trim();
  const markdown = [
    '# ' + title,
    '',
    'Exported: ' + new Date().toLocaleString(),
    '',
    notes.length ? '**Export notes** (the exporter needs updating):\n\n' + notes.map(function(note) { return '- ' + note; }).join('\n') + '\n' : null,
    blocks.join('\n\n')
  ].filter(function(part) { return part !== null; }).join('\n') + '\n';

  downloadMarkdown(markdown, (filenameFromTitle(title) || 'ChatGPT conversation') + '.md');

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
      const attachments = (Array.isArray(metadata.attachments) ? metadata.attachments : [])
        .map(function(attachment) { return attachment && attachment.name; })
        .filter(Boolean);
      const text = attachments.map(function(name) { return '*Attached: ' + name + '*'; })
        .concat(content.parts.map(function(part) {
          return typeof part === 'string' ? part : (attachments.length ? '' : '[attachment]');
        }))
        .join('\n\n');
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
        ? tidyFallbackMarkdown(dil.fallbackMarkdown)
        : content.parts.filter(function(part) { return typeof part === 'string'; }).join('');
      const reply = {
        sources: sources,
        problems: problems,
        references: referencesByMarker(metadata),
        images: imagesByQuery(dil)
      };
      return normalize(inlineSvg(text).replace(MARKER, function(match, space, body) {
        const rendered = renderMarker(body, reply);
        return rendered ? space + rendered : '';
      }));
    }

    if (
      message.author.role === 'assistant' &&
      message.recipient === 'all' &&
      !['text', 'reasoning_recap', 'thoughts'].includes(content.content_type)
    ) {
      problems.unknownMessageTypes.add(content.content_type);
    }
    return '';
  }

  function renderMarker(body, reply) {
    const fields = body.split(SEP);
    const type = fields[0];
    const args = fields.slice(1);
    const reference = reply.references[OPEN + body + CLOSE];

    if (reference && reference.type === 'hidden') {
      return '';
    }
    if (type === 'cite') {
      return citation(args, reply.sources, reply.problems);
    }
    if (type === 'filecite') {
      if (reference && reference.name) {
        return '(' + reference.name + ')';
      }
      reply.problems.unlinkedCitations++;
      return '';
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
      return imageGroup(groupImages(args[0], reference, reply.images), reply.problems);
    }
    if (type === 'genui') {
      const table = chartTable(args[0]);
      if (table) {
        return table;
      }
    }

    reply.problems.unknownMarkers.add(type);
    return '';
  }

  function referencesByMarker(metadata) {
    const references = {};
    (Array.isArray(metadata.content_references) ? metadata.content_references : []).forEach(function(reference) {
      if (reference && reference.matched_text) {
        references[reference.matched_text] = reference;
      }
    });
    return references;
  }

  function entityName(json) {
    try {
      const name = JSON.parse(json)[1];
      return typeof name === 'string' ? name : '';
    } catch (error) {
      return '';
    }
  }

  // Image searches ChatGPT ran for this reply, keyed by query, from the reply's component results.
  function imagesByQuery(dil) {
    const images = {};
    try {
      Object.values(dil.appData.opGenui.componentResults).forEach(function(component) {
        ((component.state && component.state.images) || []).forEach(function(image) {
          (images[image.image_search_query] = images[image.image_search_query] || []).push(image);
        });
      });
    } catch (error) {
      return {};
    }
    return images;
  }

  // Older chats list an image_group's images in a content reference for the marker. Newer chats
  // name image-search queries in the marker, answered in the reply's component results.
  function groupImages(json, reference, images) {
    if (reference && Array.isArray(reference.images)) {
      return reference.images.map(function(entry) { return entry && entry.image_result; }).filter(Boolean);
    }
    let group = {};
    try {
      group = JSON.parse(json);
    } catch (error) {
      group = {};
    }
    const found = [];
    (Array.isArray(group.query) ? group.query : []).forEach(function(query) {
      found.push.apply(found, (images[query] || []).slice(0, group.num_per_query || undefined));
    });
    return found;
  }

  // Images point at the file "Save image as" would create next to the Markdown file, and link
  // to the hosted copy, so a reader can click through until (or instead of) saving the image.
  function imageGroup(images, problems) {
    const markdown = [];
    images.forEach(function(image) {
      const remote = image.content_url || image.original_content_url;
      const local = remote && savedImageName(remote);
      if (!local) {
        return;
      }
      const alt = (image.title || 'image').replace(/[\[\]\s]+/g, ' ').trim();
      const source = image.url ? ' "Source: ' + cleanUrl(image.url).replace(/"/g, '%22') + '"' : '';
      markdown.push('[![' + alt + '](' + (/[\s()<>]/.test(local) ? '<' + local + '>' : local) + ')](' + remote + source + ')');
    });
    if (!markdown.length) {
      problems.missingImages++;
      return '';
    }
    return '\n\n' + markdown.join('\n\n') + '\n\n';
  }

  // ChatGPT's image host serves extensionless JPEGs, which Chrome saves with a .jpeg extension.
  function savedImageName(url) {
    try {
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
      return /\.[a-z0-9]{2,5}$/i.test(name) ? name : name + '.jpeg';
    } catch (error) {
      return '';
    }
  }

  // A chart becomes a Markdown table of its data, captioned with the chart's title and footer.
  function chartTable(json) {
    try {
      const chart = JSON.parse(json).charts_widget_v2.content;
      const columns = [{ key: chart.xKey, label: chart.xKey.charAt(0).toUpperCase() + chart.xKey.slice(1) }]
        .concat(chart.series.map(function(series) {
          return { key: series.dataKey, label: series.label || series.dataKey };
        }));
      const row = function(cells) {
        return '| ' + cells.map(function(cell) { return String(cell).replace(/\|/g, '\\|'); }).join(' | ') + ' |';
      };
      const table = [row(columns.map(function(column) { return column.label; })), row(columns.map(function() { return '---'; }))]
        .concat(chart.data.map(function(item) {
          return row(columns.map(function(column) { return item[column.key] === undefined ? '' : item[column.key]; }));
        }));
      const meta = chart.meta || {};
      return '\n\n' +
        (typeof meta.title === 'string' ? '**' + meta.title + '**\n\n' : '') +
        table.join('\n') +
        (typeof meta.footer === 'string' ? '\n\n*' + meta.footer + '*' : '') +
        '\n\n';
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

  // ChatGPT's fallback Markdown backslash-escapes ordinary punctuation and turns the big numbers
  // in styled cards into headings (# 1,284). Remove the escapes that cannot change the rendering
  // and make wordless headings bold, leaving code and math (where \: \! \. are LaTeX) alone.
  function tidyFallbackMarkdown(text) {
    return text.split(/(```[\s\S]*?```|`[^`\n]*`|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$)/).map(function(part, index) {
      if (index % 2) {
        return part;
      }
      return part
        .replace(/\\:/g, ':')
        .replace(/\\!(?!\[)/g, '!')
        .replace(/\\\+(?! )/g, '+')
        .replace(/(^[ \t]*\d+)?\\\./gm, function(match, listNumber) {
          return listNumber ? match : '.';
        })
        .replace(/^#{1,6}[ \t]+([^\p{L}\n]*[^\p{L}\s])[ \t]*$/gmu, '**$1**');
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
