import { redirect } from "next/navigation";

// 服务器独立页面已移除,访问 /servers 时跳回总览。
export default function ServersPage() {
  redirect("/");
}
