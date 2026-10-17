export const VOICEOVER = "voice/voiceover.mp3";
export const END_SECONDS = 153;

export const scenes = [
  {
    id: "hook",
    start: 0,
    narration:
      "[thoughtful] Every team has that one person... the one who just *knows* how things work. [pause] [curious] So what happens when they leave? [short pause] [confidently] Tribal tells you... before it happens.",
  },
  {
    id: "problem",
    start: 10.5,
    narration:
      "[softly] Knowledge lives in people's heads. Who wrote the parser. Why the planner works the way it does. Which pull requests are still... waiting on them. [sighs] None of it is in the docs. [whispers] And it walks out the door with them.",
  },
  {
    id: "graph",
    start: 23.8,
    narration:
      "[upbeat] So Tribal reads a GitHub repository into a Falcor D B graph. [short pause] Here, it's FalkorDB's very own repo. People. Commits. Files. Pull requests, issues, docs... [impressed] and the decisions behind them. [pause] Over SIXTEEN THOUSAND nodes... all connected.",
  },
  {
    id: "riskMap",
    start: 41.5,
    narration:
      "[explaining] The risk map scores every component by its bus factor: how many active experts it has. [short pause] Of thirty-five components... nineteen are at risk. [serious] And the parser? [pause] It's down to a SINGLE expert. [lighter] PageRank and betweenness show who's really holding the team together.",
  },
  {
    id: "component",
    start: 57.7,
    narration:
      "[curious] Open any component, and you see who knows it best... [warmly] the decisions that shaped it, each linked to the thread it came from... plus its docs and recent work.",
  },
  {
    id: "simulation",
    start: 67.1,
    narration:
      "[dramatic pause] Now... the real question. [serious] What if Roi Lipman, the top-ranked maintainer, leaves? [short pause] [reassuringly] Don't worry, nothing is deleted. [matter-of-fact] One Cypher query walks the graph and finds every component where they're an expert. [building tension] Twenty components lose an expert. Ten drop to a single person. Eight decisions lose their ONLY owner. [sighs] And forty open pull requests and issues... just stranded. [pause] [relieved] But for every component, Tribal names who should take over.",
  },
  {
    id: "handover",
    start: 96.3,
    narration:
      "[helpful] Then Tribal turns all of that into a handover plan. Who takes over each component, which decisions to walk through, which work to reassign. [short pause] Copy it as markdown, or as issue text. [sarcastically] And no, it won't spam GitHub behind your back... [chuckles] it never posts for you.",
  },
  {
    id: "ask",
    start: 112,
    narration:
      "[casually] Or... just ask. [short pause] [confidently] The agent answers ONLY from graph queries, cites the GitHub source behind every claim, [impressed] and lights up the exact path through the graph it used.",
  },
  {
    id: "mcp",
    start: 122,
    narration:
      "[excited] And the same eight tools run over M C P... [short pause] so Claude Code, Claude Desktop, or Cursor can query the knowledge graph directly.",
  },
  {
    id: "falkordb",
    start: 129.6,
    narration:
      "[proudly] Falcor D B does the heavy lifting. [short pause] Cypher computes expertise, bus factor, and departures. PageRank and betweenness rank the team. [pause] And full-text indexes connect plain questions... straight to the graph.",
  },
  {
    id: "outro",
    start: 143.4,
    narration:
      "[warmly] Tribal. [pause] [softly] Know what breaks... before someone leaves. [upbeat] Built for Graph Hacks, Company Brain track.",
  },
] as const;

export type SceneId = (typeof scenes)[number]["id"];
