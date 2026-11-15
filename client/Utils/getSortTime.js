export const getSortTime = (item, key) => {
  const t = {
    sharedTime: item.sharedAt ?? item.sharedWithMeTime, // apne data ka asli "shared date" field
    modifiedTime: item.modifiedTime ?? item.updatedAt,
    modifiedByMeTime: item.modifiedByMeTime,
    viewedByMeTime: item.viewedByMeTime,
  }[key];
  return t ? new Date(t).getTime() : 0;
};