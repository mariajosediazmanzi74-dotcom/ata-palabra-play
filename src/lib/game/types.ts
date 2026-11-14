export type Speaker = "him" | "her";

export type Expression = "talk" | "wave" | "laugh" | "surprised" | "think" | "celebrate" | "point";

export interface DialogueLine {
  id: string;
  speaker: Speaker;
  /** Original text (English). */
  text: string;
  /** Spanish translation. */
  translation: string;
  expression: Expression;
  /** Id of a custom audio blob saved in IndexedDB. When missing, the browser voice reads the text. */
  audioId?: string | null;
  audioName?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  lines: DialogueLine[];
}

export interface GameData {
  version: 1;
  names: Record<Speaker, string>;
  conversations: Conversation[];
}

export interface Recording {
  id: string;
  name: string;
  createdAt: number;
  mime: string;
  durationMs: number;
  lineText?: string | undefined;
  sizeBytes?: number | undefined;
  /** Location of the file in cloud storage. */
  storagePath?: string | undefined;
}

export const EXPRESSIONS: { value: Expression; label: string; emoji: string }[] = [
  { value: "talk", label: "Hablar", emoji: "💬" },
  { value: "wave", label: "Saludar", emoji: "👋" },
  { value: "laugh", label: "Reír", emoji: "😂" },
  { value: "surprised", label: "Sorprenderse", emoji: "😮" },
  { value: "think", label: "Pensar", emoji: "🤔" },
  { value: "celebrate", label: "Celebrar", emoji: "🎉" },
  { value: "point", label: "Señalar", emoji: "👉" },
];
