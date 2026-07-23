import { createContext, useContext, useEffect, useState } from "react";

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isSidebarOpen ? "256px" : "0px"
    );
  }, [isSidebarOpen]);

  useEffect(() => {
    if (windowWidth >= 768 && !isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  }, [windowWidth, isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{
        windowWidth,
        isSidebarOpen,
        toggleSidebar,
        setIsSidebarOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used inside SidebarProvider");
  }

  return context;
};

