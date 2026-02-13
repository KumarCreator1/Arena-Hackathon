import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

/**
 * Renders mixed text and LaTeX content.
 * LaTeX content should be wrapped in single $ for inline (e.g., $E=mc^2$)
 * or double $$ for block (e.g., $$E=mc^2$$).
 */
export default function LatexRenderer({ children }) {
    if (!children) return null;

    // Split by $$ then by $
    const parts = splitContent(children);

    return (
        <span>
            {parts.map((part, index) => {
                if (part.type === 'text') return <span key={index}>{part.content}</span>;
                if (part.type === 'inline') return <InlineMath key={index} math={part.content} />;
                if (part.type === 'block') return <BlockMath key={index} math={part.content} />;
                return null;
            })}
        </span>
    );
}

function splitContent(text) {
    if (typeof text !== 'string') return [{ type: 'text', content: String(text) }];

    const result = [];
    // Regex to match $$...$$ or $...$
    // Flag 'g' for global search
    // Capture groups: 1=block, 2=inline
    const regex = /\$\$([\s\S]+?)\$\$|\$([\s\S]+?)\$/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
            result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }

        if (match[1]) {
            // Block math ($$ found)
            result.push({ type: 'block', content: match[1] });
        } else if (match[2]) {
            // Inline math ($ found)
            result.push({ type: 'inline', content: match[2] });
        }

        lastIndex = regex.lastIndex;
    }

    // Remaining text
    if (lastIndex < text.length) {
        result.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return result;
}
