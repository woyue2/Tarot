import React from "react";
import ReactDOM from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./styles.css";
import { App } from "./App";

const initialPlatform = window.tarot?.platform;
if (initialPlatform) document.documentElement.dataset.platform = initialPlatform;
const savedTheme = localStorage.getItem("xj-theme");
if (savedTheme === "dark" || savedTheme === "light") document.documentElement.dataset.theme = savedTheme;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
