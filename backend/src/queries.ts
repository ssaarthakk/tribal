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

export const DELETE_KNOWS_ABOUT = "MATCH ()-[k:KNOWS_ABOUT]->() DELETE k";

export const ADD_COMMIT_EXPERTISE = `MATCH (p:Person)-[:AUTHORED]->(c:Commit)-[m:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH p, c, comp, sum(m.additions + m.deletions) AS lines
WITH p, comp, sum($weight * log(1 + lines) / log(2) * 0.5 ^ (($now - c.authored_at) / 86400000.0 / $halfLifeDays)) AS score, max(c.authored_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END`;

export const ADD_AUTHORED_PR_EXPERTISE = `MATCH (p:Person)-[:AUTHORED]->(pr:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, pr, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - pr.created_at) / 86400000.0 / $halfLifeDays)) AS score, max(pr.created_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END`;

export const ADD_REVIEW_EXPERTISE = `MATCH (p:Person)-[r:REVIEWED]->(pr:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, r, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - r.at) / 86400000.0 / $halfLifeDays)) AS score, max(r.at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END`;

export const ADD_PR_COMMENT_EXPERTISE = `MATCH (p:Person)-[:AUTHORED]->(cm:Comment)-[:ON]->(:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, cm, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - cm.created_at) / 86400000.0 / $halfLifeDays)) AS score, max(cm.created_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END`;

export const ADD_ISSUE_COMMENT_EXPERTISE = `MATCH (p:Person)-[:AUTHORED]->(cm:Comment)-[:ON]->(:Issue)<-[:CLOSES]-(:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(comp:Component)
WITH DISTINCT p, cm, comp
WITH p, comp, sum($weight * 0.5 ^ (($now - cm.created_at) / 86400000.0 / $halfLifeDays)) AS score, max(cm.created_at) AS lastActive
MERGE (p)-[k:KNOWS_ABOUT]->(comp)
ON CREATE SET k.score = 0.0, k.last_active = 0
SET k.score = k.score + score, k.last_active = CASE WHEN lastActive > k.last_active THEN lastActive ELSE k.last_active END`;

export const MARK_EXPERTS = `MATCH (:Person)-[k:KNOWS_ABOUT]->(comp:Component)
WITH comp, sum(k.score) AS total
MATCH (:Person)-[k:KNOWS_ABOUT]->(comp)
SET k.share = k.score / total, k.expert = (k.score / total >= $expertShare AND k.last_active >= $now - $activeDays * 86400000)`;

export const SET_BUS_FACTOR = `MATCH (comp:Component)
OPTIONAL MATCH (p:Person)-[:KNOWS_ABOUT {expert: true}]->(comp)
WITH comp, count(p) AS experts
SET comp.bus_factor = experts`;

export const LIST_COMPONENTS = `MATCH (c:Component)
RETURN c.path AS path, c.name AS name, c.bus_factor AS busFactor
ORDER BY busFactor, path`;

export const RISK_MAP_LINKS = `MATCH (p:Person)-[k:KNOWS_ABOUT]->(c:Component)
WHERE k.share >= $minShare
RETURN p.id AS personId, p.login AS login, p.name AS name, c.path AS componentPath, k.score AS score, k.share AS share, k.expert AS expert
ORDER BY componentPath, score DESC`;

export const GET_COMPONENT = `MATCH (c:Component {path: $path})
RETURN c.path AS path, c.name AS name, c.bus_factor AS busFactor`;

export const COMPONENT_EXPERTS = `MATCH (p:Person)-[k:KNOWS_ABOUT]->(c:Component {path: $path})
RETURN p.id AS id, p.login AS login, p.name AS name, k.score AS score, k.share AS share, k.last_active AS lastActive, k.expert AS expert
ORDER BY score DESC, id
LIMIT $limit`;

export const COMPONENT_DECISIONS = `MATCH (d:Decision)-[:AFFECTS]->(:Component {path: $path})
OPTIONAL MATCH (m:Person)-[:MADE]->(d)
OPTIONAL MATCH (d)-[:SUPERSEDES]->(old:Decision)
RETURN d.id AS id, d.summary AS summary, d.rationale AS rationale, d.status AS status, d.decided_at AS decidedAt, d.source_url AS sourceUrl, collect(DISTINCT m.id) AS madeBy, collect(DISTINCT old.id) AS supersedes
ORDER BY decidedAt, id`;

export const COMPONENT_DOCS = `MATCH (d:Doc)-[:DESCRIBES]->(:Component {path: $path})
RETURN d.path AS path, d.title AS title, d.url AS url, d.updated_at AS updatedAt
ORDER BY path`;

export const PERSON_COMPONENTS = `MATCH (:Person {id: $personId})-[k:KNOWS_ABOUT]->(c:Component)
RETURN c.path AS componentPath, k.score AS score, k.share AS share, k.last_active AS lastActive, k.expert AS expert
ORDER BY score DESC, componentPath`;

export const PERSON_DECISIONS = `MATCH (:Person {id: $personId})-[:MADE]->(d:Decision)
OPTIONAL MATCH (m:Person)-[:MADE]->(d)
OPTIONAL MATCH (d)-[:SUPERSEDES]->(old:Decision)
RETURN d.id AS id, d.summary AS summary, d.rationale AS rationale, d.status AS status, d.decided_at AS decidedAt, d.source_url AS sourceUrl, collect(DISTINCT m.id) AS madeBy, collect(DISTINCT old.id) AS supersedes
ORDER BY decidedAt, id`;

export const DELETE_COLLABORATION =
  "MATCH ()-[x:COLLABORATES_WITH]->() DELETE x";

export const ADD_REVIEW_COLLABORATION = `MATCH (a:Person)-[:REVIEWED]->(pr:PullRequest)<-[:AUTHORED]-(b:Person)
WHERE a <> b
WITH CASE WHEN a.id < b.id THEN a ELSE b END AS first, CASE WHEN a.id < b.id THEN b ELSE a END AS second, count(pr) AS reviews
MERGE (first)-[x:COLLABORATES_WITH]->(second)
ON CREATE SET x.weight = 0.0
SET x.weight = x.weight + reviews
MERGE (second)-[y:COLLABORATES_WITH]->(first)
ON CREATE SET y.weight = 0.0
SET y.weight = y.weight + reviews`;

export const ADD_SHARED_EXPERTISE_COLLABORATION = `MATCH (a:Person)-[:KNOWS_ABOUT {expert: true}]->(c:Component)<-[:KNOWS_ABOUT {expert: true}]-(b:Person)
WHERE a.id < b.id
WITH a, b, count(c) AS shared
MERGE (a)-[x:COLLABORATES_WITH]->(b)
ON CREATE SET x.weight = 0.0
SET x.weight = x.weight + $weight * shared
MERGE (b)-[y:COLLABORATES_WITH]->(a)
ON CREATE SET y.weight = 0.0
SET y.weight = y.weight + $weight * shared`;

export const TEAM_PAGERANK = `CALL algo.pageRank('Person', 'COLLABORATES_WITH') YIELD node, score
RETURN node.id AS id, node.login AS login, node.name AS name, score`;

export const TEAM_BETWEENNESS = `CALL algo.betweenness({nodeLabels: ['Person'], relationshipTypes: ['COLLABORATES_WITH'], samplingSize: 1000, samplingSeed: 42}) YIELD node, score
RETURN node.id AS id, score`;

export const NEARBY_COLLABORATORS = `MATCH (x:Person {id: $personId})-[:COLLABORATES_WITH*1..2]->(p:Person)
WHERE p.id <> $personId
WITH DISTINCT x, p
OPTIONAL MATCH (x)-[r:COLLABORATES_WITH]->(p)
RETURN p.id AS id, p.login AS login, p.name AS name, coalesce(r.weight, 0.0) AS weight
ORDER BY weight DESC, id`;

export const GET_PERSON = `MATCH (p:Person {id: $personId})
RETURN p.id AS id, p.login AS login, p.name AS name`;

export const OPEN_WORK = `MATCH (:Person {id: $personId})-[:AUTHORED]->(w:PullRequest {state: 'open'})
RETURN 'pr' AS kind, w.number AS number, w.title AS title, w.url AS url
UNION ALL
MATCH (:Person {id: $personId})-[:AUTHORED]->(w:Issue {state: 'open'})
RETURN 'issue' AS kind, w.number AS number, w.title AS title, w.url AS url`;

export const DEPARTURE_COMPONENTS = `MATCH (x:Person {id: $personId})-[kx:KNOWS_ABOUT {expert: true}]->(c:Component)
OPTIONAL MATCH (o:Person)-[:KNOWS_ABOUT {expert: true}]->(c)
WHERE o <> x
WITH c, count(o) AS after
RETURN c.path AS path, c.bus_factor AS before, after
ORDER BY after, path`;

export const DEPARTURE_SUCCESSORS = `UNWIND $paths AS path
MATCH (p:Person)-[k:KNOWS_ABOUT]->(:Component {path: path})
WHERE p.id <> $personId
WITH path, p, k
ORDER BY k.score DESC, p.id
WITH path, collect({id: p.id, login: p.login, name: p.name, score: k.score, lastActive: k.last_active})[0..3] AS successors
RETURN path, successors`;

export const DEPARTURE_DECISIONS = `MATCH (x:Person {id: $personId})-[:MADE]->(d:Decision {status: 'active'})
OPTIONAL MATCH (o:Person)-[:MADE]->(d)
WHERE o <> x
WITH d, count(o) AS others
WHERE others = 0
OPTIONAL MATCH (d)-[:AFFECTS]->(c:Component)
RETURN d.id AS id, d.summary AS summary, d.source_url AS sourceUrl, d.decided_at AS decidedAt, collect(c.path) AS affects
ORDER BY decidedAt, id`;

export const SEARCH_ALL = `CALL db.idx.fulltext.queryNodes('PullRequest', $query) YIELD node, score
RETURN 'pr' AS kind, toString(node.number) AS key, node.title AS title, node.url AS url, score
ORDER BY score DESC LIMIT 5
UNION ALL
CALL db.idx.fulltext.queryNodes('Issue', $query) YIELD node, score
RETURN 'issue' AS kind, toString(node.number) AS key, node.title AS title, node.url AS url, score
ORDER BY score DESC LIMIT 5
UNION ALL
CALL db.idx.fulltext.queryNodes('Decision', $query) YIELD node, score
RETURN 'decision' AS kind, node.id AS key, node.summary AS title, node.source_url AS url, score
ORDER BY score DESC LIMIT 5
UNION ALL
CALL db.idx.fulltext.queryNodes('Doc', $query) YIELD node, score
RETURN 'doc' AS kind, node.path AS key, node.title AS title, node.url AS url, score
ORDER BY score DESC LIMIT 5`;

export const TOPIC_COMPONENTS = `CALL db.idx.fulltext.queryNodes('PullRequest', $query) YIELD node, score
MATCH (node)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(c:Component)
WITH DISTINCT c, node, score
RETURN c.path AS path, score, node.title AS title, node.url AS url
UNION ALL
CALL db.idx.fulltext.queryNodes('Issue', $query) YIELD node, score
MATCH (node)<-[:CLOSES]-(:PullRequest)-[:CONTAINS]->(:Commit)-[:MODIFIES]->(:File)-[:PART_OF]->(c:Component)
WITH DISTINCT c, node, score
RETURN c.path AS path, score, node.title AS title, node.url AS url
UNION ALL
CALL db.idx.fulltext.queryNodes('Decision', $query) YIELD node, score
MATCH (node)-[:AFFECTS]->(c:Component)
RETURN c.path AS path, score, node.summary AS title, node.source_url AS url
UNION ALL
CALL db.idx.fulltext.queryNodes('Doc', $query) YIELD node, score
MATCH (node)-[:DESCRIBES]->(c:Component)
RETURN c.path AS path, score, node.title AS title, node.url AS url`;
