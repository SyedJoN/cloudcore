import { useCallback, useState } from "react";

const KEY = "gd-recent-searches";

const read = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
};

export function useRecentSearches(max = 8) {
  const [items, setItems] = useState(read);

  const update = useCallback((fn) => {
    setItems((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const add = useCallback(
    (query) => {
      const value = String(query ?? "").trim();
      if (!value) return;
      update((prev) =>
        [value, ...prev.filter((i) => i.toLowerCase() !== value.toLowerCase())].slice(
          0,
          max,
        ),
      );
    },
    [update, max],
  );

  const remove = useCallback(
    (query) => update((prev) => prev.filter((i) => i !== query)),
    [update],
  );

  const clear = useCallback(() => update(() => []), [update]);

  return { items, add, remove, clear };
}