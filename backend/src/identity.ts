import type { Snapshot } from "./datafiles.js";

export type PersonRow = {
  id: string;
  login: string | null;
  name: string;
};

export type Identities = {
  people: PersonRow[];
  commitAuthor: Map<string, string | null>;
  personIdForLogin(login: string | null): string | null;
};

export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveIdentities(snapshot: Snapshot): Identities {
  const isBotLogin = (login: string | null): boolean =>
    login !== null &&
    (snapshot.bots.includes(login) || login.endsWith("[bot]"));

  const personIdForLogin = (login: string | null): string | null =>
    login !== null && !isBotLogin(login) ? login : null;

  const commits = snapshot.commits.toSorted(
    (a, b) =>
      a.authoredAt.localeCompare(b.authoredAt) || a.sha.localeCompare(b.sha),
  );
  const isBotCommit = (commit: Snapshot["commits"][number]): boolean =>
    isBotLogin(commit.authorLogin) || commit.authorName.endsWith("[bot]");

  const idByEmailHash = new Map<string, string>();
  const idByName = new Map<string, string>();
  for (const commit of commits) {
    if (!isBotCommit(commit) && commit.authorLogin !== null) {
      idByEmailHash.set(commit.authorEmailHash, commit.authorLogin);
      idByName.set(nameKey(commit.authorName), commit.authorLogin);
    }
  }

  const commitAuthor = new Map<string, string | null>();
  const gitIds = new Set<string>();
  for (const commit of commits) {
    if (isBotCommit(commit)) {
      commitAuthor.set(commit.sha, null);
      continue;
    }
    const key = nameKey(commit.authorName);
    let id =
      commit.authorLogin ??
      idByEmailHash.get(commit.authorEmailHash) ??
      idByName.get(key);
    if (id === undefined) {
      id = `git:${commit.authorEmailHash}`;
      gitIds.add(id);
    }
    idByEmailHash.set(commit.authorEmailHash, id);
    idByName.set(key, id);
    commitAuthor.set(commit.sha, id);
  }

  const nameCounts = new Map<string, Map<string, number>>();
  for (const commit of commits) {
    const id = commitAuthor.get(commit.sha) ?? null;
    if (id === null) {
      continue;
    }
    const counts = nameCounts.get(id) ?? new Map<string, number>();
    counts.set(commit.authorName, (counts.get(commit.authorName) ?? 0) + 1);
    nameCounts.set(id, counts);
  }

  const logins = new Set<string>();
  const addLogin = (login: string | null): void => {
    const id = personIdForLogin(login);
    if (id !== null) {
      logins.add(id);
    }
  };
  for (const commit of commits) {
    addLogin(commit.authorLogin);
  }
  for (const pullRequest of snapshot.pullRequests) {
    addLogin(pullRequest.authorLogin);
    for (const review of pullRequest.reviews) {
      addLogin(review.reviewerLogin);
    }
  }
  for (const issue of snapshot.issues) {
    addLogin(issue.authorLogin);
  }
  for (const comment of snapshot.comments) {
    addLogin(comment.authorLogin);
  }

  const people = [...new Set([...logins, ...gitIds])]
    .sort()
    .map((id): PersonRow => {
      const mostFrequentName = [...(nameCounts.get(id) ?? [])].sort(
        ([nameA, countA], [nameB, countB]) =>
          countB - countA || nameA.localeCompare(nameB),
      )[0]?.[0];
      return {
        id,
        login: gitIds.has(id) ? null : id,
        name: mostFrequentName ?? id,
      };
    });

  return { people, commitAuthor, personIdForLogin };
}
