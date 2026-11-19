import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useDebouncedValue } from "./useDebouncedValue";
import { searchDrive } from "../../apis/resourceApi";

const emptyFilters = () => ({
  types: new Set(),
  people: new Set(),
  modified: "anytime",
});


export function useSearch({ enabled = true, myId } = {}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [owners, setOwners] = useState([]);
  const ownersQueryRef = useRef("");

  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, 300);
  const effectiveQuery = trimmed ? debounced : "";

  const hasFilters =
    filters.types.size > 0 ||
    filters.people.size > 0 ||
    filters.modified !== "anytime";

  const isActive = trimmed.length > 0 || hasFilters;
  const shouldFetch = enabled && (effectiveQuery.length > 0 || hasFilters);

  useEffect(() => {
    if (!shouldFetch) {
      setItems([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");

    searchDrive(
      {
        q: effectiveQuery,
        types: [...filters.types],
        people: [...filters.people],
        modified: filters.modified,
      },
      { signal: controller.signal },
    )
      .then((data) => {
        const next = [...(data.directories ?? []), ...(data.files ?? [])];
        setItems(next);
        setStatus("done");

        const reset = ownersQueryRef.current !== effectiveQuery;
        ownersQueryRef.current = effectiveQuery;

        setOwners((prev) => {
          const map = new Map(reset ? [] : prev.map((o) => [String(o._id), o]));
          for (const item of next) {
            const owner = item.userId;
            if (owner?._id && String(owner._id) !== String(myId)) {
              map.set(String(owner._id), owner);
            }
          }
          return [...map.values()];
        });
      })
      .catch((err) => {
        if (axios.isCancel(err) || controller.signal.aborted) return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [shouldFetch, effectiveQuery, filters, myId]);

  const reset = useCallback(() => {
    setQuery("");
    setFilters(emptyFilters());
    setItems([]);
    setOwners([]);
    setStatus("idle");
    ownersQueryRef.current = "";
  }, []);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    items,
    status,
    owners,
    hasFilters,
    isActive,
    reset,
  };
}