import NotFound from "../components/NotFound";
import { optionalAuthRoutes } from "./optionalAuthRoutes";
import { protectedRoutes } from "./ProtectedRoutes";
import { publicRoutes } from "./PublicRoutes";


export const allRoutes = [
  ...protectedRoutes,
  ...publicRoutes,
  ...optionalAuthRoutes,
  {
    path: "*",
    element: <NotFound />
  },
];
