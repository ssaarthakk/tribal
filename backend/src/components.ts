import type { RepoConfig, Snapshot } from "./datafiles.js";

const ROOT_COMPONENT = "(root)";

export function componentOf(path: string, config: RepoConfig): string | null {
  if (config.ignorePrefixes.some((prefix) => path.startsWith(prefix))) {
    return null;
  }
  const directories = path.split("/").slice(0, -1);
  if (directories.length === 0) {
    return ROOT_COMPONENT;
  }
  const isDeeper = config.deeperPrefixes.some((prefix) =>
    path.startsWith(`${prefix}/`),
  );
  const depth = config.componentDepth + (isDeeper ? 1 : 0);
  return directories.slice(0, depth).join("/");
}

export function selectComponents(snapshot: Snapshot): string[] {
  const commitCounts = new Map<string, number>();
  for (const commit of snapshot.commits) {
    const touched = new Set<string>();
    for (const file of commit.files) {
      const component = componentOf(file.path, snapshot.config);
      if (component !== null) {
        touched.add(component);
      }
    }
    for (const component of touched) {
      commitCounts.set(component, (commitCounts.get(component) ?? 0) + 1);
    }
  }
  return [...commitCounts]
    .filter(([, count]) => count >= snapshot.config.minComponentCommits)
    .map(([component]) => component)
    .sort();
}

export function componentName(componentPath: string): string {
  return componentPath.split("/").at(-1) ?? componentPath;
}
