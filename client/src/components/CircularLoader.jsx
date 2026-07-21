// CircularLoader.jsx

export default function CircularLoader({ size = 40 }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
    />
  );
}