import { BottomSheet } from "../Drive/BottomSheet.jsx";

function ConfirmationModalMobile({ open, onClose, onAction_1, onAction_2, title, description, action_1 = "Cancel", action_2 = "Discard", isFetching = false, }) { return ( <BottomSheet open={open} onClose={() => !isFetching && onClose?.()} zIndex={1200}

>
  <div className="px-5 pb-7 pt-3">
    <h2 className="text-[18px] font-semibold text-(--text-primary)">
      {title}
    </h2>

    {description && (
      <p className="mt-2 text-[14px] leading-relaxed text-(--text-secondary)">
        {description}
      </p>
    )}

    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        disabled={isFetching}
        onClick={onAction_1}
        className="rounded-full px-5 py-2.5 text-[14px] font-medium text-[#1a73e8] active:bg-black/5"
      >
        {action_1}
      </button>

      <button
        type="button"
        disabled={isFetching}
        onClick={onAction_2}
        className="rounded-full bg-(--accent-blue-light) px-5 py-2.5 text-[14px] font-medium text-(--text-primary) active:bg-(--accent-blue) active:text-(--text-theme) disabled:opacity-50"
      >
        {isFetching ? "Saving..." : action_2}
      </button>
    </div>
  </div>
</BottomSheet>


); }

export default ConfirmationModalMobile;