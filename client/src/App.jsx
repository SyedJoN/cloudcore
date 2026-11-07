import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./Styles/App.css";
import { ToastProvider } from "./Contexts/ToastContext";
import { AuthProvider } from "./Contexts/AuthContext";
import { allRoutes } from "./Routes/index";
import BreadcrumbProvider from "./Contexts/BreadcrumbContext";
import { ThemeProvider } from "./Contexts/ThemeContext";
import { GDriveAuthProvider } from "./Contexts/GoogleDriveAuthContext";
import { SidebarProvider } from "./Contexts/SidebarContext";
import { DeviceProvider } from "./Contexts/DeviceContext";

const router = createBrowserRouter(allRoutes);

function App() {
  return (
    <AuthProvider>
      <DeviceProvider>
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
      </DeviceProvider>
    </AuthProvider>
  );
}

export default App;
