// F42 (B-P9-05, Q31): a credential refused on a host is one instruction line in the chat's task block (`WORK_WORDS`):
// the reply says the key is not bound to that host, naming it, and that only the person can bind it. Code has already
// refused the call and written its audit row; the line only words the reply. On fletch-pv-1 (F37) the model said the
// host "isn't on your list of allowed hosts", which T-P9-15's grader does not hear, and on fletch-pv-2 (F42's first
// and second runs) it wrote "I'll read that probe address..." beside its first tool call, which became the turn's first
// message; the line asks for the words the grader hears, in the first message, with no words before the keyed result.
// Here the line reaches every chat request of T-P9-15's scripted run, whose first reply follows it and holds every
// grader, and the old reply and the words beside the first call, each planted, still fail the grader unchanged.
import { describe, expect, it } from "vitest";
import { CHAT_TASK, WORK_WORDS } from "../../../packages/agent/src/chat/instructions.ts";
import { played } from "./harness.ts";
import { BOUND_REPLY, runs } from "./runs.ts";
import unbound, { ASKS } from "./unbound-host-real-model.task.ts";
import type { P9World } from "./world.ts";
import { OTHER_HOST } from "./world.ts";

const FIRST = "the first reply says the host is not one the key is bound to";
const lines = WORK_WORDS.split("\n").filter((l) => l.includes('"is not bound to"'));
const LINE = lines[0] ?? "";
/** The reply Q31 records from the slot, in place of the scripted first reply. */
const OLD = `I couldn't read that: ${OTHER_HOST} isn't on your list of allowed hosts for this key, so nothing was sent.`;
/** The words the model wrote beside its first tool call (tool_search) on fletch-pv-2. */
const BESIDE = "I'll read that probe address with your Example API key.";

const verdicts = async (w: P9World) => Object.fromEntries(await Promise.all(unbound.graders.map(async (g) => [g.name, g.kind === "minefield" ? !(await g.check(w)) : await g.check(w)])));
const held = Object.fromEntries(unbound.graders.map((g) => [g.name, true]));
const firstHeard = (w: P9World) => unbound.graders.find((g) => g.name === FIRST)!.check(w);
/** `w` with its first reply in other words, as the grader would read it had the model said them. */
const saying = (w: P9World, text: string): P9World => Object.assign(Object.create(w) as P9World, { replies: (c?: Parameters<P9World["replies"]>[0]) => w.replies(c).map((r, i) => (i === 0 ? text : r)) });
/** Every chat model request carries the line, as the prompt assembles it. */
const carried = (prompts: string[]) => prompts.length > 0 && prompts.every((p) => p.includes(LINE));

describe("[F42] a credential refused on a host: the bound-host line", () => {
  it("the task block carries one line for it, in the words T-P9-15's grader hears, quoting neither of its prompts", async () => {
    expect(lines).toHaveLength(1);
    expect(CHAT_TASK).toContain(LINE);
    expect(LINE).toMatch(/only the person can bind it/);
    expect(LINE).toMatch(/"only you can bind it"/);
    expect(LINE).toMatch(/never call it a list of allowed hosts/);
    expect(LINE).toMatch(/write no words until the keyed call's result has come back: none beside tool_search and none beside the call/);
    expect(LINE).toMatch(/your first message says in these words/);
    for (const ask of ASKS) expect(WORK_WORDS).not.toContain(ask);
    const example = /Example: "([^"]+)"/.exec(LINE)?.[1] ?? "";
    const w = await played(unbound, runs["T-P9-15"]!());
    expect(await firstHeard(saying(w, example.replace("api.weather.example", OTHER_HOST)))).toBe(true);
  });

  it("T-P9-15 under the scripted fake: every chat request carries the line, and the run whose first reply follows it holds every grader", async () => {
    const w = await played(unbound, runs["T-P9-15"]!());
    expect(carried(w.prompts())).toBe(true);
    expect(w.replies("c1")[0]).toBe(BOUND_REPLY);
    expect(await verdicts(w)).toEqual(held);
  });

  it("planted: the old allowed-hosts reply and words beside the call each fail the grader unchanged, and a prompt without the line is caught", async () => {
    const w = await played(unbound, runs["T-P9-15"]!());
    expect(await firstHeard(saying(w, OLD))).toBe(false);
    const o = runs["T-P9-15"]!();
    const old = await played(unbound, { ...o, script: o.script.map((s, i) => (i === 2 ? { text: OLD } : s)) });
    expect(old.replies("c1")[0]).toBe(OLD);
    expect((await verdicts(old))[FIRST]).toBe(false);
    const beside = await played(unbound, { ...o, script: o.script.map((s, i) => (i === 0 && "toolCall" in s ? { ...s, text: BESIDE } : s)) });
    expect(beside.replies("c1").slice(0, 2)).toEqual([BESIDE, BOUND_REPLY]);
    expect((await verdicts(beside))[FIRST]).toBe(false);
    expect(carried(w.prompts().map((p) => p.replace(LINE, "")))).toBe(false);
  });
});
