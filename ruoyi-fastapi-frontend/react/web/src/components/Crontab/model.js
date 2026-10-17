export function parseCronField(value, min) {
  const state = {
    mode: "custom",
    start: min,
    end: min + 1,
    step: 1,
    day: 1,
    weekday: 2,
    occurrence: 1,
    values: [min],
  };
  if (value === "*") state.mode = "every";
  else if (value === "?" || value === "") state.mode = "omit";
  else if (value === "L") state.mode = "lastDay";
  else if (value === "LW") state.mode = "lastWorkday";
  else if (/^\d+W$/.test(value)) {
    state.mode = "workday";
    state.day = Number(value.slice(0, -1));
  } else if (/^\d+L$/.test(value)) {
    state.mode = "lastWeekday";
    state.weekday = Number(value.slice(0, -1));
  } else if (/^\d+#\d+$/.test(value)) {
    state.mode = "nthWeekday";
    [state.weekday, state.occurrence] = value.split("#").map(Number);
  } else if (/^\d+-\d+$/.test(value)) {
    state.mode = "range";
    [state.start, state.end] = value.split("-").map(Number);
  } else if (/^\d+\/\d+$/.test(value)) {
    state.mode = "step";
    [state.start, state.step] = value.split("/").map(Number);
  } else if (/^\d+(,\d+)*$/.test(value)) {
    state.mode = "values";
    state.values = value.split(",").map(Number);
  }
  return state;
}
export function serializeCronField(state, name, fallback = "") {
  switch (state.mode) {
    case "every":
      return "*";
    case "omit":
      return name === "year" ? "" : "?";
    case "range":
      return `${state.start}-${state.end}`;
    case "step":
      return `${state.start}/${state.step}`;
    case "values":
      return [...new Set(state.values)].sort((a, b) => a - b).join(",");
    case "workday":
      return `${state.day}W`;
    case "lastDay":
      return "L";
    case "lastWorkday":
      return "LW";
    case "lastWeekday":
      return `${state.weekday}L`;
    case "nthWeekday":
      return `${state.weekday}#${state.occurrence}`;
    default:
      return fallback;
  }
}
export function updateCronPart(parts, index, value) {
  const next = [...parts];
  next[index] = value;
  const other = index === 3 ? 5 : index === 5 ? 3 : -1;
  if (other >= 0) next[other] = value === "?" ? (next[other] === "?" ? "*" : next[other]) : "?";
  return next;
}
