export function sortItems(filteredItems = [], sortConfig = {}) {
  const data = [...filteredItems];

  data.sort((a, b) => {
    // Folders on top
    if (sortConfig.folders === "top") {
      const aIsFolder = a.isDirectory === true;
      const bIsFolder = b.isDirectory === true;

      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1;
      }
    }

    let aValue;
    let bValue;

    switch (sortConfig.key) {
      case "name":
        aValue = (a.sortName ?? a.name ?? "").toLowerCase();
        bValue = (b.sortName ?? b.name ?? "").toLowerCase();
        break;

      case "modifiedTime":
        aValue = new Date(
          a.sortModifiedTime || a.modifiedTime || a.updatedAt || 0
        ).getTime();
        bValue = new Date(
          b.sortModifiedTime || b.modifiedTime || b.updatedAt || 0
        ).getTime();
        break;

      case "sharedTime":
      case "sharedWithMeTime":
        aValue = new Date(
          a.sharedTime || a.sharedWithMeTime || 0
        ).getTime();
        bValue = new Date(
          b.sharedTime || b.sharedWithMeTime || 0
        ).getTime();
        break;

      case "modifiedByMeTime":
        aValue = new Date(a.modifiedByMeTime || 0).getTime();
        bValue = new Date(b.modifiedByMeTime || 0).getTime();
        break;

      case "viewedByMeTime":
        aValue = new Date(a.viewedByMeTime || 0).getTime();
        bValue = new Date(b.viewedByMeTime || 0).getTime();
        break;

      case "trashedTime":
        aValue = new Date(a.trashedTime || 0).getTime();
        bValue = new Date(b.trashedTime || 0).getTime();
        break;

      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }

    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }

    return 0;
  });

  return data;
}