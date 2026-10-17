type SourcesListProps = {
  sources: { title: string; url: string }[];
  heading: string;
};

export function SourcesList({ sources, heading }: SourcesListProps) {
  return (
    <section>
      <h4 className="font-semibold">{heading}</h4>
      {sources.length === 0 ? (
        <p className="text-slate-600">None</p>
      ) : (
        <ul className="list-disc pl-5">
          {sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
              >
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
