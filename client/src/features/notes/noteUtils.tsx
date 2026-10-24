import React from 'react';

export const POSTIT_COLORS = [
  '#fef08a', // classic yellow
  '#86efac', // mint green
  '#93c5fd', // soft blue
  '#f9a8d4', // soft pink
  '#fdba74', // warm orange
  '#c4b5fd', // lavender
  '#6ee7b7', // seafoam
  '#fca5a5', // coral
];

export function renderFormattedContent(content: string): React.ReactNode {
  if (!content) return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Empty note</span>;

  let textToParse = content;

  // Check if the content is wrapped in a single <p> containing markdown or escaped newlines
  const isSinglePWrapper =
    content.trim().startsWith('<p>') &&
    content.trim().endsWith('</p>') &&
    !content.slice(3, -4).includes('<p>');

  if (isSinglePWrapper) {
    const inner = content.trim().slice(3, -4);
    // If inner has markdown headings or bullet points, extract and treat as markdown
    if (inner.includes('#') || inner.includes(' - ') || inner.includes('##') || inner.includes('*')) {
      textToParse = inner
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\\n/g, '\n')
        .replace(/\s+##\s+/g, '\n\n## ')
        .replace(/\s+#\s+/g, '\n\n# ')
        .replace(/\s+-\s+\*\*/g, '\n- **');
    }
  }

  // Check if the content is rich HTML from the WYSIWYG editor (and not unwrapped markdown)
  if (textToParse.trim().startsWith('<') && (textToParse.includes('</') || textToParse.includes('/>'))) {
    return (
      <div
        className="text-pad-rendered-view cr-rendered-rich-content"
        dangerouslySetInnerHTML={{ __html: textToParse }}
      />
    );
  }

  const lines = textToParse.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = (keyPrefix: string) => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-ul`} style={{ margin: '4px 0 8px 22px', padding: 0 }}>
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const formatInline = (text: string): React.ReactNode => {
    const codeParts = text.split(/(`[^`]+`)/g);
    return codeParts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            style={{
              background: 'rgba(255,255,255,0.12)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '0.86em',
              fontFamily: 'monospace',
              color: '#93c5fd',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bi) => {
        if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length >= 4) {
          return <strong key={`${i}-${bi}`} style={{ color: '#f8fafc' }}>{bPart.slice(2, -2)}</strong>;
        }
        return bPart;
      });
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`flush-${idx}`);
      elements.push(<div key={`br-${idx}`} style={{ height: 6 }} />);
      return;
    }

    if (trimmed.startsWith('# ')) {
      flushList(`h1-${idx}`);
      elements.push(
        <h2 key={`h1-${idx}`} style={{ margin: '8px 0 4px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
          {formatInline(trimmed.slice(2))}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList(`h2-${idx}`);
      elements.push(
        <h3 key={`h2-${idx}`} style={{ margin: '8px 0 4px', fontSize: '1.02rem', color: '#60a5fa', fontWeight: 700 }}>
          {formatInline(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList(`h3-${idx}`);
      elements.push(
        <h4 key={`h3-${idx}`} style={{ margin: '6px 0 3px', fontSize: '0.94rem', color: '#93c5fd', fontWeight: 600 }}>
          {formatInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      inList = true;
      const bulletText = trimmed.slice(2);
      listItems.push(
        <li key={`li-${idx}`} style={{ margin: '3px 0', lineHeight: 1.5, color: '#e2e8f0' }}>
          {formatInline(bulletText)}
        </li>
      );
      return;
    }

    flushList(`p-${idx}`);
    elements.push(
      <p key={`p-${idx}`} style={{ margin: '4px 0 6px', lineHeight: 1.55, color: '#e2e8f0' }}>
        {formatInline(line)}
      </p>
    );
  });

  flushList('final');
  return <div className="text-pad-rendered-view cr-rendered-rich-content">{elements}</div>;
}
