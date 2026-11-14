import { describe, expect, it } from "vitest";
import { audioStoragePath, mergeGameData, normalizeGameData } from "./sync";
import type { Conversation, GameData } from "./types";

const conv = (id: string, title: string): Conversation => ({
  id,
  title,
  lines: [{ id: `${id}-l`, speaker: "him", text: "Hi", translation: "Hola", expression: "talk" }],
});
const data = (convs: Conversation[], him = "Leo"): GameData => ({ version: 1, names: { him, her: "Sofi" }, conversations: convs });

describe("cloud storage rules", () => {
  it("stores every file inside the owner's own folder", () => {
    expect(audioStoragePath("user-1", "recording", "rec_abc", "webm")).toBe("user-1/recording/rec_abc.webm");
    expect(audioStoragePath("user-1", "line", "../evil", "mp3").startsWith("user-1/line/")).toBe(true);
    expect(audioStoragePath("user-1", "line", "../evil", "mp3")).not.toContain("..");
  });

  it("falls back to the sample conversations when the cloud row is empty", () => {
    expect(normalizeGameData(null).conversations.length).toBeGreaterThan(0);
    expect(normalizeGameData({ conversations: [] }).conversations.length).toBeGreaterThan(0);
  });
});

describe("saving from two devices at once", () => {
  const base = data([conv("a", "A"), conv("b", "B")]);

  it("keeps the edits of both devices when they touched different conversations", () => {
    const local = data([conv("a", "A edited here"), conv("b", "B")]);
    const remote = data([conv("a", "A"), conv("b", "B edited there")]);
    const merged = mergeGameData(base, local, remote);
    expect(merged.conversations.map((c) => c.title)).toEqual(["A edited here", "B edited there"]);
  });

  it("keeps conversations created on either device", () => {
    const local = data([...base.conversations, conv("c", "New here")]);
    const remote = data([...base.conversations, conv("d", "New there")]);
    const ids = mergeGameData(base, local, remote).conversations.map((c) => c.id);
    expect(ids).toEqual(["a", "b", "d", "c"]);
  });

  it("a conversation deleted on this device stays deleted if nobody else edited it", () => {
    const local = data([conv("a", "A")]);
    const merged = mergeGameData(base, local, base);
    expect(merged.conversations.map((c) => c.id)).toEqual(["a"]);
  });

  it("a name changed on this device is kept", () => {
    const merged = mergeGameData(base, data(base.conversations, "Max"), base);
    expect(merged.names.him).toBe("Max");
  });
});
