function useCodeLine({ line, num }) {
  const tokens = tokenizeLine(line);
  return (
    <div className="fv-code-line">
      <span className="fv-line-num">{num}</span>
      <span className="fv-line-content">
        {tokens.map((t, i) => (
          <span key={i} className={`fv-tok fv-tok-${t.type}`}>
            {t.text}
          </span>
        ))}
        {tokens.length === 0 && "\u00a0"}
      </span>
    </div>
  );
}

export default useCodeLine;
