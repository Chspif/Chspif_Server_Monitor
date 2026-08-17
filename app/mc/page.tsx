import { redirect } from "next/navigation";

// MC 服务器已迁移到首页 /,此路由跳转过去。
export default function McServersPage() {
  redirect("/");
}
