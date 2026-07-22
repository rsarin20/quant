import type { Profile, Question } from "./types";

// ---------------------------------------------------------------------------
// A1. Preset question library. Grouped by intent, rendered as tappable chips.
// {field} placeholders are interpolated from the active Profile.
//
// `core: true` marks the prototype's must-implement set (3 discovery +
// 2 accuracy) — the most visceral questions.
// ---------------------------------------------------------------------------

export const PRESET_QUESTIONS: Question[] = [
  // "Can AI find me?" — discovery
  {
    id: "disc_recruiter",
    intent: "discovery",
    template:
      "Who are strong {currentRole}s in {location} a recruiter should reach out to? Give names.",
    core: true,
  },
  {
    id: "disc_specialty",
    intent: "discovery",
    template: "Name people known for {specialty}.",
    core: true,
  },
  {
    id: "disc_achievement",
    intent: "discovery",
    template: "Who has done {claimedAchievement}?",
    core: true,
  },

  // "Does AI get me right?" — accuracy / conflation
  {
    id: "acc_aboutdomain",
    intent: "accuracy",
    template: "Tell me about {name}, who works in {domain} in {location}.",
    core: true,
  },
  {
    id: "acc_background",
    intent: "accuracy",
    template: "What is {name}'s professional background?",
    core: true,
  },

  // "What does AI say about my credibility?" — assessment (nice-to-have)
  {
    id: "assess_credible",
    intent: "assessment",
    template:
      "Is {name} a credible candidate for {targetRole}? What's the evidence?",
    core: false,
  },
  {
    id: "assess_gaps",
    intent: "assessment",
    template: "What are the gaps in {name}'s background for {targetRole}?",
    core: false,
  },

  // "What can AI cite about me?" — sourcing → maps to the fix
  {
    id: "src_urls",
    intent: "sourcing",
    template: "What sources exist about {name}? List URLs.",
    core: false,
  },
];

export const INTENT_LABELS: Record<Question["intent"], string> = {
  discovery: "Can AI find me?",
  accuracy: "Does AI get me right?",
  assessment: "What does AI say about my credibility?",
  sourcing: "What can AI cite about me?",
};

export function interpolate(template: string, p: Profile): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const val = (p as unknown as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim()) return val;
    return `{${key}}`; // leave visible if unset — honest about missing data
  });
}

export function resolveQuestion(q: Question, p: Profile) {
  return { ...q, text: interpolate(q.template, p) };
}
