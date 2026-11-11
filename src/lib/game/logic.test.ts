import { describe, expect, it } from "vitest";
import { advance, appendLine, insertReply, moveLine, nextConversationIndex, oppositeSpeaker } from "./logic";
import type { Conversation } from "./types";

const conv: Conversation = {
  id: "c",
  title: "t",
  lines: [
    { id: "a", speaker: "him", text: "Hello!", translation: "¡Hola!", expression: "wave" },
    { id: "b", speaker: "her", text: "Hi!", translation: "¡Hola!", expression: "talk" },
  ],
};

describe("conversation rules", () => {
  it("a reply is spoken by the other character", () => {
    expect(oppositeSpeaker("him")).toBe("her");
    const next = insertReply(conv, "a", "r");
    expect(next.lines.map((l) => l.id)).toEqual(["a", "r", "b"]);
    expect(next.lines[1].speaker).toBe("her");
  });

  it("new lines alternate speakers", () => {
    expect(appendLine(conv, "n").lines[2].speaker).toBe("him");
    expect(appendLine({ ...conv, lines: [] }, "n").lines[0].speaker).toBe("him");
  });

  it("moving a line swaps it with its neighbour", () => {
    expect(moveLine(conv, "b", -1).lines.map((l) => l.id)).toEqual(["b", "a"]);
    expect(moveLine(conv, "a", -1)).toBe(conv);
  });

  it("the conversation finishes after the last line", () => {
    expect(advance(0, 2)).toEqual({ index: 1, finished: false });
    expect(advance(1, 2)).toEqual({ index: 1, finished: true });
  });

  it("the next conversation wraps to the first one", () => {
    expect(nextConversationIndex(0, 3)).toBe(1);
    expect(nextConversationIndex(2, 3)).toBe(0);
  });
});
