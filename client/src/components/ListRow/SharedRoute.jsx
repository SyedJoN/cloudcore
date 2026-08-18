import RowActions from "./RowActions";

export default function SharedRoute({
  owner,
  sharedWithMeTime,
  ...actionProps
}) {
  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
        {owner}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {sharedWithMeTime}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {/* Empty column */}
      </div>

      <RowActions {...actionProps} />
    </>
  );
}