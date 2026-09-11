const SIDEBAR_COLLAPSED_KEY = "interprep-sidebar-collapsed";

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export function isKitWorkspacePath(pathname: string) {
  return /^\/kits\/[^/]+(\/practice)?$/.test(pathname);
}

export function loadSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function saveSidebarCollapsed(collapsed: boolean) {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}
