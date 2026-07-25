import { formatMeasure } from "../credenza-fashion.jsx";

// Translated chart view (Kyle 2026-07-22: "clicking recommended size pulls up
// the sizing sheet, or even a translation"). parseSizeChart already normalizes
// Chinese labels into measure keys, so translation is just a header map.
const MEASURE_COLS = [
  ["chest", "Chest"],
  ["shoulder", "Shoulder"],
  ["sleeve", "Sleeve"],
  ["waist", "Waist"],
  ["hip", "Hip"],
  ["pantsLength", "Pants length"],
  ["length", "Length"],
];

export default function SizeChartTable({ chart, units, highlight, highlightAlt }) {
  const cols = MEASURE_COLS.filter(([key]) => chart.rows.some((r) => r[key] != null));
  return (
    <table className="cz-size-chart-table">
      <thead>
        <tr>
          <th scope="col">Size</th>
          {cols.map(([key, label]) => (
            <th scope="col" key={key}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.rows.map((row) => (
          <tr
            key={row.size}
            className={
              row.size === highlight ? "is-rec" : row.size === highlightAlt ? "is-alt" : undefined
            }
          >
            <th scope="row">{row.size}</th>
            {cols.map(([key]) => (
              <td key={key}>{row[key] != null ? formatMeasure(row[key], units) : "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
