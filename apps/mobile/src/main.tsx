import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// 主题初始化：优先上次选择，其次跟随系统
const savedTheme = localStorage.getItem("tarot.mobile.theme");
if (savedTheme === "dark" || savedTheme === "light") {
  document.documentElement.dataset.theme = savedTheme;
} else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
  document.documentElement.dataset.theme = "dark";
}

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 容器");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
