import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./Styles/App.css";
import { ToastProvider } from "./Contexts/ToastContext";
import { AuthProvider } from "./Contexts/AuthContext";
import { allRoutes } from "./Routes/index";
import BreadcrumbProvider from "./Contexts/BreadcrumbContext";
import { ThemeProvider } from "./Contexts/ThemeContext";
import { GDriveAuthProvider } from "./Contexts/GoogleDriveAuthContext";
import { SidebarProvider } from "./Contexts/SidebarContext";

const router = createBrowserRouter(allRoutes);

function App() {
  return (
    <AuthProvider>
      <GDriveAuthProvider>
      <ThemeProvider>
        <SidebarProvider>
      <ToastProvider>
        <BreadcrumbProvider>
          <RouterProvider router={router} />
        </BreadcrumbProvider>
      </ToastProvider>
      </SidebarProvider>
        </ThemeProvider>
        </GDriveAuthProvider>
    </AuthProvider>
  );
}

export default App;
