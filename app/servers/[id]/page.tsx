import { redirect } from "next/navigation";

// 服务器独立页面已移除,访问 /servers/[id] 时跳回总览。
export default async function ServerDetailPage() {
  redirect("/");
}
