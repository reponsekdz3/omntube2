import { useEffect, useState, useCallback } from "react";
import type { Section } from "../types";

export interface ParsedRoute {
  pathname: string;
  section: Section;
  videoId?: string;
  shortId?: string;
  liveId?: string;
  searchQuery?: string;
}

export function parseRoute(pathname = window.location.pathname, search = window.location.search): ParsedRoute {
  const urlParams = new URLSearchParams(search);
  const q = urlParams.get("q") || urlParams.get("search") || undefined;
  const vParam = urlParams.get("v") || undefined;

  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  // /watch/:id or /watch?v=:id
  if (cleanPath.startsWith("/watch")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const videoId = parts[1] || vParam;
    return {
      pathname: cleanPath,
      section: "home",
      videoId,
      searchQuery: q,
    };
  }

  // /shorts/:id or /shorts
  if (cleanPath.startsWith("/shorts")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const shortId = parts[1];
    return {
      pathname: cleanPath,
      section: "shorts",
      shortId,
      searchQuery: q,
    };
  }

  // /live/:id or /live
  if (cleanPath.startsWith("/live")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const liveId = parts[1];
    return {
      pathname: cleanPath,
      section: "live",
      liveId,
      searchQuery: q,
    };
  }

  // Specific section pathnames
  if (cleanPath === "/studio") {
    return { pathname: cleanPath, section: "studio", searchQuery: q };
  }
  if (cleanPath === "/library") {
    return { pathname: cleanPath, section: "library", searchQuery: q };
  }
  if (cleanPath === "/trending") {
    return { pathname: cleanPath, section: "trending", searchQuery: q };
  }
  if (cleanPath === "/community" || cleanPath === "/posts") {
    return { pathname: cleanPath, section: "posts", searchQuery: q };
  }
  if (cleanPath === "/following" || cleanPath === "/subscriptions") {
    return { pathname: cleanPath, section: "subscriptions", searchQuery: q };
  }
  if (cleanPath === "/notifications") {
    return { pathname: cleanPath, section: "notifications", searchQuery: q };
  }

  // Default home
  return {
    pathname: cleanPath,
    section: "home",
    searchQuery: q,
  };
}

export function navigateTo(targetPath: string, replace = false) {
  if (typeof window === "undefined") return;
  const current = window.location.pathname + window.location.search;
  if (current === targetPath) return;

  if (replace) {
    window.history.replaceState({}, "", targetPath);
  } else {
    window.history.pushState({}, "", targetPath);
  }
  window.dispatchEvent(new Event("popstate"));
}

export function useAppRouter() {
  const [route, setRoute] = useState<ParsedRoute>(() => {
    if (typeof window === "undefined") {
      return { pathname: "/", section: "home" };
    }
    return parseRoute();
  });

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = useCallback((path: string, replace = false) => {
    navigateTo(path, replace);
  }, []);

  const navigateSection = useCallback((sec: Section) => {
    switch (sec) {
      case "home":
        navigateTo("/");
        break;
      case "trending":
        navigateTo("/trending");
        break;
      case "shorts":
        navigateTo("/shorts");
        break;
      case "live":
        navigateTo("/live");
        break;
      case "subscriptions":
        navigateTo("/subscriptions");
        break;
      case "posts":
        navigateTo("/community");
        break;
      case "library":
        navigateTo("/library");
        break;
      case "studio":
        navigateTo("/studio");
        break;
      case "notifications":
        navigateTo("/notifications");
        break;
      default:
        navigateTo("/");
    }
  }, []);

  const navigateWatch = useCallback((videoId: string) => {
    navigateTo(`/watch/${encodeURIComponent(videoId)}`);
  }, []);

  const navigateShort = useCallback((shortId?: string) => {
    if (shortId) {
      navigateTo(`/shorts/${encodeURIComponent(shortId)}`);
    } else {
      navigateTo("/shorts");
    }
  }, []);

  const navigateLive = useCallback((liveId?: string) => {
    if (liveId) {
      navigateTo(`/live/${encodeURIComponent(liveId)}`);
    } else {
      navigateTo("/live");
    }
  }, []);

  const navigateSearch = useCallback((query: string) => {
    if (query.trim()) {
      navigateTo(`/?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigateTo("/");
    }
  }, []);

  return {
    route,
    navigate,
    navigateSection,
    navigateWatch,
    navigateShort,
    navigateLive,
    navigateSearch,
  };
}
