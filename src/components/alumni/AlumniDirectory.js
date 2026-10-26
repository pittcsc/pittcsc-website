import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, navigate } from "gatsby";
import { getAuthClient } from "../../lib/auth/client";
import { createAccountClient } from "../../lib/account/client.mjs";
import {
  ALUMNI_BASE,
  directoryFilters,
  directorySearch,
  directoryReturn,
} from "../../lib/alumni/directory.mjs";
import AlumniCard from "./AlumniCard";
import AlumniFilters from "./AlumniFilters";
import AlumniDetail from "./AlumniDetail";
import "../../styles/alumni.scss";

// The port keeps the original display components; CRM owns routing and sessions.
export default function AlumniDirectory({ identity, revalidate, location }) {
  const request = useMemo(
    () =>
      createAccountClient({
        getClient: getAuthClient,
        apiURL: process.env.GATSBY_API_URL,
      }),
    [],
  );
  const match = location.pathname.match(
    /^\/dashboard\/alumni\/([a-fA-F0-9-]+)\/?$/,
  );
  const detailID = match?.[1];
  const list = /^\/dashboard\/alumni\/?$/.test(location.pathname);
  const returnTo = directoryReturn(
    location.state?.returnTo || ALUMNI_BASE + location.search,
  );
  const listSearch = detailID
    ? new URL(returnTo, "https://csc.invalid").search
    : location.search;
  const filters = useMemo(() => directoryFilters(listSearch), [listSearch]);
  const search = directorySearch(filters);
  const [loadedData, setData] = useState(null),
    [loadedKey, setLoadedKey] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const loadKey = detailID ? `detail:${detailID}` : `list:${search}`;
  const data = loadedKey === loadKey ? loadedData : null;
  const pageRef = useRef(1),
    scroll = useRef(0),
    restore = useRef(false),
    loadingRef = useRef(false),
    queryRef = useRef(search);
  const sentinel = useRef(null);
  const updateFilters = useCallback((next) => {
    void navigate(ALUMNI_BASE + directorySearch(next), { replace: true });
  }, []);
  const updateSearch = useCallback(
    (value) => updateFilters({ ...filters, search: value }),
    [filters, updateFilters],
  );
  useEffect(() => {
    if (queryRef.current !== search) {
      queryRef.current = search;
      pageRef.current = 1;
      setPage(1);
      scroll.current = 0;
      restore.current = false;
      setData(null);
    }
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    setLoading(true);
    loadingRef.current = true;
    const load = async () => {
      if (!list && !detailID)
        throw new Error("This AlumniDB page does not exist.");
      if (detailID)
        return request(`/alumni/${detailID}`, {
          userID: identity.id,
          signal: controller.signal,
        });
      // Reload permitted data on return; keep only filters/page/position in memory.
      const count = queryRef.current === search ? pageRef.current : 1;
      let result;
      for (let n = 1; n <= count; n++) {
        const params = new URLSearchParams(search);
        params.set("page", String(n));
        const next = await request(`/alumni?${params}`, {
          userID: identity.id,
          signal: controller.signal,
        });
        result = result
          ? { ...next, data: [...result.data, ...next.data] }
          : next;
        if (!next.hasMore) break;
      }
      return result;
    };
    load()
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setLoadedKey(loadKey);
          if (list && restore.current) {
            requestAnimationFrame(() => window.scrollTo(0, scroll.current));
            restore.current = false;
          }
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message);
          if (failure.status === 401 || failure.status === 403)
            void revalidate();
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          loadingRef.current = false;
        }
      });
    return () => controller.abort();
  }, [
    identity.id,
    request,
    detailID,
    list,
    search,
    attempt,
    revalidate,
    loadKey,
  ]);
  // Revalidate visible data on focus, so an unpublished profile is not served
  // from a saved directory cache. No personal records go into sessionStorage.
  useEffect(() => {
    const focus = () => setAttempt((n) => n + 1);
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  const more = useCallback(() => {
    if (loadingRef.current || !data?.hasMore) return;
    // A separate request must also be aborted when filters/route/account change.
    setPage(pageRef.current + 1);
  }, [data?.hasMore]);
  useEffect(() => {
    if (page <= pageRef.current || !list) return;
    const controller = new AbortController();
    loadingRef.current = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams(search);
    params.set("page", String(page));
    request(`/alumni?${params}`, {
      userID: identity.id,
      signal: controller.signal,
    })
      .then((next) => {
        if (controller.signal.aborted) return;
        pageRef.current = page;
        setData((old) => ({
          ...next,
          data: [...(old?.data || []), ...next.data].filter(
            (v, i, a) => a.findIndex((x) => x.id === v.id) === i,
          ),
        }));
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message);
          setPage(pageRef.current);
          if (failure.status === 401 || failure.status === 403) {
            setData(null);
            void revalidate();
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
      loadingRef.current = false;
    };
  }, [page, list, search, request, identity.id, revalidate]);
  useEffect(() => {
    if (
      !list ||
      !data?.hasMore ||
      loading ||
      error ||
      !sentinel.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void more();
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [data, loading, error, list, more]);
  if (detailID && data && !loading && !error)
    return (
      <div className="csc-alumni">
        <AlumniDetail
          alumni={data}
          request={request}
          userID={identity.id}
          onBack={() => {
            restore.current = true;
            void navigate(returnTo);
          }}
        />
      </div>
    );
  return (
    <section className="csc-alumni" aria-label="AlumniDB">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-pittDarkNavy mb-2">
          Alumni Directory
        </h1>
        <p className="text-lg text-gray-600">
          Connect with Pitt CSC alumni from around the world.
        </p>
        <Link className="text-pittNavy underline" to="/dashboard/account">
          Manage your AlumniDB profile
        </Link>
      </div>
      {list && (
        <AlumniFilters
          filters={filters}
          onFiltersChange={updateFilters}
          onSearch={updateSearch}
          totalResults={data?.count || 0}
          uniqueLocations={data?.options?.locations || []}
          uniqueCompanies={data?.options?.companies || []}
          uniqueYears={data?.options?.years || []}
        />
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="px-4 py-2 rounded-lg bg-pittNavy text-white"
            onClick={() => {
              setPage(pageRef.current);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
          <Link to={returnTo}>Back to AlumniDB</Link>
        </div>
      )}
      {loading && <p role="status">Loading alumni…</p>}
      {list && data && !data.data.length && !loading && (
        <p>No alumni found. Try adjusting your filters.</p>
      )}
      {list && data && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          onClickCapture={() => {
            scroll.current = window.scrollY;
            restore.current = true;
          }}
        >
          {data.data.map((alumnus) => (
            <AlumniCard
              key={alumnus.id}
              alumnus={alumnus}
              request={request}
              userID={identity.id}
              returnTo={ALUMNI_BASE + search}
            />
          ))}
        </div>
      )}
      {list && data?.hasMore && (
        <div ref={sentinel} className="mt-8">
          <button
            className="px-4 py-2 rounded-lg bg-pittNavy text-white disabled:opacity-50"
            disabled={loading}
            onClick={() => void more()}
          >
            Load more alumni
          </button>
        </div>
      )}
    </section>
  );
}
