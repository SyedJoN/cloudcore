import { useState, useContext, createContext } from "react";

const BreadcrumbContext = createContext(null);
const BreadcrumbProvider = ({ children }) => {
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
export default BreadcrumbProvider;
