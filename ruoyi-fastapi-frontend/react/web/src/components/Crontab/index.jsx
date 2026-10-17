import "./style.css";
import { useEffect, useState } from "react";
import { Button, Tabs, Tooltip } from "antd";
import Result from "./result";
import { updateCronPart } from "./model";
import Second from "./second";
import Min from "./min";
import Hour from "./hour";
import Day from "./day";
import Month from "./month";
import Week from "./week";
import Year from "./year";

const fields = [
  ["second", "秒", Second],
  ["min", "分钟", Min],
  ["hour", "小时", Hour],
  ["day", "日", Day],
  ["month", "月", Month],
  ["week", "周", Week],
  ["year", "年", Year],
];
const defaults = ["*", "*", "*", "*", "*", "?", ""];
function parseExpression(expression) {
  const parsed = expression.trim().split(/\s+/);
  return parsed.length >= 6 ? [...parsed.slice(0, 6), parsed[6] || ""] : defaults;
}
export default function Crontab({ expression = "", timeZone, onFill, onHide, hideComponent = [] }) {
  const [parts, setParts] = useState(() => parseExpression(expression));
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    setParts(parseExpression(expression));
  }, [expression]);
  const value = parts.join(" ").trim();
  return (
    <div className="crontab">
      <Tabs
        className="cron-tabs"
        type="card"
        items={fields
          .filter(([name]) => !hideComponent.includes(name))
          .map(([name, label, Field]) => ({
            key: name,
            label,
            children: (
              <Field
                key={resetKey}
                value={parts[fields.findIndex((field) => field[0] === name)]}
                onChange={(next) =>
                  setParts((previous) =>
                    updateCronPart(
                      previous,
                      fields.findIndex((field) => field[0] === name),
                      next,
                    ),
                  )
                }
              />
            ),
          }))}
      />
      <div className="cron-summary">
        <section className="cron-expression" aria-label="时间表达式">
          <h4>时间表达式</h4>
          <div className="cron-expression-scroll">
            <table>
              <thead>
                <tr>
                  {fields.map(([name, label]) => (
                    <th key={name} scope="col">
                      {label}
                    </th>
                  ))}
                  <th scope="col">Cron 表达式</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[...parts, value].map((part, index) => (
                    <td key={index}>
                      <Tooltip title={part}>
                        <span>{part || "\u00a0"}</span>
                      </Tooltip>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <Result expression={value} timeZone={timeZone} />
        <div className="cron-footer">
          <Button
            type="primary"
            onClick={() => {
              onFill(value);
              onHide();
            }}
          >
            确定
          </Button>
          <Button
            className="cron-reset"
            onClick={() => {
              setParts(defaults);
              setResetKey((key) => key + 1);
            }}
          >
            重置
          </Button>
          <Button onClick={onHide}>取消</Button>
        </div>
      </div>
    </div>
  );
}
