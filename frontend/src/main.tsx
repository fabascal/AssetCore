import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "./components/Toaster";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext";

const RootApp = () => (
  <>
    <Toaster />
    <App />
  </>
);

const container = document.getElementById("root") as HTMLElement | null;

if (!container) {
  throw new Error("No se encontró el nodo root para montar la aplicación.");
}

type RootContainer = HTMLElement & {
  __assetcoreRoot?: ReactDOM.Root;
};

const rootContainer = container as RootContainer;
const root = rootContainer.__assetcoreRoot ?? ReactDOM.createRoot(rootContainer);
rootContainer.__assetcoreRoot = root;

root.render(
  <ThemeProvider>
    <RootApp />
  </ThemeProvider>
);
