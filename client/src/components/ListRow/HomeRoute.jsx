import RowActions from "./RowActions";

export default function HomeRoute({
  owner,
  lastModified,
  size,
  ...actionProps
}) {
  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
        {owner}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {lastModified}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {size}
      </div>

      <RowActions {...actionProps} />
    </>
  );
}