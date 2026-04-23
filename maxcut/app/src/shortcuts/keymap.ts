import { useEffect } from "react";
import { useStore, useTemporal } from "@/project/store";

export type ShortcutAction =
  | "playPause"
  | "shuttleBack" | "shuttlePause" | "shuttleForward"
  | "setIn" | "setOut"
  | "nudgeLeft" | "nudgeRight" | "nudgeLeft10" | "nudgeRight10"
  | "syncNudgeLeft" | "syncNudgeRight" | "syncNudgeLeft10" | "syncNudgeRight10"
  | "split" | "splitAudioOnly" | "splitVideoOnly"
  | "extract" | "lift"
  | "duplicate"
  | "copy" | "paste"
  | "selectAll" | "autoAlign" | "clapAlign" | "resyncDrift"
  | "toggleLink" | "detachAudio"
  | "addTrack"
  | "applyFade"
  | "toolSlip" | "toolSlide" | "toolPen" | "toolText" | "toolZeroCross" | "toolRazor"
  | "marker" | "markerPrev" | "markerNext"
  | "phaseInvert"
  | "undo" | "redo"
  | "save" | "saveAs";

export interface Binding {
  action: ShortcutAction;
  label: string;
  combo: string; // human-readable
  match: (e: KeyboardEvent) => boolean;
}

const mod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

export const BINDINGS: Binding[] = [
  { action: "playPause",        label: "Play / pause",      combo: "Space",          match: (e) => e.code === "Space" && !mod(e) && !e.shiftKey },
  { action: "shuttleBack",      label: "Shuttle back",      combo: "J",              match: (e) => e.key === "j" && !mod(e) },
  { action: "shuttlePause",     label: "Shuttle pause",     combo: "K",              match: (e) => e.key === "k" && !mod(e) },
  { action: "shuttleForward",   label: "Shuttle forward",   combo: "L",              match: (e) => e.key === "l" && !mod(e) && !e.shiftKey },

  { action: "setIn",            label: "Set in point",      combo: "I",              match: (e) => e.key === "i" && !mod(e) && !e.shiftKey },
  { action: "setOut",           label: "Set out point",     combo: "O",              match: (e) => e.key === "o" && !mod(e) && !e.shiftKey },

  { action: "nudgeLeft",        label: "Nudge -1 frame",    combo: "←",              match: (e) => e.key === "ArrowLeft" && !e.shiftKey && !mod(e) },
  { action: "nudgeRight",       label: "Nudge +1 frame",    combo: "→",              match: (e) => e.key === "ArrowRight" && !e.shiftKey && !mod(e) },
  { action: "nudgeLeft10",      label: "Nudge -10 frames",  combo: "Shift+←",        match: (e) => e.key === "ArrowLeft" && e.shiftKey && !mod(e) },
  { action: "nudgeRight10",     label: "Nudge +10 frames",  combo: "Shift+→",        match: (e) => e.key === "ArrowRight" && e.shiftKey && !mod(e) },

  { action: "syncNudgeLeft",    label: "Audio sync -1",     combo: ",",              match: (e) => e.key === "," && !e.shiftKey && !mod(e) },
  { action: "syncNudgeRight",   label: "Audio sync +1",     combo: ".",              match: (e) => e.key === "." && !e.shiftKey && !mod(e) },
  { action: "syncNudgeLeft10",  label: "Audio sync -10",    combo: "Shift+,",        match: (e) => e.key === "<" && e.shiftKey && !mod(e) },
  { action: "syncNudgeRight10", label: "Audio sync +10",    combo: "Shift+.",        match: (e) => e.key === ">" && e.shiftKey && !mod(e) },

  { action: "split",            label: "Split at playhead", combo: "C",              match: (e) => e.key === "c" && !mod(e) && !e.altKey && !e.shiftKey },
  { action: "splitAudioOnly",   label: "Split audio only",  combo: "Opt+C",          match: (e) => e.key === "c" && !mod(e) && e.altKey },
  { action: "splitVideoOnly",   label: "Split video only",  combo: "Shift+C",        match: (e) => (e.key === "C" || (e.key === "c" && e.shiftKey)) && !mod(e) },

  { action: "extract",          label: "Extract (ripple)",  combo: "Del",            match: (e) => (e.key === "Backspace" || e.key === "Delete") && !e.altKey && !mod(e) },
  { action: "lift",             label: "Lift (gap)",        combo: "Opt+Del",        match: (e) => (e.key === "Backspace" || e.key === "Delete") && e.altKey && !mod(e) },

  { action: "duplicate",        label: "Duplicate",         combo: "Cmd+D",          match: (e) => mod(e) && (e.key === "d" || e.key === "D") && !e.shiftKey },

  { action: "copy",             label: "Copy",              combo: "Cmd+C",          match: (e) => mod(e) && (e.key === "c" || e.key === "C") && !e.shiftKey },
  { action: "paste",            label: "Paste",             combo: "Cmd+V",          match: (e) => mod(e) && (e.key === "v" || e.key === "V") },

  { action: "selectAll",        label: "Select all",        combo: "Cmd+A",          match: (e) => mod(e) && (e.key === "a" || e.key === "A") && !e.shiftKey },
  { action: "autoAlign",        label: "Waveform align",    combo: "Cmd+Shift+A",    match: (e) => mod(e) && e.shiftKey && (e.key === "a" || e.key === "A") },
  { action: "clapAlign",        label: "Clap align",        combo: "Cmd+Shift+K",    match: (e) => mod(e) && e.shiftKey && (e.key === "k" || e.key === "K") },
  { action: "resyncDrift",      label: "Resync drift",      combo: "Cmd+Shift+R",    match: (e) => mod(e) && e.shiftKey && (e.key === "r" || e.key === "R") },

  { action: "toggleLink",       label: "Toggle link",       combo: "Cmd+L",          match: (e) => mod(e) && (e.key === "l" || e.key === "L") && !e.altKey && !e.shiftKey },
  { action: "detachAudio",      label: "Detach audio",      combo: "Cmd+Opt+L",      match: (e) => mod(e) && e.altKey && (e.key === "l" || e.key === "L") },

  { action: "addTrack",         label: "Add track",         combo: "Cmd+T",          match: (e) => mod(e) && (e.key === "t" || e.key === "T") && !e.shiftKey },
  { action: "applyFade",        label: "Apply fade length", combo: "Cmd+F",          match: (e) => mod(e) && (e.key === "f" || e.key === "F") && !e.shiftKey },

  { action: "toolSlip",         label: "Slip tool",         combo: "Y",              match: (e) => e.key === "y" && !mod(e) },
  { action: "toolSlide",        label: "Slide tool",        combo: "U",              match: (e) => e.key === "u" && !mod(e) },
  { action: "toolPen",          label: "Gain pen",          combo: "P",              match: (e) => e.key === "p" && !mod(e) },
  { action: "toolText",         label: "Text edit",         combo: "T",              match: (e) => e.key === "t" && !mod(e) && !e.shiftKey },
  { action: "toolZeroCross",    label: "Zero-cross snap",   combo: "Z",              match: (e) => e.key === "z" && !mod(e) && !e.shiftKey },
  { action: "toolRazor",        label: "Razor hold",        combo: "C",              match: (e) => e.key === "c" && !mod(e) && !e.shiftKey },

  { action: "marker",           label: "Drop marker",       combo: "M",              match: (e) => e.key === "m" && !mod(e) },
  { action: "markerPrev",       label: "Prev marker",       combo: "↑",              match: (e) => e.key === "ArrowUp" && !mod(e) },
  { action: "markerNext",       label: "Next marker",       combo: "↓",              match: (e) => e.key === "ArrowDown" && !mod(e) },

  { action: "phaseInvert",      label: "Invert phase",      combo: "Shift+I",        match: (e) => e.shiftKey && (e.key === "I" || (e.key === "i" && e.shiftKey)) && !mod(e) },

  { action: "undo",             label: "Undo",              combo: "Cmd+Z",          match: (e) => mod(e) && (e.key === "z" || e.key === "Z") && !e.shiftKey },
  { action: "redo",             label: "Redo",              combo: "Cmd+Shift+Z",    match: (e) => mod(e) && e.shiftKey && (e.key === "z" || e.key === "Z") },

  { action: "save",             label: "Save",              combo: "Cmd+S",          match: (e) => mod(e) && (e.key === "s" || e.key === "S") && !e.shiftKey },
  { action: "saveAs",           label: "Save as",           combo: "Cmd+Shift+S",    match: (e) => mod(e) && e.shiftKey && (e.key === "s" || e.key === "S") },
];

export type ActionHandler = (action: ShortcutAction, e: KeyboardEvent) => void;

export function useShortcuts(handle: ActionHandler): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      for (const b of BINDINGS) {
        if (b.match(e)) {
          e.preventDefault();
          handle(b.action, e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handle]);
}

declare global {
  interface Window {
    __maxcutRazor?: (frame: number) => void;
  }
}

export function useBasicShortcuts(): void {
  const { undo, redo } = useTemporal.getState();
  useShortcuts((action) => {
    const s = useStore.getState();
    switch (action) {
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "playPause": s.setPlaying(!s.playing); break;
      case "nudgeLeft": s.setPlayhead(s.playheadFrame - 1); break;
      case "nudgeRight": s.setPlayhead(s.playheadFrame + 1); break;
      case "nudgeLeft10": s.setPlayhead(s.playheadFrame - 10); break;
      case "nudgeRight10": s.setPlayhead(s.playheadFrame + 10); break;
      case "setIn": s.setInOut(s.playheadFrame, s.outPoint); break;
      case "setOut": s.setInOut(s.inPoint, s.playheadFrame); break;
      case "toolSlip": s.setTool("slip"); break;
      case "toolSlide": s.setTool("slide"); break;
      case "toolPen": s.setTool("pen"); break;
      case "toolText": s.toggleTextEditMode(); break;
      case "toolZeroCross": break;
      case "split":
        if (typeof window !== "undefined" && typeof window.__maxcutRazor === "function") {
          window.__maxcutRazor(s.playheadFrame);
        }
        break;
      default: break;
    }
  });
}
