// 从本地存储中读取登录 token，并构造 axios 请求所需的 Authorization 请求头。
// 集中在此处维护，避免每个页面各自拼接 token key / header 格式。
export function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: 'Bearer ' + token } : {}
}
