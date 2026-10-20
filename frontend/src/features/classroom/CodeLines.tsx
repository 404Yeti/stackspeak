import { HighlightedCode } from "./HighlightedCode";
/** References apply only to the immutable Read code, never to edited student text. */
export function CodeLines({
  code,
  highlightedLines,
}: {
  code: string;
  highlightedLines: number[];
}) {
  return (
    <>
      {code.split("\n").map((line, index) => (
        <span
          key={index}
          data-code-line={index + 1}
          className={`classroom-code-line ${highlightedLines.includes(index + 1) ? "classroom-line-focused" : ""}`}
        >
          <HighlightedCode code={line || " "} />
        </span>
      ))}
    </>
  );
}
