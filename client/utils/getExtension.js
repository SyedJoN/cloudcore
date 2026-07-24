function getExt(name = "") {
  return name.split(".").pop().toLowerCase();
}

export default getExt;
