import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";
import { registerMutationDefaults } from "./mutations";

const isBrowser = typeof window !== "undefined";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data first; refetch when online.
        networkMode: "offlineFirst",
        gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
        staleTime: 1000 * 30,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Queue mutations while offline; React Query auto-resumes when online.
        networkMode: "offlineFirst",
        retry: 3,
      },
    },
  });
}

let _client: QueryClient | undefined;
export function getQueryClient(): QueryClient {
  if (!isBrowser) return makeClient();
  if (!_client) {
    _client = makeClient();
    registerMutationDefaults(_client);
  }
  return _client;
}

export const queryPersister: Persister = isBrowser
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: "ginete-cache-v1",
      throttleTime: 1000,
    })
  : {
      // SSR noop persister
      persistClient: async () => {},
      restoreClient: async () => undefined,
      removeClient: async () => {},
    };

// Bridge navigator online/offline to React Query's onlineManager so
// mutations are paused offline and resumed when the connection returns.
if (isBrowser) {
  onlineManager.setEventListener((setOnline) => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  });
}