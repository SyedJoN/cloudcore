import Protected from "../Components/Layouts/AuthLayout";
import DirectoryView from "../Pages/DirectoryView";
import UsersPage from "../Pages/UsersPage";

export const protectedRoutes = [
  {
    element: <Protected />,
    children: [
      {
        path: "/",
        element: <DirectoryView />,
      },
      {
        path: "/directory/:dirId",
        element: <DirectoryView />,
      },
      {
        path: "/home",
        element: <DirectoryView route="home" />,
      },
      {
        path: "/users",
        element: <UsersPage />,
      },
      {
        path: "/shared",
        element: <DirectoryView route="shared" />,
      },
       {
        path: "/recent",
        element: <DirectoryView route="recent" />,
      },
      {
        path: "/trash",
        element: <DirectoryView route="trash" />,
      },
    ],
  },
];
