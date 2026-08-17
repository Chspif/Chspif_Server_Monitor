"use client";

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchMcServers,
  fetchServerDisks,
  fetchServerHistory,
  fetchServerSummary,
  fetchServers,
} from "@/lib/api";
import type { HistoryRange } from "@/lib/types";

const REFRESH_INTERVAL = 5_000; // 5 秒自动刷新

export function useServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: fetchServers,
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 2_000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}

export function useServerSummary(serverId: string | undefined) {
  return useQuery({
    queryKey: ["server-summary", serverId],
    queryFn: () => fetchServerSummary(serverId as string),
    enabled: Boolean(serverId),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 2_000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}

export function useServerHistory(serverId: string | undefined) {
  return useQuery({
    queryKey: ["server-history", serverId],
    queryFn: () => fetchServerHistory(serverId as string),
    enabled: Boolean(serverId),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 2_000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}

/** 并行获取多台服务器的指标摘要 */
export function useServerSummaries(serverIds: string[]) {
  return useQueries({
    queries: serverIds.map((id) => ({
      queryKey: ["server-summary", id],
      queryFn: () => fetchServerSummary(id),
      enabled: Boolean(id),
      refetchInterval: REFRESH_INTERVAL,
      staleTime: 2_000,
      retry: 2,
      placeholderData: keepPreviousData,
    })),
  });
}

/** 并行获取多台服务器的指标时间序列(按时间范围) */
export function useServerHistories(serverIds: string[], range: HistoryRange = "1h") {
  return useQueries({
    queries: serverIds.map((id) => ({
      queryKey: ["server-history", id, range],
      queryFn: () => fetchServerHistory(id, range),
      enabled: Boolean(id),
      refetchInterval: REFRESH_INTERVAL,
      staleTime: 2_000,
      retry: 2,
      placeholderData: keepPreviousData,
    })),
  });
}

/** 并行获取多台服务器的物理硬盘列表 */
export function useServerDisksList(serverIds: string[]) {
  return useQueries({
    queries: serverIds.map((id) => ({
      queryKey: ["server-disks", id],
      queryFn: () => fetchServerDisks(id),
      enabled: Boolean(id),
      refetchInterval: REFRESH_INTERVAL,
      staleTime: 2_000,
      retry: 2,
      placeholderData: keepPreviousData,
    })),
  });
}

export function useMcServers() {
  return useQuery({
    queryKey: ["mc"],
    queryFn: fetchMcServers,
    // MC 在线状态变化不频繁,30s 轮询即可,避免频繁探测
    refetchInterval: 30_000,
    staleTime: 5_000,
    retry: 2,
    placeholderData: keepPreviousData,
  });
}

/** 手动刷新全部数据(Mock 阶段:重新拉取共享状态) */
export function useRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 200));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
      void queryClient.invalidateQueries({ queryKey: ["server-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["server-history"] });
      void queryClient.invalidateQueries({ queryKey: ["mc"] });
    },
  });
}
