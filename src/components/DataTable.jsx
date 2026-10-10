const identity = value => value;
const indexKey = (_, index) => index;

export function DataTable({ headings, rows, rowKey = indexKey, labelFor = identity, empty = '暂无符合条件的记录' }) {
  return <div className="table-scroll">
    <table>
      <thead><tr>{headings.map(heading => <th key={heading}>{heading}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row, i) =>
        <tr key={rowKey(row, i)}>{row.map((cell, j) =>
          <td key={j} data-label={labelFor(headings[j])}>{cell}</td>
        )}</tr>
      ) : <tr><td colSpan={headings.length} className="empty">{empty}</td></tr>}</tbody>
    </table>
  </div>;
}
