
export const updateItemState = (setItem, itemId, updates) => {
  setItem((currentItem) => {
    if (!currentItem) {
      return currentItem;
    }

    if (
      String(currentItem._id) !== String(itemId)
    ) {
      return currentItem;
    }

    return {
      ...currentItem,
      ...updates,
    };
  });
};

