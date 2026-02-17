import axios from "axios";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://glass-system-backend.onrender.com";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;

  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // إرسال بيانات اليوزر مع كل طلب عشان نعرف مين عمل العملية
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      config.headers["X-User-Id"] = user.id;
      config.headers["X-User-Name"] = encodeURIComponent(
        user.full_name || user.username,
      );
      config.headers["X-Branch-Id"] = user.branch_id;
    } catch {
      // تجاهل لو فيه مشكلة في الـ parse
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.includes("/login")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
