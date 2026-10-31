export function getColor(name) {
  if (!name) return;
  const colors = [
    "#673AB7", // deepPurple[500]
    "#3F51B5", // indigo[500]
    "#2196F3", // blue[500]
    "#009688", // teal[500]
    "#4CAF50", // green[500]
    "#FFC107", // amber[500]
    "#FF9800", // orange[500]
    "#F44336", // red[500]
  ];

  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
