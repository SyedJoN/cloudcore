import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./App.css";
import { ToastProvider } from "./Contexts/ToastContext";
import { AuthProvider } from "./Contexts/AuthContext";
import { allRoutes } from "./routes/index";
import BreadcrumbProvider from "./Contexts/BreadcrumbContext";

// const router = createBrowserRouter([
//   { path: "/register", element: <Register /> },
//   { path: "/login", element: <Login /> },
//   { path: "/users", element: <UsersPage /> },
//   { path: "/file/:fileId", element: <FileViewPage /> },
//   { path: "/home", element: <DirectoryView /> },
//   { path: "/directory/:dirId", element: <DirectoryView /> },
//   { path: "/shared", element: <DirectoryView /> },
//     { path: "/trash", element: <DirectoryView /> },
//   { path: "/trash/directory/:dirId", element: <DirectoryView /> },
//   { path: "/", element: <DirectoryView /> },
//   { path: "/main", element: <Home /> },
// ]);

const router = createBrowserRouter(allRoutes);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BreadcrumbProvider>
          <RouterProvider router={router} />
        </BreadcrumbProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
