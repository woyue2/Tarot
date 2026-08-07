import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// 主题初始化：优先上次选择，否则默认浅色（不跟随系统）
const savedTheme = localStorage.getItem("tarot.mobile.theme");
if (savedTheme === "dark" || savedTheme === "light") {
  document.documentElement.dataset.theme = savedTheme;
} else {
  document.documentElement.dataset.theme = "light";
}

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 容器");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA 离线：仅在构建产物（preview/build）注册，避免污染 vite dev
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* 注册失败不影响主流程 */
    });
  });
}
