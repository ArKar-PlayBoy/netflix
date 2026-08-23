import { describe, it, expect } from "vitest";
import { parseVtt } from "@/lib/vtt";

describe("parseVtt", () => {
  it("parses hour-based timestamps (the served test format)", () => {
    const cues = parseVtt(
      "WEBVTT\n\n00:00:01.000 --> 00:00:06.000\nThis is a Vionix subtitle test - English track.\n\n00:00:07.000 --> 00:00:12.000\nIf you can read this inside the player, custom subtitles work!\n"
    );
    expect(cues).toEqual([
      { start: 1, end: 6, text: "This is a Vionix subtitle test - English track." },
      { start: 7, end: 12, text: "If you can read this inside the player, custom subtitles work!" },
    ]);
  });

  it("parses minute-based timestamps without hours", () => {
    const cues = parseVtt("WEBVTT\n\n01:02.345 --> 01:05.000\nhello\n");
    expect(cues).toEqual([{ start: 62.345, end: 65, text: "hello" }]);
  });

  it("tolerates a UTF-8 BOM before WEBVTT", () => {
    const cues = parseVtt("\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nhi\n");
    expect(cues).toEqual([{ start: 1, end: 2, text: "hi" }]);
  });

  it("joins multi-line cue text and strips tags/entities", () => {
    const cues = parseVtt(
      "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<i>Hello</i> &amp; welcome\nto the show\n"
    );
    expect(cues).toEqual([{ start: 1, end: 4, text: "Hello & welcome\nto the show" }]);
  });

  it("handles CRLF line endings", () => {
    const cues = parseVtt("WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nhi\r\n");
    expect(cues).toEqual([{ start: 1, end: 2, text: "hi" }]);
  });

  it("ignores NOTE blocks and cue settings", () => {
    const cues = parseVtt(
      "WEBVTT\n\nNOTE this is a comment\n\n00:00:01.000 --> 00:00:02.000 position:50% line:0\nhi\n"
    );
    expect(cues).toEqual([{ start: 1, end: 2, text: "hi" }]);
  });

  it("skips cues with empty bodies", () => {
    const cues = parseVtt("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n\n00:00:03.000 --> 00:00:04.000\nreal\n");
    expect(cues).toEqual([{ start: 3, end: 4, text: "real" }]);
  });

  it("returns empty array for garbage input", () => {
    expect(parseVtt("not a vtt file at all")).toEqual([]);
    expect(parseVtt("")).toEqual([]);
  });
});
