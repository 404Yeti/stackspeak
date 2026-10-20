/** Small lexical highlighter, not a parser. React escapes every token. Never HTML. */
export function HighlightedCode({ code }: { code: string }) {
  const tokens = code.split(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\/\/[^\n]*|\b(?:def|for|in|return|if|is|None|True|False|var|new|foreach|public|async|await|string|int|using)\b|\b\d+\b)/g,
  );
  return (
    <>
      {tokens.map((token, i) => {
        const kind = /^["']/.test(token)
          ? "text-success"
          : /^(#|\/\/)/.test(token)
            ? "text-text-muted"
            : /^\d+$/.test(token)
              ? "text-info"
              : /^(def|for|in|return|if|is|None|True|False|var|new|foreach|public|async|await|string|int|using)$/.test(
                    token,
                  )
                ? "text-accent-soft"
                : "";
        return (
          <span key={i} className={kind}>
            {token}
          </span>
        );
      })}
    </>
  );
}
