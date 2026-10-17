export const PING = "RETURN 1 AS one";

export const COUNT_NODES = "MATCH (n) RETURN count(n) AS nodes";

export const COUNT_LABELS =
  "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count";

export const COUNT_RELATIONSHIPS =
  "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count";

export const CREATE_INDEXES = [
  "CREATE INDEX FOR (n:Person) ON (n.id)",
  "CREATE INDEX FOR (n:Component) ON (n.path)",
  "CREATE INDEX FOR (n:File) ON (n.path)",
  "CREATE INDEX FOR (n:Commit) ON (n.sha)",
  "CREATE INDEX FOR (n:PullRequest) ON (n.number)",
  "CREATE INDEX FOR (n:Issue) ON (n.number)",
  "CREATE INDEX FOR (n:Comment) ON (n.id)",
  "CREATE INDEX FOR (n:Doc) ON (n.path)",
  "CREATE INDEX FOR (n:Decision) ON (n.id)",
];

export const CREATE_FULLTEXT_INDEXES = [
  "CALL db.idx.fulltext.createNodeIndex('PullRequest', 'title', 'body')",
  "CALL db.idx.fulltext.createNodeIndex('Issue', 'title', 'body')",
  "CALL db.idx.fulltext.createNodeIndex('Decision', 'summary', 'rationale')",
  "CALL db.idx.fulltext.createNodeIndex('Doc', 'title', 'body')",
];

export const MERGE_PEOPLE = `UNWIND $rows AS row
MERGE (p:Person {id: row.id})
SET p.login = row.login, p.name = row.name`;

export const MERGE_COMPONENTS = `UNWIND $rows AS row
MERGE (c:Component {path: row.path})
SET c.name = row.name, c.bus_factor = 0`;

export const MERGE_FILES = `UNWIND $rows AS row
MERGE (f:File {path: row.path})
WITH f, row
WHERE row.component IS NOT NULL
MATCH (c:Component {path: row.component})
MERGE (f)-[:PART_OF]->(c)`;

export const MERGE_COMMITS = `UNWIND $rows AS row
MERGE (c:Commit {sha: row.sha})
SET c.message = row.message, c.authored_at = row.authoredAt, c.url = row.url
WITH c, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(c)`;

export const MERGE_MODIFIES = `UNWIND $rows AS row
MATCH (c:Commit {sha: row.sha})
MATCH (f:File {path: row.path})
MERGE (c)-[m:MODIFIES]->(f)
SET m.additions = row.additions, m.deletions = row.deletions`;

export const MERGE_PULL_REQUESTS = `UNWIND $rows AS row
MERGE (pr:PullRequest {number: row.number})
SET pr.title = row.title, pr.body = row.body, pr.state = row.state, pr.created_at = row.createdAt, pr.merged_at = row.mergedAt, pr.url = row.url
WITH pr, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(pr)`;

export const MERGE_CONTAINS = `UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MATCH (c:Commit {sha: row.sha})
MERGE (pr)-[:CONTAINS]->(c)`;

export const MERGE_REVIEWS = `UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MATCH (p:Person {id: row.reviewerId})
MERGE (p)-[r:REVIEWED]->(pr)
SET r.state = row.state, r.at = row.at`;

export const MERGE_ISSUES = `UNWIND $rows AS row
MERGE (i:Issue {number: row.number})
SET i.title = row.title, i.body = row.body, i.state = row.state, i.created_at = row.createdAt, i.closed_at = row.closedAt, i.url = row.url
WITH i, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(i)`;

export const MERGE_CLOSES = `UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.prNumber})
MATCH (i:Issue {number: row.issueNumber})
MERGE (pr)-[:CLOSES]->(i)`;

export const MERGE_PR_COMMENTS = `UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MERGE (c:Comment {id: row.id})
SET c.body = row.body, c.created_at = row.createdAt, c.url = row.url
MERGE (c)-[:ON]->(pr)
WITH c, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(c)`;

export const MERGE_ISSUE_COMMENTS = `UNWIND $rows AS row
MATCH (i:Issue {number: row.number})
MERGE (c:Comment {id: row.id})
SET c.body = row.body, c.created_at = row.createdAt, c.url = row.url
MERGE (c)-[:ON]->(i)
WITH c, row
WHERE row.authorId IS NOT NULL
MATCH (p:Person {id: row.authorId})
MERGE (p)-[:AUTHORED]->(c)`;

export const MERGE_DOCS = `UNWIND $rows AS row
MERGE (d:Doc {path: row.path})
SET d.title = row.title, d.body = row.body, d.updated_at = row.updatedAt, d.url = row.url
WITH d, row
UNWIND row.components AS componentPath
MATCH (c:Component {path: componentPath})
MERGE (d)-[:DESCRIBES]->(c)`;

export const MERGE_DECISIONS_IN_PULL_REQUESTS = `UNWIND $rows AS row
MATCH (pr:PullRequest {number: row.number})
MERGE (d:Decision {id: row.id})
SET d.summary = row.summary, d.rationale = row.rationale, d.decided_at = row.decidedAt, d.confidence = row.confidence, d.source_url = pr.url, d.status = 'active'
MERGE (d)-[:DECIDED_IN]->(pr)`;

export const MERGE_DECISIONS_IN_ISSUES = `UNWIND $rows AS row
MATCH (i:Issue {number: row.number})
MERGE (d:Decision {id: row.id})
SET d.summary = row.summary, d.rationale = row.rationale, d.decided_at = row.decidedAt, d.confidence = row.confidence, d.source_url = i.url, d.status = 'active'
MERGE (d)-[:DECIDED_IN]->(i)`;

export const MERGE_MADE = `UNWIND $rows AS row
MATCH (d:Decision {id: row.decisionId})
MATCH (p:Person {id: row.personId})
MERGE (p)-[:MADE]->(d)`;

export const MERGE_AFFECTS = `UNWIND $rows AS row
MATCH (d:Decision {id: row.decisionId})
MATCH (c:Component {path: row.componentPath})
MERGE (d)-[:AFFECTS]->(c)`;

export const MERGE_SUPERSEDES = `UNWIND $rows AS row
MATCH (n:Decision {id: row.newId})
MATCH (o:Decision {id: row.oldId})
MERGE (n)-[:SUPERSEDES]->(o)`;

export const SET_DECISION_STATUS = `MATCH (d:Decision)
OPTIONAL MATCH (:Decision)-[s:SUPERSEDES]->(d)
WITH d, count(s) AS newer
SET d.status = CASE WHEN newer > 0 THEN 'superseded' ELSE 'active' END`;

export const COMPONENT_RECENT_PULL_REQUESTS = `MATCH (pr:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(:Component {path: $path})
WITH DISTINCT pr
RETURN pr.number AS number, pr.title AS title, pr.url AS url, pr.created_at AS createdAt
ORDER BY createdAt DESC, number DESC
LIMIT $limit`;
