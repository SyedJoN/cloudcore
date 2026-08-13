export const getIdString = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (value?._id) {
    return value._id.toString();
  }

  if (typeof value.toString === "function") {
    const result = value.toString();

    if (result !== "[object Object]") {
      return result;
    }
  }

  return null;
};