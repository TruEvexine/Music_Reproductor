import { Fragment } from "react";
import { inlineParts, parseBlocks } from "../core/markdown";

/** Texto con `**negrita**` y `código`, como elementos de React (nunca innerHTML). */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) =>
        part.kind === "strong" ? <strong key={index}>{part.text}</strong> : part.kind === "code" ? <code key={index}>{part.text}</code> : <Fragment key={index}>{part.text}</Fragment>,
      )}
    </>
  );
}

/** Los bloques de un texto de docs/producto; `skip` omite los primeros (el título lo pinta quien llama). */
export function Markdown({ text, skip = 0 }: { text: string; skip?: number }) {
  return (
    <>
      {parseBlocks(text).slice(skip).map((block, index) =>
        block.type === "p" ? (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        ) : block.type === "ul" ? (
          <ul key={index}>
            {block.items.map((item) => (
              <li key={item}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-scroll" key={index} role="region" tabIndex={0} aria-label="Tabla">
            <table>
              <thead>
                <tr>
                  {block.head.map((cell) => (
                    <th key={cell} scope="col">
                      <Inline text={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, column) => (
                      <td key={column}>
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </>
  );
}
