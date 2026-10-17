import { Table as AntTable } from "antd";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import "./style.css";

const Table = forwardRef(function Table(props, ref) {
  const host = useRef(null);
  const viewport = useRef(null);
  const drag = useRef(null);
  const [bar, setBar] = useState(null);
  const scroll = props.scroll && { ...props.scroll };
  if (typeof scroll?.x === "number" && props.columns?.length && props.columns.every(column => typeof column.width === "number")) {
    scroll.x = props.columns.reduce((sum, column) => sum + column.width, props.rowSelection ? Number(props.rowSelection.columnWidth || 55) : 0);
  }
  useLayoutEffect(() => {
    const root = host.current;
    const scroller = root.querySelector(".ant-table-body") || root.querySelector(".ant-table-content");
    viewport.current = scroller;
    if (!scroller) return;
    const measure = () => {
      const { clientWidth, scrollWidth, scrollLeft } = scroller;
      const max = scrollWidth - clientWidth;
      if (max < 2) { setBar(null); return; }
      const width = Math.max(24, (clientWidth - 4) * clientWidth / scrollWidth);
      const rect = scroller.getBoundingClientRect();
      const parent = root.getBoundingClientRect();
      setBar({ max, value: scrollLeft, width, travel: clientWidth - 4 - width, trackWidth: clientWidth - 4, left: rect.left - parent.left + 2, top: rect.bottom - parent.top - 8 });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    observer?.observe(scroller);
    const table = scroller.querySelector("table");
    if (table) observer?.observe(table);
    scroller.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); scroller.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [props.dataSource, props.columns, props.scroll?.x, props.scroll?.y]);
  const moveTo = (value) => { if (viewport.current && bar) viewport.current.scrollLeft = Math.max(0, Math.min(bar.max, value)); };
  return <div className="ruoyi-table" ref={host}>
    <AntTable size="small" {...props} scroll={scroll} rowSelection={props.rowSelection ? { columnWidth: 55, ...props.rowSelection } : undefined} ref={ref} />
    {bar && <div className="table-scrollbar" style={{ left: bar.left, top: bar.top, width: bar.trackWidth }} role="scrollbar" aria-label="表格横向滚动" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={Math.round(bar.max)} aria-valuenow={Math.round(bar.value)} tabIndex={0}
      onKeyDown={(event) => {
        const values = { ArrowLeft: bar.value - 80, ArrowRight: bar.value + 80, Home: 0, End: bar.max, PageUp: bar.value - bar.trackWidth, PageDown: bar.value + bar.trackWidth };
        if (event.key in values) { event.preventDefault(); moveTo(values[event.key]); }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add("is-dragging");
        const thumb = event.currentTarget.firstElementChild.getBoundingClientRect();
        const onThumb = event.clientX >= thumb.left && event.clientX <= thumb.right;
        const start = onThumb ? bar.value : (event.clientX - event.currentTarget.getBoundingClientRect().left - bar.width / 2) / bar.travel * bar.max;
        moveTo(start);
        drag.current = { x: event.clientX, value: Math.max(0, Math.min(bar.max, start)), travel: bar.travel, max: bar.max };
      }}
      onPointerMove={(event) => { if (drag.current) moveTo(drag.current.value + (event.clientX - drag.current.x) / drag.current.travel * drag.current.max); }}
      onLostPointerCapture={(event) => { drag.current = null; event.currentTarget.classList.remove("is-dragging"); }}
      onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
    ><span style={{ width: bar.width, transform: `translateX(${bar.value / bar.max * bar.travel}px)` }} /></div>}
  </div>;
});
Object.assign(Table, { Column: AntTable.Column, ColumnGroup: AntTable.ColumnGroup, SELECTION_ALL: AntTable.SELECTION_ALL, SELECTION_INVERT: AntTable.SELECTION_INVERT, SELECTION_NONE: AntTable.SELECTION_NONE, SELECTION_COLUMN: AntTable.SELECTION_COLUMN, EXPAND_COLUMN: AntTable.EXPAND_COLUMN });
export default Table;
